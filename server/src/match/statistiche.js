// @ts-check
/**
 * Le statistiche di una partita dal suo diario (PROGETTO §7.9, decisione D16):
 * il prototipo su cui F6 costruira' le pagine «Stato di servizio». Si
 * calcolano SOLO dal diario e dalle istantanee della verita' (mai da quello
 * che dichiara il client), a partita chiusa: qui la nebbia e' alzata.
 *
 *   const d = await leggiDiario('/percorso/partita.jsonl.gz');
 *   const s = statistiche(d);   // {partita, battelli: {b1: {...}, b2: {...}}}
 *
 * Il calcolo e' una funzione pura del diario: una statistica aggiunta in
 * futuro si riempie anche per le partite gia' giocate (`stats:ricalcola`).
 *
 * Primo gruppo (F2), per battello:
 *  - servizio: ingresso, uscita, durata, miglia percorse, quota massima,
 *    tempo in immersione, velocita' media;
 *  - ascolto: vantaggio di rilevamento contro ogni altro sottomarino (chi ha
 *    sentito chi per primo, con quanto anticipo e a che distanza), distanze di
 *    prima scoperta per sensore, contatti tracciati e falsi contatti, tempo e
 *    correttezza della classificazione, tempo per arrivare a Q ≥ 70, errore
 *    di distanza dell'ultima soluzione;
 *  - discrezione: tempo in cavitazione, sopra e sotto lo strato, a quota
 *    periscopica; ping emessi; controscoperte subite per causa.
 */

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip } from 'node:zlib';

/** @typedef {import('./diario.js').Evento} Evento */

/**
 * @typedef {object} RigaVerita
 * @property {number} ora
 * @property {{id: string, tipo: string, x: number, y: number, z: number, velocita?: number, cavitante?: boolean}[]} entita
 */

/**
 * @typedef {object} Diario
 * @property {Record<string, unknown> | null} intestazione
 * @property {Evento[]} eventi
 * @property {RigaVerita[]} verita
 */

/** Soglia di Q della soluzione di tiro (shared/tma.js, Q_TIRO). */
const Q_TIRO = 70;
/** m in un miglio nautico. */
const MIGLIO = 1852;

/**
 * Legge il file delle istantanee di una partita (.jsonl.gz, o .jsonl).
 * @param {string} percorso
 * @returns {Promise<Diario>}
 */
export async function leggiDiario(percorso) {
  const sorgente = createReadStream(percorso);
  const flusso = percorso.endsWith('.gz') ? sorgente.pipe(createGunzip()) : sorgente;
  const righe = createInterface({ input: flusso, crlfDelay: Infinity });
  /** @type {Diario} */
  const d = { intestazione: null, eventi: [], verita: [] };
  for await (const riga of righe) {
    if (!riga.trim()) continue;
    let o;
    try { o = JSON.parse(riga); } catch { continue; } // l'ultima riga di un file troncato
    dividi(o, d);
  }
  return d;
}

/**
 * Le righe gia' in memoria (per esempio quelle di un registro di prova).
 * @param {Iterable<Record<string, unknown>>} righe
 * @returns {Diario}
 */
export function diarioDaRighe(righe) {
  /** @type {Diario} */
  const d = { intestazione: null, eventi: [], verita: [] };
  for (const o of righe) dividi(o, d);
  return d;
}

/** @param {any} o @param {Diario} d */
function dividi(o, d) {
  if (o.formato) d.intestazione = o;
  else if (typeof o.evento === 'string') d.eventi.push(o);
  else if (Array.isArray(o.entita)) d.verita.push(o);
}

/**
 * La durata (s) in cui uno stato e' vero, dagli eventi che lo accendono e lo
 * spengono, fra `da` e `a`.
 * @param {{ora: number, attivo: boolean}[]} cambi  in ordine di tempo
 * @param {number} da @param {number} a
 * @param {boolean} [iniziale]
 */
function durataVera(cambi, da, a, iniziale = false) {
  let stato = iniziale;
  let dal = da;
  let tot = 0;
  for (const c of cambi) {
    if (c.ora < da || c.ora > a) continue;
    if (stato && !c.attivo) tot += c.ora - dal;
    if (!stato && c.attivo) dal = c.ora;
    stato = c.attivo;
  }
  if (stato) tot += a - dal;
  return tot;
}

