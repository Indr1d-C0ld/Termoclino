// @ts-check
/**
 * I sensori di F2 di una partita (filone H): un solo oggetto che la partita
 * chiama in pochi punti delimitati (server/src/match/partita.js, agganci «H»),
 * e che tiene tutto cio' che i sensori nuovi hanno di stato:
 *
 *  - per ogni giocatore: la banda stretta dei due sensori (bandastretta.js),
 *    l'analizzatore (dove punta, quale contatto segue), il periscopio
 *    (ottica.js), l'ESM e il radar (radio.js), la coda delle consegne che
 *    arrivano piu' tardi (echi, intercettazioni, transitori: il suono ci mette
 *    il suo tempo);
 *  - per la partita: i transitori di tutte le entita' e chi li sente
 *    (transitori.js), i ping (attivo.js), le alzate degli alberi e il radar,
 *    con i loro eventi nel diario (server/src/match/diario.js).
 *
 * Interfaccia per la partita:
 *
 *   const h = new SensoriPartita({ac, amb, rng, entita, ora, diario, scenario})
 *   h.aggiungi(g) / h.togli(g)            quando un giocatore entra o esce
 *   h.ordine(g, o) → motivo | null        per 'analizzatore', 'attivo', 'albero', 'radar'
 *   h.inizioSecondo(ora)                  una volta al secondo, prima dei giocatori
 *   h.secondo(g, ora) → {bandaStretta, messaggi, rapporti}
 *   h.stato(g) → {ascolto_attivo, analizzatore, avvisi}
 *   h.righe(g, sensore, rilevamento)      LOFAR e DEMON di un fascio qualsiasi (l'equipaggio)
 *
 * NEBBIA DI GUERRA: `messaggi` contiene solo misure (forma di docs/PROTOCOLLO.md
 * v2); la verita' (id interni, distanze vere, contributi) resta qui e va solo
 * nel diario.
 */

import { SPETTRO, codificaByte, codificaSettori } from '../../../../shared/protocol.js';
import { AnalizzatoreBandaStretta } from './bandastretta.js';
import { eseguiPing } from './attivo.js';
import { ascoltaTransitori } from './transitori.js';
import { Periscopio } from './ottica.js';
import { Esm, RadarProprio } from './radio.js';

/** @typedef {import('./acustica.js').ValoriAcustica} ValoriAcustica */
/** @typedef {import('../world/ambiente.js').Ambiente} Ambiente */
/** @typedef {import('../../../../shared/rng.js').Generatore} Generatore */
/** @typedef {import('../platform/battello.js').Battello} Battello */
/** @typedef {import('../platform/battello.js').Rapporto} Rapporto */
/** @typedef {import('./passivo.js').SensorePassivo} SensorePassivo */
/** @typedef {import('./passivo.js').Fotogramma} Fotogramma */
/** @typedef {import('./attivo.js').Consegna} Consegna */
/** @typedef {import('../../../../shared/protocol.js').Ordine} Ordine */

/**
 * Cio' che dei giocatori serve ai sensori (la partita ne ha di piu').
 * @typedef {object} GiocatoreH
 * @property {Battello} battello
 * @property {{sfera: SensorePassivo, towed: SensorePassivo}} sensori
 * @property {any} [equipaggio]  per agganciare l'analizzatore a un contatto (puntamento)
 */

/**
 * @typedef {object} StatoGiocatore
 * @property {{sfera: AnalizzatoreBandaStretta, towed: AnalizzatoreBandaStretta}} bs
 * @property {null | {sensore: 'sfera' | 'towed', rilevamento: number, contatto: string | null}} analizzatore
 * @property {Generatore} rngSpettro  il fondo dello `spettro` del giocatore
 * @property {Generatore} rngEquipaggio  il fondo degli sguardi dell'equipaggio
 * @property {Periscopio} periscopio
 * @property {Esm} esm
 * @property {RadarProprio} radar
 * @property {Consegna[]} coda
 */

/**
 * Un messaggio per il client: tipo e campi (protocollo v2).
 * @typedef {{tipo: string, campi: Record<string, unknown>}} Uscita
 */

