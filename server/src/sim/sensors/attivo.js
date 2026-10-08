// @ts-check
/**
 * Sonar attivo e controscoperta (F2): un ping (ordine `attivo`, TRGT PULSE),
 * gli echi che tornano a chi l'ha fatto e le intercettazioni di tutti gli
 * altri. L'asimmetria e' la fisica (05 §1.1, [WP-SONAR]): l'eco fa due volte il
 * percorso e paga la forza di bersaglio e la riverberazione, l'intercettatore
 * sente il ping dopo un percorso solo.
 *
 * Eco (equazione del sonar attivo, [FUN-8]):
 *
 *   E   = SL + G_tx(ψ) − 2·TL(f, r) + TS(aspetto)            potenza dell'eco, dB re 1 µPa²
 *   N   = NL(f) + 10·log B − DI_rx(f)                        rumore nella banda B = 1/τ
 *   RL  = SL + G_tx(ψ) − 2·TL(f, r) + 10·log(Σ S·A)          riverberazione alla stessa distanza
 *   SE  = E − (N ⊕ RL) − 5·log(d/(B·τ)) + x                  (impulso adattato, B·τ = 1)
 *
 * con la riverberazione di superficie (Chapman-Harris, [ZHANG04]), di fondo
 * (Lambert, μ = −27 dB, [OIK07]) e di volume (S_v), le aree e i volumi della
 * cella di risoluzione c·τ/2 sotto il fascio di ricezione, superficie e fondo
 * pesati dal fascio verticale (andata e ritorno) all'angolo da cui si vedono,
 * e ridotta dal guadagno Doppler quando il bersaglio ha velocita' radiale (lo
 * spostamento 2·v/c·f supera la banda 1/τ dell'impulso). Intercettazione:
 *
 *   SE_i = SL + G_tx(ψ') − TL(f, r') − (NL(f) + 10·log B_canale − DI_i) − 5·log(d/(B_canale·τ)) + x
 *
 * La trasmissione: un fascio puntato (larghezza `fascio`, lobi laterali e
 * retro di acustica.json, attivo) oppure tutto il settore di prua di ±`settore`
 * gradi con `perdita_settore` dB in meno. Tempi d'arrivo con 1500 m/s.
 *
 * Il ping si calcola tutto al momento dell'ordine (geometria di quell'istante):
 * cio' che ne esce sono consegne con l'ora d'arrivo, che sensors/mondo.js
 * recapita quando arriva il loro momento.
 */

import { normalizza180, normalizza360, NODO_MS } from '../../../../shared/units.js';
import { rilevamento } from '../../../../shared/geo.js';
import { guadagnoFascio, rumoreProprioSferaA, sigmaRilevamento, sommaDb } from './acustica.js';
import { perdita } from './perdita.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */

/**
 * Un'entita' che puo' rimandare un'eco.
 * @typedef {{id: string, tipo: string, x: number, y: number, z: number, rotta: number,
 *   posizioneAcustica: () => {x: number, y: number, z: number},
 *   forzaBersaglio?: (cosAspetto: number) => number}} Riflettente
 */

/**
 * Qualcosa da recapitare piu' tardi a un battello.
 * @typedef {object} Consegna
 * @property {number} ora  s di gioco d'arrivo
 * @property {Battello} a  il destinatario
 * @property {'eco' | 'intercetto' | 'transitorio' | null} tipo  messaggio (null = solo rapporto)
 * @property {Record<string, unknown> | null} campi
 * @property {{chi: 'sonar' | 'guardia', chiave: string, parametri: Record<string, string | number | boolean | null>} | null} rapporto
 * @property {Record<string, unknown>[]} diario  eventi da scrivere all'arrivo (con la loro `ora`)
 */

/**
 * Velocita' del vento per uno stato del mare (la scala nozionale di 05 §3.4).
 * @param {number} statoMare
 */
export function ventoDiMare(statoMare) {
  return 2 * Math.max(0, statoMare) + 0.5;
}