/** @param {number[]} v */
function media(v) {
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** @param {number | null} v @param {number} [cifre] */
function tondo(v, cifre = 1) {
  if (v === null || !Number.isFinite(v)) return null;
  const k = 10 ** cifre;
  return Math.round(v * k) / k;
}

/**
 * Le statistiche di una partita.
 * @param {Diario} d
 */
export function statistiche(d) {
  const ev = [...d.eventi].sort((a, b) => a.ora - b.ora);
  const fine = Math.max(
    d.verita.length ? d.verita[d.verita.length - 1].ora : 0,
    ev.length ? ev[ev.length - 1].ora : 0,
  );
  /** @param {string} tipo */
  const di = (tipo) => ev.filter((e) => e.evento === tipo);
  /** @type {Record<string, any>} */
  const battelli = {};
  const entrate = di('entra');
  const sottomarini = new Set(entrate.map((e) => /** @type {string} */ (e.battello)));

  for (const e of entrate) {
    const id = /** @type {string} */ (e.battello);
    const uscita = ev.find((x) => x.evento === 'esce' && x.battello === id && x.ora >= e.ora);
    const da = e.ora;
    const a = uscita ? uscita.ora : fine;

    // --- servizio, dalla verita' al secondo ---
    let metri = 0;
    let quotaMax = 0;
    let immerso = 0;
    /** @type {number[]} */
    const velocita = [];
    let cavitazioneVerita = 0;
    /** @type {{x: number, y: number} | null} */
    let prec = null;
    for (const r of d.verita) {
      if (r.ora < da || r.ora > a) continue;
      const v = r.entita.find((x) => x.id === id);
      if (!v) continue;
      if (prec) metri += Math.hypot(v.x - prec.x, v.y - prec.y);
      prec = v;
      quotaMax = Math.max(quotaMax, v.z);
      if (v.z > 15) immerso++;
      if (typeof v.velocita === 'number') velocita.push(Math.abs(v.velocita));
      if (v.cavitante) cavitazioneVerita++;
    }

    // --- ascolto ---
    const mie = ev.filter((x) => x.osservatore === id);
    const scoperte = mie.filter((x) => x.evento === 'scoperta');
    const designate = scoperte.filter((x) => x.prima);
    /** @type {Record<string, {n: number, distanze: number[]}>} */
    const perSensore = {};
    const giaViste = new Set();
    for (const s of scoperte) {
      if (s.sorgente === null || typeof s.distanza_vera !== 'number') continue;
      const chiave = `${s.sorgente}:${s.sensore}`;
      if (giaViste.has(chiave)) continue; // la prima scoperta di quella sorgente su quel sensore
      giaViste.add(chiave);
      const p = (perSensore[/** @type {string} */ (s.sensore)] ??= { n: 0, distanze: [] });
      p.n++;
      p.distanze.push(s.distanza_vera);
    }
    const primeScoperte = Object.fromEntries(Object.entries(perSensore).map(([k, v]) => [k, {
      n: v.n,
      distanza_media: tondo(media(v.distanze), 0),
      distanza_max: tondo(Math.max(...v.distanze), 0),
    }]));

    // vantaggio di rilevamento contro ogni altro sottomarino
    /** @type {any[]} */
    const vantaggi = [];
    for (const altro of sottomarini) {
      if (altro === id) continue;
      const mia = scoperte.find((x) => x.sorgente === altro);
      const sua = ev.find((x) => x.evento === 'scoperta' && x.osservatore === altro && x.sorgente === id);
      vantaggi.push({
        contro: altro,
        io: mia ? { ora: mia.ora, distanza: tondo(/** @type {number} */ (mia.distanza_vera), 0), sensore: mia.sensore } : null,
        lui: sua ? { ora: sua.ora, distanza: tondo(/** @type {number} */ (sua.distanza_vera), 0), sensore: sua.sensore } : null,
        // positivo = l'ho sentito prima io, di tanti secondi
        anticipo_s: mia && sua ? sua.ora - mia.ora : mia ? a - mia.ora : sua ? -(a - sua.ora) : null,
      });
    }

    const classificazioni = mie.filter((x) => x.evento === 'classificazione');
    const primeClassificazioni = new Map();
    for (const c of classificazioni) if (!primeClassificazioni.has(c.contatto)) primeClassificazioni.set(c.contatto, c);
    const cls = [...primeClassificazioni.values()];

    const soluzioni = mie.filter((x) => x.evento === 'soluzione');
    /** @type {number[]} */
    const tempiQ70 = [];
    /** @type {number[]} */
    const erroriFinali = [];
    /** @type {number[]} */
    const erroriTiro = [];
    for (const s of designate) {
      const delContatto = soluzioni.filter((x) => x.contatto === s.contatto && !x.esatta);
      const q70 = delContatto.find((x) => typeof x.q === 'number' && x.q >= Q_TIRO);
      if (q70) tempiQ70.push(q70.ora - s.ora);
      const ultima = delContatto[delContatto.length - 1];
      if (ultima && typeof ultima.errore_distanza_pct === 'number') erroriFinali.push(Math.abs(ultima.errore_distanza_pct));
      const tiro = delContatto.filter((x) => typeof x.q === 'number' && x.q >= Q_TIRO && typeof x.errore_distanza_pct === 'number');
      if (tiro.length) erroriTiro.push(Math.abs(/** @type {number} */ (tiro[tiro.length - 1].errore_distanza_pct)));
    }

    // --- discrezione ---
    const miei = ev.filter((x) => x.battello === id);
    /** @param {string} tipo @param {string} campo */
    const cambi = (tipo, campo) => miei.filter((x) => x.evento === tipo).map((x) => ({ ora: x.ora, attivo: x[campo] === true }));
    const strati = miei.filter((x) => x.evento === 'strato');
    const tempoSotto = durataVera(strati.map((x) => ({ ora: x.ora, attivo: x.sotto === true })), da, a);
    // senza strato (quota_strato null) non si e' ne' sopra ne' sotto
    const tempoSenzaStrato = durataVera(strati.map((x) => ({ ora: x.ora, attivo: x.quota_strato === null })), da, a, strati.length === 0);
    /** @type {Record<string, number>} */
    const controscoperte = {};
    for (const c of ev.filter((x) => x.evento === 'controscoperta' && x.sorgente === id)) {
      const causa = /** @type {string} */ (c.causa);
      controscoperte[causa] = (controscoperte[causa] ?? 0) + 1;
    }
    const tempoCavitazione = cambi('cavitazione', 'attiva').length
      ? durataVera(cambi('cavitazione', 'attiva'), da, a)
      : cavitazioneVerita;

    battelli[id] = {
      uid: e.uid ?? null,
      piattaforma: e.piattaforma ?? null,
      lato: e.lato ?? null,
      assistenza: e.assistenza ?? null,
      servizio: {
        ingresso: da,
        uscita: uscita ? uscita.ora : null,
        durata_s: tondo(a - da, 0),
        miglia: tondo(metri / MIGLIO, 2),
        quota_max: tondo(quotaMax, 0),
        tempo_immersione_s: immerso,
        velocita_media_kt: tondo(media(velocita), 1),
      },
      ascolto: {
        vantaggio: vantaggi,
        prime_scoperte: primeScoperte,
        contatti: designate.length,
        falsi_contatti: designate.filter((x) => x.sorgente === null).length,
        classificazione: {
          n: cls.length,
          corrette: cls.filter((x) => x.corretta === true).length,
          dal_comandante: cls.filter((x) => x.da === 'comandante').length,
          tempo_medio_s: tondo(media(cls.filter((x) => x.da === 'equipaggio').map((x) => /** @type {number} */ (x.secondi))), 0),
        },
        tempo_q70_s: { n: tempiQ70.length, medio: tondo(media(tempiQ70), 0), minimo: tempiQ70.length ? Math.min(...tempiQ70) : null },
        // errore di distanza dell'ultima soluzione di ogni contatto, e dell'ultima con Q ≥ 70
        // (quella su cui si sarebbe lanciato: da F3 la si leggera' all'evento di lancio)
        errore_soluzione_pct: { n: erroriFinali.length, medio: tondo(media(erroriFinali), 1) },
        errore_soluzione_tiro_pct: { n: erroriTiro.length, medio: tondo(media(erroriTiro), 1) },
      },
      discrezione: {
        tempo_cavitazione_s: tondo(tempoCavitazione, 0),
        tempo_sotto_strato_s: tondo(tempoSotto, 0),
        tempo_sopra_strato_s: tondo(Math.max(0, a - da - tempoSotto - tempoSenzaStrato), 0),
        tempo_periscopica_s: tondo(durataVera(cambi('periscopica', 'attiva'), da, a), 0),
        ping: ev.filter((x) => x.evento === 'ping' && x.sorgente === id).length,
        controscoperte,
      },
    };
  }

  return {
    partita: {
      id: d.intestazione?.partita ?? null,
      scenario: d.intestazione?.scenario ?? null,
      durata_s: fine,
      eventi: ev.length,
      eventi_per_tipo: Object.fromEntries([...new Set(ev.map((x) => x.evento))].sort().map((t) => [t, di(t).length])),
      difetti: ev.filter((x) => x.difetto).length,
    },
    battelli,
  };
}