export class SensoriPartita {
  /**
   * @param {object} a
   * @param {ValoriAcustica} a.ac
   * @param {Ambiente} a.amb
   * @param {Generatore} a.rng  generatore della partita: se ne derivano i sotto-flussi
   * @param {() => any[]} a.entita  tutte le entita', in ordine di id
   * @param {() => number} a.ora  ora di gioco corrente
   * @param {{emetti: (e: {evento: string, [k: string]: unknown}) => unknown} | null} [a.diario]
   * @param {{luce?: string, ambiente?: {statoMare?: number}}} [a.scenario]
   */
  constructor(a) {
    this.ac = a.ac;
    this.amb = a.amb;
    this.rng = a.rng;
    this.entita = a.entita;
    this.ora = a.ora;
    this.diario = a.diario ?? null;
    this.notte = a.scenario?.luce === 'notte';
    this.statoMare = a.scenario?.ambiente?.statoMare ?? 3;
    /** @type {Map<GiocatoreH, StatoGiocatore>} */
    this.giocatori = new Map();
    this.rngTransitori = a.rng.deriva('H:transitori');
    /** ultimo secondo in cui si e' fatto il lavoro della partita */
    this._ultimoSecondo = -1;
  }

  /**
   * @param {Record<string, unknown> & {evento: string}} e
   */
  _diario(e) {
    try {
      this.diario?.emetti(e);
    } catch {
      // il diario non deve fermare la partita
    }
  }

  // -------------------------------------------------------------------------
  // Giocatori
  // -------------------------------------------------------------------------

  /** @param {GiocatoreH} g */
  aggiungi(g) {
    const b = g.battello;
    const id = b.id;
    /** @param {'sfera' | 'towed'} nome */
    const bs = (nome) => new AnalizzatoreBandaStretta({
      passivo: g.sensori[nome], ac: this.ac,
      rng: this.rng.deriva(`H:bs:${id}:${nome}`),
      rngCoppia: (sorgente) => this.rng.deriva(`H:bs-coppia:${id}:${nome}:${sorgente}`),
    });
    this.giocatori.set(g, {
      bs: { sfera: bs('sfera'), towed: bs('towed') },
      analizzatore: null,
      rngSpettro: this.rng.deriva(`H:spettro:${id}`),
      rngEquipaggio: this.rng.deriva(`H:equipaggio:${id}`),
      periscopio: new Periscopio(b, this.rng.deriva(`H:periscopio:${id}`)),
      esm: new Esm(b, this.rng.deriva(`H:esm:${id}`)),
      radar: new RadarProprio(b, this.rng.deriva(`H:radar:${id}`)),
      coda: [],
    });
  }

  /** @param {GiocatoreH} g */
  togli(g) {
    this.giocatori.delete(g);
  }

  /**
   * @param {GiocatoreH} g
   * @returns {StatoGiocatore}
   */
  _st(g) {
    let st = this.giocatori.get(g);
    if (!st) {
      this.aggiungi(g);
      st = /** @type {StatoGiocatore} */ (this.giocatori.get(g));
    }
    return st;
  }

  // -------------------------------------------------------------------------
  // Ordini
  // -------------------------------------------------------------------------