/**
 * Forza di retrodiffusione della superficie, Chapman-Harris ([ZHANG04]).
 * @param {number} radenza gradi
 * @param {number} vento m/s
 * @param {number} f Hz
 * @param {number} minimo dB
 */
export function retrodiffusioneSuperficie(radenza, vento, f, minimo) {
  const beta = 107 * (Math.max(0.5, vento) * Math.cbrt(f)) ** -0.58;
  const bs = 3.3 * beta * Math.log10(Math.max(0.05, radenza) / 30) - 42.4 * Math.log10(beta) + 2.6;
  return Math.max(minimo, Math.min(-10, bs));
}

/**
 * Guadagno della trasmissione verso un rilevamento vero.
 * @param {Battello} b
 * @param {number} psi rilevamento vero verso il punto
 * @param {number | null} puntato rilevamento del fascio, o null per tutto il settore
 * @param {ValoriAcustica} ac
 */
export function guadagnoTrasmissione(b, psi, puntato, ac) {
  const sa = b.p.sensori.sfera_attiva;
  const settore = sa.settore ?? 60;
  const relPrua = Math.abs(normalizza180(psi - b.rotta));
  const retro = ac.attivo.retro_trasmissione;
  if (puntato === null) {
    const base = -(sa.perdita_settore ?? 10);
    return relPrua <= settore ? base : base + retro;
  }
  const g = guadagnoFascio(normalizza180(psi - puntato), sa.fascio ?? 6, ac.attivo.lobi_trasmissione);
  return relPrua <= settore + (sa.fascio ?? 6) ? g : Math.min(g, retro);
}

/**
 * I parametri di un ping: frequenza, livello, durata dell'impulso, finestra, trasduttore.
 * @param {Battello} b
 * @param {'corta' | 'lunga'} portata
 * @param {ValoriAcustica} ac
 */
export function parametriPing(b, portata, ac) {
  const sa = b.p.sensori.sfera_attiva;
  const lunga = portata === 'lunga';
  return {
    f: sa.frequenza ?? 3500,
    sl: sa.livello_sorgente ?? 220,
    tau: (lunga ? sa.durata_lunga : sa.durata_corta) ?? (lunga ? 1 : 0.1),
    ascolto: (lunga ? sa.ascolto_lunga : sa.ascolto_corta) ?? (lunga ? 36576 : 9144),
    pos: { x: b.x, y: b.y, z: Math.max(1, b.z - ac.sottomarini.elica_sopra_chiglia) },
  };
}

/**
 * L'eccesso di segnale medio (senza fluttuazione) dell'eco di un'entita', o
 * null se cade nei baffles della sfera. La stessa equazione la usano il ping
 * e la taratura (docs/CALIBRAZIONE_F2.md).
 * @param {Battello} b  chi pinga
 * @param {Riflettente} e
 * @param {{rilevamento: number | null, portata: 'corta' | 'lunga'}} richiesto
 * @param {ValoriAcustica} ac
 * @param {Ambiente} amb
 * @param {number} statoMare
 * @returns {{se: number, d: number, psi: number, rl: number, rumore: number} | null}
 */
