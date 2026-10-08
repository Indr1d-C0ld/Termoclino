// @ts-check
/**
 * L'equipaggio di un battello: il sonarista che forma e classifica le
 * tracce, la centrale di tiro che fa la TMA secondo il livello di assistenza,
 * e gli avvisi di chi sta in camera di manovra (F1).
 *
 * NEBBIA DI GUERRA. L'equipaggio non sa nulla della verita': lavora sui byte
 * dei fotogrammi e degli spettri (gli stessi che riceve il giocatore), sui
 * messaggi di misura dei sensori, sui dati dei propri sensori e sulla propria
 * navigazione. Per questo i rilevamenti dei rapporti e delle `tracce` vengono
 * dalle misure, le designazioni (S1, S2… sul 688; Ц1, Ц2… sull'Alfa) sono sue,
 * le classi e le soluzioni sono ipotesi. Un contatto perso e ritrovato e' un
 * contatto nuovo; due bersagli sotto lo stesso fascio sono una traccia sola.
 *
 * Il lavoro (chiamato dalla partita):
 *  - `ogniSecondo(ingressi, amb, ora)`: fotogrammi (banda larga ogni secondo,
 *    banda stretta ogni 4 s), transitori riconosciuti, uno sguardo allo
 *    spettro delle tracce da classificare; ogni 10 s la centrale di tiro.
 *    Restituisce i rapporti; i fatti per il diario (senza verita') restano in
 *    `fatti` e le soluzioni da mandare in `soluzioni`;
 *  - `messaggioTracce(ora)`: il messaggio `tracce` (ogni 4 s);
 *  - `ordine(o, ora)`: assistenza, designa, classifica, soluzione, abbandona;
 *  - `puntamento(contatto)`: dove puntare l'analizzatore (per i sensori).
 */

import { differenzaAngolare } from '../../../../shared/units.js';
import { daPolare, norm180, norm360 } from '../../../../shared/tma.js';
import { picchi, Tracciatore, TRACCE } from './tracce.js';
import { Classificatore, statoDi } from './classificazione.js';
import { Centrale, CENTRALE, tmaDi } from './centrale.js';

/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../platform/battello.js').Rapporto} Rapporto */
/** @typedef {import('../sensors/passivo.js').Fotogramma} Fotogramma */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('./tracce.js').Traccia} Traccia */
/** @typedef {import('./tracce.js').Fatto} FattoTracce */
/** @typedef {import('./tracce.js').Schiera} Schiera */
/** @typedef {import('./centrale.js').SoluzioneMsg} SoluzioneMsg */
/** @typedef {import('./centrale.js').FattoCentrale} FattoCentrale */
/** @typedef {import('./classificazione.js').Spettro} Spettro */
/** @typedef {import('../../../../shared/data/firme.js').VoceBiblioteca} VoceBiblioteca */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */

/** Prefisso delle designazioni per lato: Sierra sul 688, Ц («цель», bersaglio) sull'Alfa. */
export const PREFISSI = Object.freeze(/** @type {Record<string, string>} */ ({ usa: 'S', urss: 'Ц' }));

/** Al piu' quante tracce in un messaggio `tracce` (le piu' recenti). */
const TRACCE_PER_MESSAGGIO = 40;

/**
 * I picchi di un fotogramma (rilevamenti veri): l'estrazione di F1, ora in
 * tracce.js con il SE di ogni picco.
 * @param {Uint8Array} settori
 * @param {number} fascio gradi
 * @returns {number[]}
 */
export function trovaPicchi(settori, fascio) {
  return picchi(settori, fascio).map((p) => p.rilevamento);
}

/**
 * Fatti dell'equipaggio per il diario (senza verita'): quelli del
 * tracciatore, della centrale e questi.
 * @typedef {FattoTracce | FattoCentrale
 *   | {tipo: 'classificazione', traccia: Traccia, classe: string | null, confidenza: number | null, da: 'equipaggio' | 'comandante'}
 *   | {tipo: 'soluzione_comandante', traccia: Traccia, soluzione: SoluzioneMsg | null}
 *   | {tipo: 'abbandono', traccia: Traccia}
 *   | {tipo: 'assistenza', livello: number}} Fatto
 */