  /**
   * Gli ordini dei sensori di F2. Restituisce null se eseguito, altrimenti il
   * motivo del rifiuto (MOTIVI_ORDINE).
   * @param {GiocatoreH} g
   * @param {Ordine} o
   * @param {{x0: number, y0: number, x1: number, y1: number}} [area]
   * @returns {string | null}
   */
  ordine(g, o, area = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity }) {
    const b = g.battello;
    const st = this._st(g);
    if (o.cosa === 'analizzatore') {
      const v = o.valore;
      if (v === null) {
        st.analizzatore = null;
        return null;
      }
      if ('contatto' in v) {
        const p = this._puntamento(g, v.contatto);
        if (!p) return 'contatto';
        if (p.sensore === 'towed' && !b.towed) return 'senza_towed';
        st.analizzatore = { sensore: p.sensore, rilevamento: p.rilevamento, contatto: v.contatto };
        return null;
      }
      if (v.sensore === 'towed' && !b.towed) return 'senza_towed';
      st.analizzatore = { sensore: v.sensore, rilevamento: v.rilevamento, contatto: null };
      return null;
    }
    if (o.cosa === 'albero' || o.cosa === 'radar' || o.cosa === 'attivo') {
      const motivo = b.ordina(o, area);
      if (motivo !== null) return motivo;
      this._raccogliAlberi(b);
      if (o.cosa === 'attivo') this._ping(b);
      return null;
    }
    return null;
  }

  /**
   * Il rilevamento di un contatto dell'equipaggio, per l'analizzatore: chiede
   * all'equipaggio (`puntamento`, filone I) o, in sua mancanza, guarda le
   * tracce del sonarista di F1.
   * @param {GiocatoreH} g
   * @param {string} contatto
   * @returns {{sensore: 'sfera' | 'towed', rilevamento: number} | null}
   */
  _puntamento(g, contatto) {
    const eq = g.equipaggio;
    if (eq && typeof eq.puntamento === 'function') {
      const p = eq.puntamento(contatto, this.ora());
      return p ? { sensore: p.sensore === 'towed' ? 'towed' : 'sfera', rilevamento: p.rilevamento } : null;
    }
    for (const sensore of /** @type {const} */ (['sfera', 'towed'])) {
      const t = eq?.tracciatori?.[sensore]?.tracce?.find((/** @type {any} */ x) => x.designazione === contatto);
      if (t) return { sensore, rilevamento: t.rilevamento };
    }
    return null;
  }

  /**
   * Esegue il ping chiesto dal battello e mette in coda echi e intercettazioni.
   * @param {Battello} b
   */
  _ping(b) {
    if (!b.attivo.richiesto) return;
    const r = eseguiPing({
      ora: this.ora(), battello: b, entita: this.entita(), ac: this.ac, amb: this.amb,
      rng: this.rng.deriva(`H:ping:${b.id}:${b.attivo.ping + 1}`), statoMare: this.statoMare,
    });
    for (const e of r.diario) this._diario(/** @type {any} */ (e));
    for (const c of r.consegne) this._accoda(c);
  }

  /**
   * @param {Consegna} c
   */
  _accoda(c) {
    for (const [g, st] of this.giocatori) {
      if (g.battello === c.a) {
        st.coda.push(c);
        return;
      }
    }
    // Il destinatario non e' (piu') un giocatore: si scrive almeno il diario.
    for (const e of c.diario) this._diario(/** @type {any} */ (e));
  }

  /**
   * Gli eventi degli alberi e del radar di un battello, nel diario.
   * @param {Battello} b
   */
  _raccogliAlberi(b) {
    for (const e of b.eventiAlberi.splice(0)) this._diario({ evento: 'albero', battello: b.id, quale: e.quale, alzato: e.alzato, da: e.da });
    for (const e of b.eventiRadar.splice(0)) this._diario({ evento: 'radar', battello: b.id, attivo: e.attivo });
  }

  // -------------------------------------------------------------------------
  // Il secondo
  // -------------------------------------------------------------------------

  /**
   * Il lavoro della partita, una volta al secondo prima dei giocatori: ping
   * rimasti in sospeso, alberi, transitori di tutte le entita' e chi li sente.
   * @param {number} ora
   */
  inizioSecondo(ora) {
    if (this._ultimoSecondo === ora) return;
    this._ultimoSecondo = ora;
    const entita = this.entita();
    for (const e of entita) {
      if (e.tipo !== 'sottomarino') continue;
      const b = /** @type {Battello} */ (e);
      if (b.attivo.richiesto) this._ping(b);
      this._raccogliAlberi(b);
    }
    const ascoltatori = [...this.giocatori.keys()].map((g) => ({ b: g.battello, sensori: g.sensori }));
    const t = ascoltaTransitori({ ora, entita, ascoltatori, ac: this.ac, amb: this.amb, rng: this.rngTransitori });
    for (const e of t.diario) this._diario(/** @type {any} */ (e));
    for (const c of t.consegne) this._accoda(c);
  }

  /**
   * Un secondo di sensori per un giocatore: cosa mandargli, cosa riferisce
   * l'equipaggio, e i fotogrammi a banda stretta per il sonarista.
   * @param {GiocatoreH} g
   * @param {number} ora
   * @returns {{bandaStretta: {sfera: Fotogramma | null, towed: Fotogramma | null} | null, messaggi: Uscita[], rapporti: Rapporto[]}}
   */
  secondo(g, ora) {
    this.inizioSecondo(ora);
    const st = this._st(g);
    const b = g.battello;
    st.bs.sfera.epoca = ora;
    st.bs.towed.epoca = ora;
    /** @type {Uscita[]} */
    const messaggi = [];
    /** @type {Rapporto[]} */
    const rapporti = [];
    const entita = this.entita();

    // Consegne arrivate (echi, intercettazioni, transitori, fine dell'ascolto).
    if (st.coda.length > 0) {
      st.coda.sort((x, y) => x.ora - y.ora);
      let n = 0;
      while (n < st.coda.length && st.coda[n].ora <= ora + 1e-9) n++;
      for (const c of st.coda.splice(0, n)) {
        if (c.tipo && c.campi) messaggi.push({ tipo: c.tipo, campi: c.campi });
        if (c.rapporto) {
          if (c.rapporto.chiave === 'sonar.transitorio') c.rapporto.parametri.contatto = this._contattoVicino(g, c);
          rapporti.push(/** @type {Rapporto} */ (c.rapporto));
        }
        for (const e of c.diario) this._diario(/** @type {any} */ (e));
      }
    }

    // Banda stretta e analizzatore, ogni SPETTRO.PERIODO secondi.
    /** @type {{sfera: Fotogramma | null, towed: Fotogramma | null} | null} */
    let bandaStretta = null;
    if (Math.round(ora) % SPETTRO.PERIODO === 0) {
      bandaStretta = { sfera: st.bs.sfera.fotogramma(entita, this.amb), towed: st.bs.towed.fotogramma(entita, this.amb) };
      for (const sensore of /** @type {const} */ (['sfera', 'towed'])) {
        const f = bandaStretta[sensore];
        if (!f) continue;
        /** @type {Record<string, unknown>} */
        const campi = { ora, sensore, banda: 'stretta', settori: codificaSettori(f.settori), ciechi: f.ciechi };
        if (f.asse !== undefined) campi.asse = f.asse;
        if (f.sorda !== undefined) campi.sorda = f.sorda;
        messaggi.push({ tipo: 'sonar', campi });
      }
      const an = st.analizzatore;
      if (an) {
        if (an.contatto) {
          const p = this._puntamento(g, an.contatto);
          if (p) {
            an.rilevamento = p.rilevamento;
            an.sensore = p.sensore === 'towed' && !b.towed ? 'sfera' : p.sensore;
          } else {
            an.contatto = null; // l'equipaggio non lo tiene piu': il fascio resta sull'ultimo rilevamento
          }
        }
        const s = st.bs[an.sensore].spettro(entita, this.amb, an.rilevamento, st.rngSpettro);
        if (s) {
          const fin = SPETTRO[an.sensore];
          /** @type {Record<string, unknown>} */
          const campi = {
            ora, sensore: an.sensore, rilevamento: Math.round(an.rilevamento * 10) / 10, contatto: an.contatto,
            da_hz: fin.DA_HZ, passo_hz: fin.PASSO_HZ, righe: codificaByte(s.righe),
            demon_da_hz: fin.DEMON_DA_HZ, demon_passo_hz: fin.DEMON_PASSO_HZ, demon: codificaByte(s.demon),
          };
          if (an.sensore === 'towed') { campi.asse = s.asse; campi.sorda = s.sorda; }
          messaggi.push({ tipo: 'spettro', campi });
        }
      }
    }

    // Periscopio.
    const notte = this.notte;
    if (b.alberi.periscopio) {
      const v = st.periscopio.guarda({ entita, ac: this.ac, notte, statoMare: this.statoMare });
      // luce: la vede chiunque guardi fuori, ed e' quella dello scenario (non dice niente degli altri).
      messaggi.push({ tipo: 'visivo', campi: { ora, luce: this.notte ? 'notte' : 'giorno', oggetti: v.oggetti } });
      for (const n of v.nuovi) {
        if (!n.albero && n.oggetto.sagoma) {
          rapporti.push({ chi: 'guardia', chiave: 'periscopio.nave_in_vista', parametri: { rilevamento: Math.round(n.oggetto.rilevamento) % 360, sagoma: n.oggetto.sagoma } });
        }
        this._diario({ evento: 'periscopio', osservatore: b.id, oggetto: n.id, distanza_vera: n.distanza, sagoma: n.oggetto.sagoma });
        if (n.albero) {
          this._diario({ evento: 'controscoperta', ascoltatore: b.id, sorgente: n.id, causa: 'albero', distanza_vera: n.distanza, sensore: 'periscopio' });
        }
      }
    } else {
      st.periscopio.viste.clear();
    }
    const scia = st.periscopio.scia;
    if (scia && !st.periscopio.sciaRiferita) {
      rapporti.push({ chi: 'guardia', chiave: 'periscopio.scia', parametri: { velocita: Math.round(Math.abs(b.velocita)) } });
    }
    st.periscopio.sciaRiferita = scia;

    // ESM.
    if (b.alberi.esm && b.p.sensori.esm?.presente) {
      const e = st.esm.ascolta({ entita, ac: this.ac, ora });
      messaggi.push({ tipo: 'esm', campi: { ora, emissioni: e.emissioni } });
      for (const n of e.nuove) {
        rapporti.push({ chi: 'guardia', chiave: 'esm.radar', parametri: { rilevamento: n.rilevamento, tipo: n.tipo, banda: n.banda } });
        this._diario({ evento: 'esm', osservatore: b.id, emettitore: n.id, distanza_vera: n.distanza, tipo: n.tipo });
        this._diario({ evento: 'controscoperta', ascoltatore: b.id, sorgente: n.id, causa: 'radar', distanza_vera: n.distanza, sensore: 'esm' });
      }
    }

    // Radar proprio.
    const giro = st.radar.giro({ entita, ac: this.ac, ora });
    if (giro) {
      messaggi.push({ tipo: 'radar', campi: { ora, echi: giro.echi } });
      for (const a of giro.alberi) {
        this._diario({ evento: 'controscoperta', ascoltatore: b.id, sorgente: a.id, causa: 'albero', distanza_vera: a.distanza, sensore: 'radar' });
      }
    }
    this._raccogliAlberi(b);
    return { bandaStretta, messaggi, rapporti };
  }

  /**
   * Il contatto dell'equipaggio vicino al rilevamento di un transitorio (per
   * il rapporto), se l'equipaggio lo sa dire (`contattoVicino`, filone I).
   * @param {GiocatoreH} g
   * @param {Consegna & {sensore?: string, rilevamento?: number}} c
   * @returns {string | null}
   */
  _contattoVicino(g, c) {
    const eq = g.equipaggio;
    if (eq && typeof eq.contattoVicino === 'function' && typeof c.rilevamento === 'number') {
      try {
        return eq.contattoVicino(c.sensore, c.rilevamento) ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * I campi di `stato` che dipendono dai sensori della partita.
   * @param {GiocatoreH} g
   * @returns {{ascolto_attivo: number, analizzatore: null | {sensore: 'sfera' | 'towed', rilevamento: number, contatto: string | null}, avvisi: string[]}}
   */
  stato(g) {
    const st = this._st(g);
    const an = st.analizzatore;
    return {
      ascolto_attivo: Math.ceil(g.battello.attivo.ascolto),
      analizzatore: an ? { sensore: an.sensore, rilevamento: Math.round(an.rilevamento * 10) / 10, contatto: an.contatto } : null,
      avvisi: st.periscopio.scia ? ['periscopio_scia'] : [],
    };
  }

  /**
   * LOFAR e DEMON di un fascio qualsiasi, per l'equipaggio (classificazione):
   * stesso calcolo dell'analizzatore, sotto-flusso proprio per il fondo.
   * @param {GiocatoreH} g
   * @param {'sfera' | 'towed'} sensore
   * @param {number} rilevamento gradi veri
   * @returns {{da_hz: number, passo_hz: number, righe: Uint8Array, demon_da_hz: number, demon_passo_hz: number,
   *   demon: Uint8Array, contributi: {sorgente: string, guadagno: number, distanza_vera: number}[]} | null}
   */
  righe(g, sensore, rilevamento) {
    const st = this._st(g);
    const s = st.bs[sensore].spettro(this.entita(), this.amb, rilevamento, st.rngEquipaggio);
    if (!s) return null;
    const fin = SPETTRO[sensore];
    return {
      da_hz: fin.DA_HZ, passo_hz: fin.PASSO_HZ, righe: s.righe,
      demon_da_hz: fin.DEMON_DA_HZ, demon_passo_hz: fin.DEMON_PASSO_HZ, demon: s.demon, contributi: s.contributi,
    };
  }
}