export function eccessoEco(b, e, richiesto, ac, amb, statoMare) {
  const { f, sl, tau, pos } = parametriPing(b, richiesto.portata, ac);
  const sa = b.p.sensori.sfera_attiva;
  const sfera = b.p.sensori.sfera;
  const pe = e.posizioneAcustica();
  const d = Math.max(1, Math.hypot(pe.x - pos.x, pe.y - pos.y, pe.z - pos.z));
  const psi = rilevamento(pos, pe);
  if (Math.abs(normalizza180(psi - b.rotta - 180)) < (sfera.arco_baffles ?? 60) / 2) return null; // nei baffles non si riceve
  const fascioRx = sa.fascio ?? 6;
  const diRx = Math.max(0, (sfera.indice_direttivita ?? 25) + 20 * Math.log10(f / (sfera.frequenza_rif ?? 2000)));
  const banda = 1 / tau;
  const rumore = sommaDb(amb.rumore(f), rumoreProprioSferaA(b.p, ac, f, b.velocita, b.cavitante)) + 10 * Math.log10(banda) - diRx;
  const dtEco = 5 * Math.log10(ac.rivelazione.indice_d / (banda * tau));
  const gTx = guadagnoTrasmissione(b, psi, richiesto.rilevamento, ac);
  const tl = perdita(ac, amb, f, pos, pe);
  const verso = rilevamento(pe, pos);
  const cosAsp = Math.cos((verso - e.rotta) * Math.PI / 180);
  const energia = sl + gTx - 2 * tl + /** @type {NonNullable<Riflettente['forzaBersaglio']>} */ (e.forzaBersaglio)(cosAsp);
  const rl = riverberazione({
    ac, amb, f, sl: sl + gTx, pos, psi, d, tau, phi: fascioRx * Math.PI / 180,
    psiV: (ac.attivo.angolo_verticale ?? 7.2) * Math.PI / 180, vento: ventoDiMare(statoMare), R: ac.riverberazione,
  });
  // Doppler: un bersaglio che si avvicina o si allontana sposta l'eco fuori dallo spettro
  // della riverberazione (ferma); con l'impulso lungo (banda stretta) il guadagno e' grande.
  const th = psi * Math.PI / 180;
  const vb = b.velocita * NODO_MS;
  const ve = (/** @type {any} */ (e).velocita ?? 0) * NODO_MS;
  const avvicinamento = vb * Math.cos((b.rotta - psi) * Math.PI / 180) - ve * Math.cos(((e.rotta ?? 0) * Math.PI / 180) - th);
  const doppler = Math.abs(2 * avvicinamento / ac.attivo.velocita_suono * f);
  const guadagnoDoppler = doppler * tau > 1 ? Math.min(ac.attivo.guadagno_doppler_max ?? 20, 10 * Math.log10(doppler * tau)) : 0;
  const rlEff = rl - guadagnoDoppler;
  return { se: energia - sommaDb(rumore, rlEff) - dtEco, d, psi, rl: rlEff, rumore };
}

/**
 * L'eccesso di segnale medio con cui un ricevitore d'intercettazione sente il
 * ping, o null se il ricevitore non c'e' o non copre la frequenza.
 * @param {Battello} b  chi pinga
 * @param {Battello} altro  chi ascolta
 * @param {{rilevamento: number | null, portata: 'corta' | 'lunga'}} richiesto
 * @param {ValoriAcustica} ac
 * @param {Ambiente} amb
 * @returns {{se: number, d: number} | null}
 */
export function eccessoIntercetto(b, altro, richiesto, ac, amb) {
  const { f, sl, tau, pos } = parametriPing(b, richiesto.portata, ac);
  const ri = altro.p.sensori.intercettazione;
  if (!ri.presente || f < (ri.banda_min ?? 0) || f > (ri.banda_max ?? Infinity)) return null;
  const pr = { x: altro.x, y: altro.y, z: Math.max(1, altro.z - ac.sottomarini.elica_sopra_chiglia) };
  const d = Math.max(1, Math.hypot(pr.x - pos.x, pr.y - pos.y, pr.z - pos.z));
  const gTx = guadagnoTrasmissione(b, rilevamento(pos, pr), richiesto.rilevamento, ac);
  const tl = perdita(ac, amb, f, pos, pr);
  const bc = ri.banda_canale ?? 100;
  const nl = sommaDb(amb.rumore(f), rumoreProprioSferaA(altro.p, ac, f, altro.velocita, altro.cavitante));
  const se = sl + gTx - tl - (nl + 10 * Math.log10(bc) - (ri.indice_direttivita ?? 0)) - 5 * Math.log10(ac.rivelazione.indice_d / (bc * tau));
  return { se, d };
}

/**
 * Esegue un ping: echi per chi pinga, intercettazioni per gli altri battelli.
 * @param {object} a
 * @param {number} a.ora  s di gioco del ping
 * @param {Battello} a.battello  chi pinga (con `attivo.richiesto`)
 * @param {Riflettente[]} a.entita  tutte le entita' della partita
 * @param {ValoriAcustica} a.ac
 * @param {Ambiente} a.amb
 * @param {Generatore} a.rng  sotto-flusso del ping (fluttuazioni ed errori)
 * @param {number} a.statoMare
 * @returns {{ping: number, finestra: number, consegne: Consegna[], diario: Record<string, unknown>[]}}
 */