/**
 * Cio' che arriva all'equipaggio in un secondo.
 * @typedef {object} Ingressi
 * @property {Fotogramma | null} sfera  banda larga
 * @property {Fotogramma | null} towed
 * @property {{sfera: Fotogramma | null, towed: Fotogramma | null} | null} [stretta]  banda stretta (ogni 4 s)
 * @property {{rilevamento: number, tipo: string, sensore?: string}[]} [transitori]  riconosciuti dal sonarista
 * @property {((sensore: 'sfera' | 'towed', rilevamento: number) => Spettro | null) | null} [ascolta]
 *   lo spettro del fascio puntato su un rilevamento (per classificare)
 */

/**
 * L'equipaggio di un battello.
 */
export class Equipaggio {
  /**
   * @param {Battello} battello
   * @param {object} a
   * @param {{sfera: Schiera | null, towed: Schiera | null}} a.schiere  i propri sensori
   * @param {Map<string, VoceBiblioteca>} [a.biblioteca]  la biblioteca delle firme
   * @param {Generatore} a.rng  sotto-flusso dell'equipaggio (errori di classificazione)
   * @param {number} [a.livello]  livello di assistenza (2)
   * @param {string} [a.lato]  'usa' | 'urss' (designazioni)
   */
  constructor(battello, a) {
    this.b = battello;
    let numero = 0;
    const prefisso = PREFISSI[a.lato ?? 'usa'] ?? 'S';
    this.tracciatore = new Tracciatore({ schiere: a.schiere, designa: () => `${prefisso}${++numero}` });
    this.classificatore = new Classificatore({ biblioteca: a.biblioteca ?? new Map(), rng: a.rng });
    this.centrale = new Centrale({ livello: a.livello ?? 2 });
    /** @type {string | null} il contatto designato dal comandante */
    this.designato = null;
    /** @type {Fatto[]} fatti per il diario, raccolti dalla partita a ogni secondo */
    this.fatti = [];
    /** @type {SoluzioneMsg[]} soluzioni da mandare (riempite ogni 10 s e dagli ordini) */
    this.soluzioni = [];

    // F1: avvisi e timoniere.
    /** @type {Set<string>} avvisi in corso */
    this.attivi = new Set();
    this.cavitazioneDa = 0;
    this.cavitazioneRiferita = false;
    /** @type {number | null} */ this.rottaSeguita = null;
    this.rottaInAttesa = false;
    /** @type {number | null} */ this.quotaSeguita = null;
    this.quotaInAttesa = false;
    this.fondaleAvantiLibero = 0;
  }

  /** Il livello di assistenza in vigore. */
  get livello() {
    return this.centrale.livello;
  }

  /** Le tracce designate (anche perse da poco). */
  get tracce() {
    return this.tracciatore.designate;
  }

