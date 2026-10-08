// @ts-check
/**
 * L'analizzatore del Sonar: LOFAR (frequenza in orizzontale, tempo che scende) e DEMON (lo spettro della
 * modulazione del rumore, dove stanno le righe di pala) del fascio puntato, più le 16 barre del SONAR
 * COMPUTER del 1989 (046, 048).
 *
 * Le righe arrivano nei messaggi `spettro` (protocollo v2): ogni 4 s di gioco un vettore di byte, uno
 * per banda di frequenza da `da_hz` con passo `passo_hz`, quantizzati come i fotogrammi `sonar`
 * (SE = −30 + 0,5·q dB, soglia di rivelazione q = 60); il DEMON allo stesso modo da `demon_da_hz` con
 * passo `demon_passo_hz`. Qui solo funzioni pure: da una riga ai colori di una riga dello schermo, i
 * picchi (le righe tonali), le barre del 1989. Il disegno sta in stazioni/sonar.js.
 *
 * Colori: la rampa del mare della cascata (resa/cascata.js), più ripida (coloreLofar): le righe tonali sono
 * strette e di pochi dB sopra il fondo; le 16 barre nei colori misurati su 048 (magenta a righe alterne 13 e 5, cappello rosso 12 e
 * 4 sulla barra più alta, alloggiamenti vuoti grigio scuro 8).
 */

/** @typedef {import('../stato.js').Spettro} Spettro */

/** Le 16 barre del SONAR COMPUTER (046/048): alloggiamento k in x 204+6k..207+6k, righe 30..47. */
export const BARRE = Object.freeze({ n: 16, x0: 204, passo: 6, larghezza: 4, y1: 30, y2: 47 });

/**
 * Frequenza (Hz) al centro della banda i di una riga.
 * @param {number} da_hz @param {number} passo_hz @param {number} i
 */
export function frequenzaDiBanda(da_hz, passo_hz, i) {
  return da_hz + (i + 0.5) * passo_hz;
}

/**
 * Colonna (0..colonne-1, frazionaria) di una frequenza in un intervallo mostrato, o null fuori.
 * @param {number} f @param {number} f0 @param {number} f1 @param {number} colonne
 */
export function colonnaDiFrequenza(f, f0, f1, colonne) {
  if (!(f1 > f0) || f < f0 || f > f1) return null;
  return Math.min(colonne - 1e-9, ((f - f0) / (f1 - f0)) * colonne);
}

/**
 * Frequenza al centro di una colonna.
 * @param {number} c @param {number} f0 @param {number} f1 @param {number} colonne
 */
export function frequenzaDiColonna(c, f0, f1, colonne) {
  return f0 + ((Math.floor(c) + 0.5) * (f1 - f0)) / colonne;
}

/**
 * Valori (q) di una riga ricampionati su `colonne` colonne fra f0 e f1: una colonna che copre più bande
 * prende il massimo (una riga stretta non sparisce), una banda più larga di una colonna si allarga.
 * Fuori dalla banda della riga: 0.
 * @param {ArrayLike<number>} byte @param {number} da_hz @param {number} passo_hz
 * @param {number} f0 @param {number} f1 @param {number} colonne
 * @returns {Uint8Array}
 */
export function ricampiona(byte, da_hz, passo_hz, f0, f1, colonne) {
  const out = new Uint8Array(colonne);
  if (!(passo_hz > 0) || !(f1 > f0)) return out;
  const larghezza = (f1 - f0) / colonne;
  for (let c = 0; c < colonne; c++) {
    const fa = f0 + c * larghezza, fb = fa + larghezza;
    let i0 = Math.floor((fa - da_hz) / passo_hz);
    let i1 = Math.ceil((fb - da_hz) / passo_hz) - 1;
    if (i1 < i0) i1 = i0;
    i0 = Math.max(0, i0);
    i1 = Math.min(byte.length - 1, i1);
    let v = 0;
    for (let i = i0; i <= i1; i++) v = Math.max(v, byte[i] ?? 0);
    out[c] = v;
  }
  return out;
}

/**
 * Colore di una cella del LOFAR: più contrastato della cascata, perché le righe tonali sono strette e
 * di pochi dB sopra il fondo. Il fondo di rumore (q ≈ 40) resta blu notte, dalla soglia (q 60) si sale
 * in fretta lungo la rampa del mare, una riga di 15 dB sopra la soglia è già ciano chiaro, di 25 bianca.
 * @param {number} q
 */
export function coloreLofar(q) {
  if (q < 32) return 0;
  if (q < 56) return 96 + Math.floor((q - 32) / 3);
  if (q < 90) return 105 + Math.floor(((q - 56) * 38) / 34);
  return q < 110 ? 11 : 15;
}