export function eseguiPing(a) {
  const { ora, battello: b, ac, amb, rng } = a;
  const richiesto = /** @type {NonNullable<Battello['attivo']['richiesto']>} */ (b.attivo.richiesto);
  b.attivo.richiesto = null;
  const sa = b.p.sensori.sfera_attiva;
  const c = ac.attivo.velocita_suono;
  const { f, tau, ascolto } = parametriPing(b, richiesto.portata, ac);
  const finestra = 2 * ascolto / c;
  const n = ++b.attivo.ping;
  b.attivo.ascolto = finestra;
  const sigmaFl = ac.rivelazione.fluttuazione_sigma;

  /** @type {Consegna[]} */
  const consegne = [];
  /** @type {Record<string, unknown>[]} */
  const diario = [{ evento: 'ping', sorgente: b.id, rilevamento: richiesto.rilevamento, portata: richiesto.portata, ping: n, frequenza: f }];

  // --- Echi: ricevuti dalla sfera con il fascio attivo.
  const fascioRx = sa.fascio ?? 6;
  let echi = 0;
  for (const e of a.entita) {
    if (e === /** @type {unknown} */ (b) || !e.forzaBersaglio) continue;
    const x = rng.gaussiana(0, sigmaFl);
    const ec = eccessoEco(b, e, richiesto, ac, amb, a.statoMare);
    if (!ec || ec.d > ascolto) continue;
    const se = ec.se + x;
    if (se < 0) continue;
    echi++;
    const d = ec.d;
    const sigmaR = (ac.attivo.frazione_risoluzione ?? 0.5) * (c * tau / 2) * 10 ** (-se / 20) + ac.attivo.sigma_distanza_relativa * d;
    const misurata = Math.max(1, Math.round(d + sigmaR * rng.gaussiana()));
    const sigmaTh = sigmaRilevamento(se, fascioRx, 0.5, sa.sigma_min ?? 1);
    const rilMis = Math.round(normalizza360(ec.psi + sigmaTh * rng.gaussiana()) * 10) / 10;
    const arrivo = arrotonda(ora + 2 * d / c, 1);
    consegne.push({
      ora: arrivo, a: b, tipo: 'eco',
      campi: { ora: arrivo, ping: n, rilevamento: rilMis, distanza: misurata, forza: Math.round(se * 2) / 2, riverbero: Math.round(ec.rl - ec.rumore) },
      rapporto: { chi: 'sonar', chiave: 'sonar.eco', parametri: { rilevamento: Math.round(rilMis) % 360, distanza: misurata } },
      diario: [{ ora: arrivo, evento: 'eco', osservatore: b.id, sorgente: e.id, distanza_vera: d, ping: n, distanza_misurata: misurata, se }],
    });
  }
  consegne.push({
    ora: arrotonda(ora + finestra, 1), a: b, tipo: null, campi: null,
    rapporto: { chi: 'sonar', chiave: 'sonar.fine_ascolto', parametri: { echi } }, diario: [],
  });

  // --- Intercettazioni: ogni battello con un ricevitore che copre la frequenza.
  for (const e of a.entita) {
    if (e === /** @type {unknown} */ (b) || e.tipo !== 'sottomarino') continue;
    const altro = /** @type {Battello} */ (/** @type {unknown} */ (e));
    const x = rng.gaussiana(0, sigmaFl);
    const ic = eccessoIntercetto(b, altro, richiesto, ac, amb);
    if (!ic) continue;
    const se = ic.se + x;
    if (se < 0) continue;
    const ri = altro.p.sensori.intercettazione;
    const sigma = f < 10000 ? (ri.sigma_bassa ?? 5) : f < 30000 ? (ri.sigma_media ?? 10) : (ri.sigma_alta ?? 45);
    const verso = rilevamento(altro, b);
    const rilMis = Math.round(normalizza360(verso + sigma * rng.gaussiana())) % 360;
    const fMis = Math.round(f * (1 + 0.01 * rng.gaussiana()) / 100) / 10;
    const arrivo = arrotonda(ora + ic.d / c, 1);
    consegne.push({
      ora: arrivo, a: altro, tipo: 'intercetto',
      campi: { ora: arrivo, rilevamento: rilMis, tipo: 'ping', frequenza_khz: fMis, livello: Math.round(se) },
      rapporto: { chi: 'sonar', chiave: 'intercetto.ping', parametri: { rilevamento: rilMis, frequenza_khz: fMis } },
      diario: [
        { ora: arrivo, evento: 'intercetto', osservatore: altro.id, emettitore: b.id, tipo: 'ping', distanza_vera: ic.d, livello: se },
        { ora: arrivo, evento: 'controscoperta', ascoltatore: altro.id, sorgente: b.id, causa: 'ping', distanza_vera: ic.d, sensore: 'intercettazione' },
      ],
    });
  }
  return { ping: n, finestra, consegne, diario };
}