  /**
   * Un secondo di lavoro dell'equipaggio.
   * @param {Ingressi} ingressi
   * @param {Ambiente} amb
   * @param {number} [ora]  ora di gioco (intera)
   * @returns {Rapporto[]}
   */
  ogniSecondo(ingressi, amb, ora = 0) {
    /** @type {Rapporto[]} */
    const out = this.b.rapporti.splice(0);
    const b = this.b;
    const tr = this.tracciatore;
    const posTowed = b.posizioneTowed() ?? { x: b.x, y: b.y };
    const fattoreTowed = (b.towed?.sigmaDoppia ?? 0) > 0 ? (b.p.sensori.rimorchiata.fattore_sigma_piccola_accostata ?? 2) : 1;
    tr.fotogramma(ingressi.sfera, 'sfera', 'larga', ora, b);
    tr.fotogramma(ingressi.towed, 'towed', 'larga', ora, posTowed, fattoreTowed);
    if (ingressi.stretta) {
      tr.fotogramma(ingressi.stretta.sfera, 'sfera', 'stretta', ora, b);
      tr.fotogramma(ingressi.stretta.towed, 'towed', 'stretta', ora, posTowed, fattoreTowed);
    }
    tr.fineSecondo(ora);
    this.centrale.campione(ora, b);
    for (const f of tr.fatti.splice(0)) {
      this.fatti.push(f);
      if (f.tipo === 'designata') {
        out.push({
          chi: 'sonar', chiave: 'sonar.nuovo_contatto',
          parametri: {
            contatto: /** @type {string} */ (f.traccia.contatto), sensore: f.sensore,
            rilevamento: Math.round(f.rilevamento) % 360,
            speculare: f.traccia.ambigua ? Math.round(/** @type {number} */ (f.traccia.stima(ora).speculare)) % 360 : null,
          },
        });
      } else if (f.tipo === 'persa') {
        out.push({ chi: 'sonar', chiave: 'sonar.contatto_perso', parametri: { contatto: /** @type {string} */ (f.traccia.contatto), sensore: f.traccia.ultimoSensore } });
      }
    }

    // Classificazione: transitori riconosciuti e sguardi allo spettro.
    for (const x of ingressi.transitori ?? []) {
      const t = this._tracciaSu(x.rilevamento, ora, 6);
      if (t) this.classificatore.transitorio(t, x.tipo, ora);
    }
    if (ingressi.ascolta) {
      for (const t of this.tracce) {
        if (t.stato === 'persa' || !this.classificatore.vuoleGuardare(t, ora)) continue;
        const p = this.puntamento(/** @type {string} */ (t.contatto), ora);
        if (!p) continue;
        const sp = ingressi.ascolta(p.sensore, p.rilevamento);
        if (sp) this.classificatore.sguardo(t, sp, ora);
      }
    }
    for (const t of this.tracce) {
      if (t.stato === 'persa') continue;
      const d = this.classificatore.decidi(t, ora);
      if (!d) continue;
      this.fatti.push({ tipo: 'classificazione', traccia: t, classe: d.classe, confidenza: d.confidenza, da: 'equipaggio' });
      out.push({ chi: 'sonar', chiave: 'sonar.classificato', parametri: { contatto: /** @type {string} */ (t.contatto), classe: d.classe, confidenza: d.confidenza } });
    }

    // La centrale di tiro, ogni 10 s.
    if (ora % CENTRALE.PERIODO === 0) {
      const r = this.centrale.lavora(ora, this.tracce, { x: b.x, y: b.y, rotta: b.rotta, velocita: b.velocita }, {
        designato: this.designato,
        sigmaFutura: this._sigmaFutura(),
        tempoMorto: this._tempoMorto(),
      });
      out.push(...r.rapporti);
      this.soluzioni.push(...r.soluzioni);
      this.fatti.push(...this.centrale.fatti.splice(0));
    }

    this._avvisi(out, amb);
    this._timoniere(out);
    return out;
  }

  /**
   * La traccia tenuta piu' vicina a un rilevamento (entro `porta` gradi).
   * @param {number} ril @param {number} ora @param {number} porta
   * @returns {Traccia | null}
   */
  _tracciaSu(ril, ora, porta) {
    let migliore = null;
    let d0 = porta;
    for (const t of this.tracce) {
      if (t.stato === 'persa') continue;
      const s = t.stima(ora);
      for (const r of s.speculare === null ? [s.rilevamento] : [s.rilevamento, s.speculare]) {
        const d = Math.abs(norm180(r - ril));
        if (d <= d0) { d0 = d; migliore = t; }
      }
    }
    return migliore;
  }