/**
 * Una riga del LOFAR (o del DEMON) in indici di palette.
 * @param {ArrayLike<number>} byte @param {number} da_hz @param {number} passo_hz
 * @param {number} f0 @param {number} f1 @param {number} colonne
 */
export function rigaSpettro(byte, da_hz, passo_hz, f0, f1, colonne) {
  const v = ricampiona(byte, da_hz, passo_hz, f0, f1, colonne);
  const riga = new Uint8Array(colonne);
  for (let c = 0; c < colonne; c++) riga[c] = coloreLofar(v[c]);
  return riga;
}

/**
 * Le righe tonali di una riga: massimi locali sopra la soglia, dal più forte, con la frequenza al centro
 * della banda (raffinata con la parabola sui tre valori, come fa l'occhio del sonarista sul LOFAR). Due
 * massimi più vicini di `separazione` bande contano per uno.
 * @param {ArrayLike<number>} byte @param {number} da_hz @param {number} passo_hz
 * @param {number} [soglia] q (predefinita: la soglia di rivelazione più 3 dB)
 * @param {number} [separazione]
 * @returns {{ banda: number, hz: number, q: number }[]}
 */
export function righeTonali(byte, da_hz, passo_hz, soglia = 66, separazione = 2) {
  /** @type {{ banda: number, hz: number, q: number }[]} */
  const trovate = [];
  for (let i = 0; i < byte.length; i++) {
    const v = byte[i];
    if (v < soglia) continue;
    const a = i > 0 ? byte[i - 1] : 0, b = i < byte.length - 1 ? byte[i + 1] : 0;
    if (!(v > a && v >= b)) continue;
    const den = a - 2 * v + b;
    const spost = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - b)) / den)) : 0;
    trovate.push({ banda: i, hz: da_hz + (i + 0.5 + spost) * passo_hz, q: v });
  }
  trovate.sort((x, y) => y.q - x.q);
  /** @type {typeof trovate} */
  const tenute = [];
  for (const r of trovate) if (!tenute.some((t) => Math.abs(t.banda - r.banda) < separazione)) tenute.push(r);
  return tenute;
}

/**
 * Media (in potenza) delle ultime righe dello stesso fascio: il LOFAR «integrato» che si confronta con
 * la biblioteca e su cui si cercano le righe, più stabile di una riga sola. Si fermano alla prima riga
 * di un altro sensore, rilevamento (più di 3°) o griglia di frequenza.
 * @param {Spettro[]} spettri dal più recente @param {number} quante
 * @param {'righe' | 'demon'} [campo]
 * @returns {Uint8Array | null}
 */
export function mediaRecente(spettri, quante, campo = 'righe') {
  const primo = spettri[0];
  const base = primo?.[campo];
  if (!primo || !base) return null;
  const somma = new Float64Array(base.length);
  let n = 0;
  for (const s of spettri.slice(0, quante)) {
    const b = s[campo];
    if (!b || b.length !== base.length || s.sensore !== primo.sensore) break;
    if (Math.abs(((s.rilevamento - primo.rilevamento + 540) % 360) - 180) > 3) break;
    if (campo === 'righe' ? s.da_hz !== primo.da_hz || s.passo_hz !== primo.passo_hz
      : s.demon_da_hz !== primo.demon_da_hz || s.demon_passo_hz !== primo.demon_passo_hz) break;
    for (let i = 0; i < b.length; i++) somma[i] += 10 ** (b[i] / 20); // q è mezzo dB: potenza = 10^(q·0,5/10)
    n++;
  }
  const out = new Uint8Array(base.length);
  for (let i = 0; i < base.length; i++) out[i] = Math.max(0, Math.min(255, Math.round(20 * Math.log10(somma[i] / n))));
  return out;
}

/**
 * Le 16 barre del SONAR COMPUTER: la finestra della riga, da 16 Hz, divisa in 16 parti uguali in scala
 * logaritmica (le basse a sinistra, come le «navi» del foglio del 1989), ognuna alta quanto il suo massimo. Il
 * fondo di rumore (q ≈ 40) accende due righe, la soglia (q = 60) sei, q ≥ 150 tutte e diciotto.
 * @param {ArrayLike<number>} byte @param {number} da_hz @param {number} passo_hz
 * @returns {{ altezze: number[], picco: number }} altezze in righe (0..18), indice della più alta (-1 se tutte vuote)
 */