/**
 * Livello della riverberazione (superficie, fondo, volume) alla distanza d,
 * nella cella di risoluzione c·τ/2 sotto il fascio di ricezione, dB re 1 µPa².
 * @param {object} a
 * @param {ValoriAcustica} a.ac @param {Ambiente} a.amb @param {number} a.f
 * @param {number} a.sl  livello trasmesso in quella direzione
 * @param {{x: number, y: number, z: number}} a.pos  trasduttore
 * @param {number} a.psi  rilevamento vero
 * @param {number} a.d  distanza, m
 * @param {number} a.tau  durata dell'impulso, s
 * @param {number} a.phi  fascio orizzontale di ricezione, rad
 * @param {number} a.psiV  fascio verticale, rad
 * @param {number} a.vento  m/s
 * @param {ValoriAcustica['riverberazione']} a.R
 */
export function riverberazione(a) {
  const { ac, amb, f, pos, psi, d, tau, phi, psiV, vento, R } = a;
  const c = ac.attivo.velocita_suono;
  const th = psi * Math.PI / 180;
  const punto = { x: pos.x + d * Math.sin(th), y: pos.y + d * Math.cos(th), z: pos.z };
  const tl = perdita(ac, amb, f, pos, punto);
  const H = Math.max(2, amb.profondita((pos.x + punto.x) / 2, (pos.y + punto.y) / 2));
  const area = (c * tau / 2) * d * phi;
  const radSup = Math.atan2(pos.z, d) * 180 / Math.PI;
  const radFondo = Math.atan2(Math.max(1, H - pos.z), d);
  const sSup = retrodiffusioneSuperficie(radSup, vento, f, R.superficie_minima);
  const sFondo = R.lambert_mu + 10 * Math.log10(Math.max(1e-12, Math.sin(radFondo) ** 2));
  const volume = (c * tau / 2) * d * phi * Math.min(d * psiV, H);
  // Il fascio verticale (andata e ritorno) pesa le superfici: da vicino la superficie e il
  // fondo stanno fuori dal fascio, che li tocca solo da lontano.
  const larghezzaV = psiV * 180 / Math.PI;
  const lobi = ac.attivo.lobi_trasmissione;
  const vSup = 2 * guadagnoFascio(radSup, larghezzaV, lobi);
  const vFondo = 2 * guadagnoFascio(radFondo * 180 / Math.PI, larghezzaV, lobi);
  const lin = 10 ** ((sSup + vSup + 10 * Math.log10(area)) / 10)
    + 10 ** ((sFondo + vFondo + 10 * Math.log10(area)) / 10)
    + 10 ** ((R.volume + 10 * Math.log10(volume)) / 10);
  return a.sl - 2 * tl + 10 * Math.log10(lin);
}

/**
 * @param {number} v @param {number} cifre
 */
function arrotonda(v, cifre) {
  const k = 10 ** cifre;
  return Math.round(v * k) / k;
}