  /**
   * La σ che i sensori darebbero a un rilevamento relativo (per il consiglio
   * di manovra): l'antenna se c'e' (cieca a prua, peggiore verso gli assi),
   * altrimenti la sfera (cieca nei baffles). Valori tipici a SE ≈ 6 dB.
   * @returns {(relativo: number) => number}
   */
  _sigmaFutura() {
    const b = this.b;
    const rim = b.p.sensori.rimorchiata;
    const sfera = b.p.sensori.sfera;
    const towed = b.towed?.stato === 'filata';
    return (rel) => {
      const a = Math.abs(rel);
      if (towed) {
        if (a < (rim.cieco_prua ?? 20)) return Infinity;
        const dagliAssi = Math.min(a, 180 - a);
        return 1.2 * (dagliAssi < (rim.arco_estremita ?? 30) ? (rim.fattore_sigma_estremita ?? 3) : 1);
      }
      if (180 - a < (sfera.arco_baffles ?? 60) / 2) return Infinity;
      return 1.5;
    };
  }

  /** Il tempo morto dell'antenna dopo un'accostata alla velocita' attuale (s), 0 senza antenna. */
  _tempoMorto() {
    const b = this.b;
    if (b.towed?.stato !== 'filata') return 0;
    const rim = b.p.sensori.rimorchiata;
    const v = Math.max(0.5, Math.abs(b.velocita) * 1852 / 3600);
    return Math.min(rim.tempo_morto_max ?? 480, Math.max(rim.tempo_morto_min ?? 120, b.towed.lunghezza / v));
  }

  /**
   * Il messaggio `tracce`: solo misure e ipotesi dell'equipaggio.
   * @param {number} ora
   */
  messaggioTracce(ora) {
    const elenco = this.tracce.slice(-TRACCE_PER_MESSAGGIO).map((t) => {
      const s = t.stima(ora);
      const cls = statoDi(t);
      const sensori = Object.entries(t.sensori)
        .filter(([, u]) => ora - u <= TRACCE.SENSORE_RECENTE || t.stato === 'persa')
        .map(([k]) => k).sort();
      /** @type {Record<string, unknown>} */
      const voce = {
        contatto: t.contatto,
        sensori,
        rilevamento: Math.round(norm360(s.rilevamento) * 10) / 10 % 360,
        variazione: Math.round(s.variazione * 100) / 100,
        classe: cls.classe,
        confidenza: cls.confidenza,
        stato: t.stato,
      };
      if (s.speculare !== null) voce.speculare = Math.round(norm360(s.speculare) * 10) / 10 % 360;
      return voce;
    });
    return { ora, tracce: elenco };
  }

  /**
   * Dove puntare l'analizzatore su un contatto: la schiera che lo sente
   * meglio adesso (l'antenna se lo tiene da poco, per le righe basse) e il
   * suo rilevamento. null se il contatto non e' tenuto.
   * @param {string} contatto
   * @param {number} [ora]
   * @returns {{sensore: 'sfera' | 'towed', rilevamento: number} | null}
   */
  puntamento(contatto, ora) {
    const t = this.tracciatore.traccia(contatto);
    if (!t || t.stato === 'persa') return null;
    const adesso = ora ?? t.ultima;
    const h = t.ipotesi[0];
    const towed = h.filtri.towed;
    const sfera = h.filtri.sfera;
    const b = this.b;
    const recente = (/** @type {import('./tracce.js').Filtro} */ f) => f.m.length > 0 && adesso - f.ultima <= TRACCE.FINESTRA_FILTRO;
    // l'antenna se sente il contatto, o se e' utile e il contatto (dalla
    // sfera) non le sta nel cono cieco di prua: le righe basse le sente lei
    let f = recente(towed) && b.towed?.stato === 'filata' ? towed : sfera.m.length ? sfera : towed;
    let sensore = /** @type {'sfera' | 'towed'} */ (f === towed ? 'towed' : 'sfera');
    const p = f.predici(adesso);
    if (!p) return null;
    if (sensore === 'sfera' && b.towedUtile) {
      const rel = Math.abs(norm180(p.rilevamento - b.rotta));
      if (rel > (b.p.sensori.rimorchiata.cieco_prua ?? 20) + 5) sensore = 'towed';
    }
    return { sensore, rilevamento: Math.round(p.rilevamento * 10) / 10 % 360 };
  }