export function barreAnalizzatore(byte, da_hz, passo_hz) {
  const righe = BARRE.y2 - BARRE.y1 + 1;
  // da 16 Hz (sotto ci sono una o due celle per barra) alla fine della finestra
  const f1 = da_hz + byte.length * passo_hz, f0 = Math.min(f1 / 2, Math.max(16, da_hz + passo_hz));
  /** @type {number[]} */
  const altezze = [];
  let picco = -1, max = 0;
  for (let k = 0; k < BARRE.n; k++) {
    const fa = f0 * (f1 / f0) ** (k / BARRE.n), fb = f0 * (f1 / f0) ** ((k + 1) / BARRE.n);
    let i0 = Math.floor((fa - da_hz) / passo_hz), i1 = Math.ceil((fb - da_hz) / passo_hz) - 1;
    i0 = Math.max(0, i0);
    i1 = Math.min(byte.length - 1, Math.max(i0, i1));
    let v = 0;
    for (let i = i0; i <= i1; i++) v = Math.max(v, byte[i] ?? 0);
    const h = Math.max(0, Math.min(righe, Math.round(((v - 28) * righe) / 122)));
    altezze.push(h);
    if (h > max) { max = h; picco = k; }
  }
  return { altezze, picco };
}

/**
 * Disegna le 16 barre nei loro alloggiamenti (048): magenta a righe alterne (13 sulle righe dispari, 5
 * sulle pari), due righe di cappello rosso (12 sopra, 4 sotto) sulla barra più alta, grigio scuro dove la
 * barra non arriva.
 * @param {import('./tela.js').Tela} tela @param {number[]} altezze @param {number} picco
 */
export function disegnaBarre(tela, altezze, picco) {
  for (let k = 0; k < BARRE.n; k++) {
    const x1 = BARRE.x0 + BARRE.passo * k, x2 = x1 + BARRE.larghezza - 1;
    const h = altezze[k] ?? 0;
    for (let y = BARRE.y1; y <= BARRE.y2; y++) {
      const dentro = y > BARRE.y2 - h;
      let c = 8;
      if (dentro) {
        c = y % 2 ? 13 : 5;
        if (k === picco && y <= BARRE.y2 - h + 2) c = y === BARRE.y2 - h + 1 ? 12 : 4;
      }
      tela.hline(y, x1, x2, c);
    }
  }
}

/**
 * Frequenze «tonde» per le etichette di un asse fra f0 e f1, con il passo che dà al più `quante` tacche.
 * @param {number} f0 @param {number} f1 @param {number} [quante]
 * @returns {{ passo: number, valori: number[] }}
 */
export function tacche(f0, f1, quante = 5) {
  const ampiezza = f1 - f0;
  if (!(ampiezza > 0)) return { passo: 1, valori: [] };
  const grezzo = ampiezza / quante;
  const p10 = 10 ** Math.floor(Math.log10(grezzo));
  const passo = [1, 2, 5, 10].map((m) => m * p10).find((p) => p >= grezzo) ?? 10 * p10;
  /** @type {number[]} */
  const valori = [];
  for (let f = Math.ceil(f0 / passo) * passo; f <= f1 + 1e-9; f += passo) valori.push(Math.round(f * 1000) / 1000);
  return { passo, valori };
}

/**
 * Frequenza scritta corta per le etichette (Hz interi; sotto i 10 Hz un decimale; da 1000 Hz in kHz).
 * @param {number} hz
 */
export function formatoHz(hz) {
  if (hz === 0) return '0';
  if (hz >= 1000) return `${(hz / 1000).toFixed(hz % 1000 === 0 ? 0 : 1)}K`;
  if (hz < 10) return hz.toFixed(1).replace(/^0/, '');
  return String(Math.round(hz));
}

/**
 * Dal DEMON: la frequenza dell'asse (giri al secondo) e il numero di pale che spiega meglio le righe
 * di modulazione trovate. Se la riga più forte è la frequenza di pala (asse × pale), le armoniche
 * dell'asse le stanno intorno a passi di f/pale. Si prova ogni numero di pale da 3 a 7 e si tiene quello
 * con più righe che cadono su un multiplo dell'asse (entro mezza banda). Null senza righe.
 * @param {{ hz: number, q: number }[]} righe dal DEMON, dalla più forte @param {number} passo_hz
 * @returns {{ asse_hz: number, pale: number, pala_hz: number } | null}
 */
export function stimaPale(righe, passo_hz) {
  if (righe.length === 0) return null;
  const pala = righe[0].hz;
  let migliore = null, punti = -1;
  for (let pale = 3; pale <= 7; pale++) {
    const asse = pala / pale;
    let n = 0;
    for (const r of righe.slice(1)) {
      const k = Math.round(r.hz / asse);
      if (k >= 1 && Math.abs(r.hz - k * asse) <= Math.max(passo_hz, 0.02 * r.hz)) n++;
    }
    // a parità di righe spiegate, il numero di pale più comune (5 o 7 sui sottomarini, 4-5 sulle navi)
    if (n > punti || (n === punti && pale === 5)) { punti = n; migliore = { asse_hz: asse, pale, pala_hz: pala }; }
  }
  return migliore;
}