  /**
   * Gli ordini dell'equipaggio (gia' validati dal protocollo). Restituisce
   * null se eseguito, altrimenti il motivo del rifiuto.
   * @param {{cosa: string, valore: any}} o
   * @param {number} ora
   * @returns {string | null}
   */
  ordine(o, ora) {
    const v = o.valore;
    switch (o.cosa) {
      case 'assistenza': {
        if (this.centrale.livello !== v) {
          this.centrale.livello = v;
          this.fatti.push({ tipo: 'assistenza', livello: v });
        }
        return null;
      }
      case 'designa': {
        if (v === null) { this.designato = null; return null; }
        if (!this.tracciatore.traccia(v)) return 'contatto';
        this.designato = v;
        return null;
      }
      case 'abbandona': {
        const t = this.tracciatore.traccia(v);
        if (!t) return 'contatto';
        this.tracciatore.togli(t);
        if (this.designato === v) this.designato = null;
        this.fatti.push({ tipo: 'abbandono', traccia: t });
        return null;
      }
      case 'classifica': {
        const t = this.tracciatore.traccia(v.contatto);
        if (!t) return 'contatto';
        this.classificatore.comandante(t, v.classe ?? null);
        this.fatti.push({ tipo: 'classificazione', traccia: t, classe: v.classe ?? null, confidenza: null, da: 'comandante' });
        return null;
      }
      case 'soluzione': {
        const t = this.tracciatore.traccia(v.contatto);
        if (!t) return 'contatto';
        if (v.cancella) {
          this.centrale.comandante(t, null);
          this.fatti.push({ tipo: 'soluzione_comandante', traccia: t, soluzione: null });
          return null;
        }
        const proprio = this.posizioneAllOra(v.ora);
        let ril = v.rilevamento;
        if (ril === undefined || ril === null) {
          const p = t.ipotesi[0].filtri.sfera.m.length ? t.ipotesi[0].filtri.sfera.predici(v.ora) : t.ipotesi[0].filtri.towed.predici(v.ora);
          ril = p ? p.rilevamento : t.stima(ora).rilevamento;
        }
        const sol = daPolare({ ora: v.ora, rilevamento: ril, distanza: v.distanza, rotta: v.rotta, velocita: v.velocita }, proprio);
        this.centrale.comandante(t, sol);
        const msg = this.centrale.messaggioComandante(t, ora, { x: this.b.x, y: this.b.y });
        this.soluzioni.push(msg);
        this.fatti.push({ tipo: 'soluzione_comandante', traccia: t, soluzione: msg });
        return null;
      }
      default:
        return 'cosa';
    }
  }

  /**
   * La propria posizione a un'ora (dalla storia della navigazione; avanti e
   * indietro si estrapola col moto piu' vicino).
   * @param {number} ora
   * @returns {{x: number, y: number}}
   */
  posizioneAllOra(ora) {
    return this.centrale.propri.length ? this.centrale.posizioneAllOra(ora) : { x: this.b.x, y: this.b.y };
  }

  /**
   * Le soluzioni del comandante in vigore (per chi rientra dopo una caduta di linea).
   * @param {number} ora
   * @returns {SoluzioneMsg[]}
   */
  soluzioniComandante(ora) {
    return this.tracce.filter((t) => tmaDi(t).comandante).map((t) => this.centrale.messaggioComandante(t, ora, { x: this.b.x, y: this.b.y }));
  }

  /**
   * La storia tempo-rilevamento delle tracce tenute e risolte, per chi rientra: senza, chi ricarica
   * la pagina perde la pila dei punti della TMA. Sono misure dei propri sensori con la posizione del
   * sensore in quel momento (come in `shared/tma.js`); la rotta propria si ricava dal moto fra due
   * punti consecutivi, che e' quanto serve per riconoscere le gambe.
   * @returns {{ contatto: string, punti: { ora: number, rilevamento: number, x: number, y: number, rotta: number }[] }[]}
   */
  storiaTracce() {
    const out = [];
    for (const t of this.tracce) {
      const punti = t.punti;
      if (!t.contatto || t.stato === 'persa' || !punti || punti.length === 0) continue;
      let rotta = this.b.rotta;
      const righe = punti.map((p, i) => {
        const a = punti[i > 0 ? i - 1 : 0], b = punti[i > 0 ? i : Math.min(1, punti.length - 1)];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.hypot(dx, dy) > 1) rotta = norm360((Math.atan2(dx, dy) * 180) / Math.PI);
        return {
          ora: Math.round(p.ora * 10) / 10,
          rilevamento: Math.round(norm360(p.rilevamento) * 10) / 10,
          x: Math.round(p.x),
          y: Math.round(p.y),
          rotta: Math.round(rotta * 10) / 10,
        };
      });
      out.push({ contatto: t.contatto, punti: righe });
    }
    return out;
  }

  /** Gli avvisi in corso, per `stato.avvisi`. */
  avvisi() {
    return [...this.attivi].sort();
  }

  /**
   * Accende o spegne un avviso; riferisce quando si accende.
   * @param {Rapporto[]} out
   * @param {string} avviso
   * @param {boolean} acceso
   * @param {Rapporto | null} rapporto
   */
  _avviso(out, avviso, acceso, rapporto) {
    if (acceso && !this.attivi.has(avviso)) {
      this.attivi.add(avviso);
      if (rapporto) out.push(rapporto);
    } else if (!acceso) {
      this.attivi.delete(avviso);
    }
  }

  /**
   * @param {Rapporto[]} out
   * @param {Ambiente} amb
   */
  _avvisi(out, amb) {
    const b = this.b;
    const prof = b.p.profondita;
    const v = Math.abs(b.velocita);

    // Cavitazione, con tre secondi di conferma per non sfarfallare.
    if (b.cavitante !== this.cavitazioneRiferita) {
      if (++this.cavitazioneDa >= 3) {
        this.cavitazioneRiferita = b.cavitante;
        this.cavitazioneDa = 0;
        out.push({
          chi: 'macchina',
          chiave: b.cavitante ? 'macchina.cavitazione' : 'macchina.fine_cavitazione',
          parametri: { v_cavitazione: Math.round(b.vCavitazione * 10) / 10 },
        });
      }
    } else {
      this.cavitazioneDa = 0;
    }
    if (this.cavitazioneRiferita) this.attivi.add('cavitazione'); else this.attivi.delete('cavitazione');

    // Quote.
    const vicina = this.attivi.has('quota_collaudo_vicina') ? b.z > 0.85 * prof.collaudo : b.z > 0.9 * prof.collaudo;
    this._avviso(out, 'quota_collaudo_vicina', vicina && b.z <= prof.collaudo,
      { chi: 'guardia', chiave: 'guardia.quota_collaudo_vicina', parametri: { quota: Math.round(b.z), collaudo: prof.collaudo } });
    const oltre = this.attivi.has('oltre_quota_collaudo') ? b.z > 0.97 * prof.collaudo : b.z > prof.collaudo;
    this._avviso(out, 'oltre_quota_collaudo', oltre,
      { chi: 'guardia', chiave: 'guardia.oltre_quota_collaudo', parametri: { quota: Math.round(b.z), collaudo: prof.collaudo } });
    if (oltre) this.attivi.delete('quota_collaudo_vicina');
    this._avviso(out, 'collasso', b.z > prof.collasso, null);

    // Fondale sotto la chiglia.
    const sotto = b.profonditaAcqua - b.z;
    const vicino = this.attivi.has('fondale_vicino') ? sotto < 45 : sotto < 30;
    this._avviso(out, 'fondale_vicino', vicino && !b.inSuperficie,
      { chi: 'navigazione', chiave: 'navigazione.fondale_vicino', parametri: { sotto_chiglia: Math.round(sotto) } });

    // Fondale che sale sulla rotta (l'autopilota non lo guarda, il navigatore si').
    /** @type {{distanza: number, profondita: number} | null} */
    let avanti = null;
    if (v > 1 && !b.inSuperficie) {
      const th = b.rotta * Math.PI / 180;
      for (const d of [250, 500, 1000, 2000]) {
        const h = amb.profondita(b.x + d * Math.sin(th), b.y + d * Math.cos(th));
        if (h < b.z + 10) { avanti = { distanza: d, profondita: Math.round(h) }; break; }
      }
    }
    if (avanti) this.fondaleAvantiLibero = 0; else this.fondaleAvantiLibero++;
    this._avviso(out, 'fondale_avanti', avanti !== null || (this.attivi.has('fondale_avanti') && this.fondaleAvantiLibero < 10),
      avanti ? { chi: 'navigazione', chiave: 'navigazione.fondale_avanti', parametri: avanti } : null);

    // Antenna rimorchiata e velocita'.
    const t = b.towed;
    if (t) {
      const r = b.p.sensori.rimorchiata;
      const fuori = t.stato === 'filata' || t.stato === 'in_filare' || t.stato === 'in_ritiro';
      const vDanno = r.velocita_danno ?? 18;
      const pericolo = fuori && (this.attivi.has('towed_velocita_pericolosa') ? v > vDanno - 1 : v > vDanno);
      this._avviso(out, 'towed_velocita_pericolosa', pericolo,
        { chi: 'guardia', chiave: 'towed.velocita_pericolosa', parametri: { velocita_danno: vDanno } });
      const filata = t.stato === 'filata';
      const sorda = filata && v > (r.velocita_sorda ?? 12);
      this._avviso(out, 'towed_sorda', sorda,
        { chi: 'sonar', chiave: 'towed.sorda', parametri: { velocita: Math.round(v) } });
      const curva = filata && v < (r.velocita_min ?? 3);
      this._avviso(out, 'towed_curva', curva,
        { chi: 'sonar', chiave: 'towed.curva', parametri: { velocita: Math.round(v) } });
    }
  }

  /**
   * Il timoniere riferisce quando ha raggiunto la rotta o la quota ordinate.
   * @param {Rapporto[]} out
   */
  _timoniere(out) {
    const b = this.b;
    const rotta = b.autopilota.attivo ? null : b.rottaOrdinata;
    if (rotta !== this.rottaSeguita) {
      this.rottaSeguita = rotta;
      this.rottaInAttesa = rotta !== null && Math.abs(differenzaAngolare(b.rotta, rotta)) > 2;
    }
    if (this.rottaInAttesa && rotta !== null
      && Math.abs(differenzaAngolare(b.rotta, rotta)) < 1 && Math.abs(b.omega) < 0.1) {
      this.rottaInAttesa = false;
      out.push({ chi: 'timone', chiave: 'timone.rotta_raggiunta', parametri: { rotta } });
    }
    const quota = b.modoQuota === 'automatica' ? b.quotaOrdinata : null;
    if (quota !== this.quotaSeguita) {
      this.quotaSeguita = quota;
      this.quotaInAttesa = quota !== null && Math.abs(Math.max(quota, b.p.dimensioni.pescaggio) - b.z) > 3;
    }
    if (this.quotaInAttesa && quota !== null
      && Math.abs(Math.max(quota, b.p.dimensioni.pescaggio) - b.z) < 2 && Math.abs(b.wz) < 0.2) {
      this.quotaInAttesa = false;
      out.push({ chi: 'timone', chiave: 'timone.quota_raggiunta', parametri: { quota } });
    }
  }
}
