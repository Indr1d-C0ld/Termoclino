// @ts-check
/**
 * La regia della plancia Classic: tiene lo stato (dal server) e l'interfaccia (dal giocatore),
 * sceglie la stazione, compone ogni fotogramma sulla tela indicizzata, smista tastiera e mouse.
 *
 * Non tocca il DOM: lo fa plancia.js (canvas, rete, tasto del capo). Così la stessa regia gira nelle
 * prove in Node e compone le stesse schermate che si vedono nel browser.
 */
import { Tela } from './resa/tela.js';
import { preparaPannello } from './resa/risorse.js';
import { Nastro, disegnaFreccia, disegnaMirino, disegnaRiquadro } from './resa/cornice.js';
import { FINESTRA } from './resa/mappa.js';
import { hotspotIn } from './cls.js';
import { statoIniziale, riduci } from './stato.js';
import { traduci, frasePerRicevuto } from './lingue/indice.js';
import { DAL_SERVER, ERRORI, validaOrdine } from '../../shared/protocol.js';
import { uiIniziale, disegnaCornice, ritrattoPer } from './stazioni/comune.js';
import { conn } from './stazioni/conn.js';
import { governo } from './stazioni/governo.js';
import { navigazione, confermaWaypoint } from './stazioni/navigazione.js';
import { sonar } from './stazioni/sonar.js';
import { periscopio, notte } from './stazioni/periscopio.js';
import { generica } from './stazioni/generica.js';
import { LIVELLI_ASSISTENZA } from '../../shared/protocol.js';
import { naviga, perTasto, centro } from './ingressi.js';

/** @typedef {import('./resa/risorse.js').Originali} Originali */
/** @typedef {import('./resa/risorse.js').Pannello} Pannello */
/** @typedef {import('./stazioni/comune.js').Stazione} Stazione */
/** @typedef {import('./stazioni/comune.js').Contesto} Contesto */
/** @typedef {import('./resa/mappa.js').Campionatore} Campionatore */
/** @typedef {import('./cls.js').Hotspot} Hotspot */

/** Stazioni che hanno la riga dei messaggi e la barra di stato pur senza mappa. */
const CON_NASTRO = new Set(['radio']);

export class Regia {
  /**
   * @param {{ orig: Originali, lingua?: string, ordina?: (cosa: string, valore: unknown, n: number) => void,
   *   assistenza?: number, salvaAssistenza?: (livello: number) => void }} o
   *   assistenza: il livello voluto all'avvio (lo manda `entra`); salvaAssistenza: per ricordarlo
   */
  constructor(o) {
    this.orig = o.orig;
    this.font = o.orig.cls.font;
    this.tela = new Tela();
    this.stato = statoIniziale();
    this.ui = uiIniziale(o.lingua ?? 'it');
    if (o.assistenza !== undefined && LIVELLI_ASSISTENZA.includes(o.assistenza)) this.ui.assistenza = o.assistenza;
    this.salvaAssistenza = o.salvaAssistenza ?? (() => {});
    this.nastro = new Nastro();
    /** @type {Campionatore | null} */
    this.fondale = null;
    this.mandaOrdine = o.ordina ?? (() => {});
    /** @type {Map<string, unknown>} */
    this.cache = new Map();
    /** @type {Map<string, Pannello>} */
    this.pannelli = new Map();
    this.ultimoRapporto = 0;
    this.ultimaOra = NaN;
    /** Ora corrente in secondi (la passa componi). */
    this.ora = 0;
    /** @type {import('./biblioteca.js').Classe[]} il libro delle firme (lo carica plancia.js) */
    this.biblioteca = [];
    const vai = (/** @type {string} */ s) => this.vaiA(s);
    /** @type {Record<string, Stazione>} */
    this.stazioni = {
      conn: conn(vai),
      governo: governo(vai),
      navigazione: navigazione(vai),
      sonar: sonar(vai),
      radio: generica('radio', 'RADIO_688', false, vai),
      status: generica('status', 'STATUS_688', false, vai),
      periscopio: periscopio(vai),
      armi: generica('armi', 'WCR_688', true, vai),
    };
  }

  /** @param {string} chiave @param {Record<string, unknown>} [parametri] */
  t(chiave, parametri) {
    return traduci(this.ui.lingua, chiave, parametri);
  }

  /** La stazione corrente. */
  get stazione() {
    return this.stazioni[this.ui.stazione] ?? this.stazioni.conn;
  }

  /** Pannello della stazione corrente (preparato una volta sola). */
  get pannello() {
    const id = this.stazione.lavoro;
    let p = this.pannelli.get(id);
    if (!p) {
      p = preparaPannello(this.orig, id);
      this.pannelli.set(id, p);
    }
    return p;
  }

  /** @returns {Contesto} */
  contesto() {
    return {
      tela: this.tela,
      orig: this.orig,
      font: this.font,
      pannello: this.pannello,
      stato: this.stato,
      ui: this.ui,
      ora: this.ora,
      fondale: this.fondale,
      ordina: (cosa, valore) => this.ordina(cosa, valore),
      avvisa: (chiave, parametri) => this.avvisa(chiave, parametri),
      t: (chiave, parametri) => this.t(chiave, parametri),
      cache: this.cache,
      biblioteca: this.biblioteca,
    };
  }

  /** Zone cliccabili della schermata: quelle dello script più quelle del client. @returns {Hotspot[]} */
  hotspot() {
    const extra = this.stazione.hotspotExtra?.(this.contesto()) ?? [];
    return [...this.pannello.hotspot, ...extra];
  }

  // ------------------------------------------------------------------------------ dal server

  /** @param {{ t: string, [k: string]: unknown }} m */
  ricevi(m) {
    this.stato = riduci(this.stato, m);
    switch (m.t) {
      case DAL_SERVER.BENVENUTO:
        this.avvisa('locale.benvenuto');
        break;
      case DAL_SERVER.RICEVUTO: {
        // l'equipaggio ripete l'ordine, come nel 1989 (con la foto di chi lo esegue)
        const f = frasePerRicevuto(String(m.cosa), m.valore);
        if (f) this.avvisa(f.chiave, f.parametri, f.chi);
        break;
      }
      case DAL_SERVER.ERRORE: {
        const codice = String(m.codice ?? '');
        if (codice === ERRORI.ORDINE_RIFIUTATO && m.motivo) this.avvisa(`motivo.${String(m.motivo)}`);
        else if (codice === ERRORI.ORDINE_NON_VALIDO) this.avvisa('errore.ordine_non_valido', { motivo: `${String(m.cosa ?? '')} ${String(m.motivo ?? '')}`.trim() });
        else this.avvisa(`errore.${codice}`);
        break;
      }
      case DAL_SERVER.USCITA:
        this.avvisa(`uscita.${String(m.motivo ?? '')}`);
        break;
    }
    this.#nuoviRapporti();
  }

  #nuoviRapporti() {
    for (const r of this.stato.rapporti) {
      if (r.id <= this.ultimoRapporto) continue;
      this.ultimoRapporto = r.id;
      this.nastro.aggiungi(this.t(r.chiave, r.parametri));
      if (r.chi) ritrattoPer(this.ui, r.chi, this.ora);
    }
  }

  /**
   * Messaggio del client nel nastro (passa dallo stato come i rapporti).
   * @param {string} chiave @param {Record<string, unknown>} [parametri] @param {string} [chi] ruolo, per il ritratto
   */
  avvisa(chiave, parametri = {}, chi = '') {
    this.stato = riduci(this.stato, { t: 'locale', chiave, parametri, chi });
    this.#nuoviRapporti();
  }

  /**
   * Un ordine al battello: validato qui con la stessa funzione del server (un ordine scritto male
   * non parte), numerato, specchiato nello stato e mandato.
   * @param {string} cosa @param {unknown} valore
   */
  ordina(cosa, valore) {
    const n = this.stato.prossimoOrdine;
    const esito = validaOrdine({ cosa, valore, n });
    if (!esito.ok) {
      this.avvisa('errore.ordine_non_valido', { motivo: `${cosa} ${esito.motivo}` });
      return;
    }
    this.stato = riduci(this.stato, { t: 'ordine', cosa, valore: esito.ordine.valore, n });
    this.mandaOrdine(cosa, esito.ordine.valore, n);
  }

  // ------------------------------------------------------------------------------ composizione

  /**
   * Compone il fotogramma sulla tela.
   * @param {number} ora secondi (performance.now() / 1000 nel browser)
   */
  componi(ora) {
    // il passo del nastro: al più un secondo (una scheda rimasta in secondo piano non fa saltare
    // tutti i messaggi in coda, ma un browser che rallenta i fotogrammi non li fa strisciare)
    const dt = Number.isFinite(this.ultimaOra) ? Math.min(1, Math.max(0, ora - this.ultimaOra)) : 0;
    this.ultimaOra = ora;
    this.ora = ora;
    this.nastro.avanza(dt);
    const st = this.stazione;
    const ctx = this.contesto();
    this.tela.senzaRitaglio();
    this.tela.carica(ctx.pannello.indici);
    if (st.cornice) disegnaCornice(ctx, st, this.nastro);
    else if (CON_NASTRO.has(st.id)) this.nastro.disegna(this.tela, this.font);
    st.disegna(ctx);
    if (this.ui.aiuto) {
      const liv = this.stato.nave?.assistenza ?? this.ui.assistenza;
      const righe = [
        this.t('ui.aiuto.titolo'), '', ...this.t('ui.aiuto.testo').split('\n'), '',
        this.t('ui.aiuto.assistenza', { n: liv, nome: this.t(`ui.assistenza.${liv}`) }),
        this.t('ui.aiuto.assistenza_cambia'),
      ];
      disegnaRiquadro(this.tela, this.font, 24, 22, righe);
    }
    this.#cursore();
  }

  #cursore() {
    const { x, y } = this.ui.cursore;
    if (this.ui.mirino) {
      disegnaMirino(this.tela, this.ui.mirino.x, this.ui.mirino.y);
      return;
    }
    const h = this.ui.fuoco !== null ? this.hotspot()[this.ui.fuoco] ?? null : hotspotIn(this.hotspot(), x, y);
    disegnaFreccia(this.tela, x, y, h ? h.colore : 15);
  }

  // ------------------------------------------------------------------------------ comandi

  /** @param {string} stazione */
  vaiA(stazione) {
    if (!this.stazioni[stazione]) return;
    this.ui.stazione = stazione;
    this.ui.fuoco = null;
    this.ui.mirino = null;
    this.ui.aiuto = false;
  }

  /** @param {import('./ingressi.js').Movimento} m */
  muovi(m) {
    const hs = this.hotspot();
    this.ui.fuoco = naviga(hs, this.ui.fuoco, m);
    if (this.ui.fuoco !== null) this.ui.cursore = centro(hs[this.ui.fuoco]);
  }

  /** Lettera o cifra: porta il cursore sul comando, non lo esegue. @param {string} k */
  lettera(k) {
    if (this.ui.aiuto) {
      // con l'aiuto aperto le cifre 0-3 scelgono il livello di assistenza
      if (/^[0-3]$/.test(k)) this.scegliAssistenza(Number(k));
      return;
    }
    const hs = this.hotspot();
    const i = perTasto(hs, k);
    if (i === null) return;
    this.ui.fuoco = i;
    this.ui.cursore = centro(hs[i]);
  }

  /** Invio: esegue il comando sotto il cursore (o conferma il mirino). */
  esegui() {
    if (this.ui.aiuto) { this.ui.aiuto = false; return; }
    if (this.ui.mirino) {
      confermaWaypoint(this.contesto(), this.ui.mirino.x, this.ui.mirino.y);
      return;
    }
    const hs = this.hotspot();
    const h = this.ui.fuoco !== null ? hs[this.ui.fuoco] : hotspotIn(hs, this.ui.cursore.x, this.ui.cursore.y);
    if (h) this.stazione.attiva(this.contesto(), h, null);
  }

  esc() {
    if (!this.ui.aiuto && !this.ui.mirino && this.stazione.esc?.(this.contesto())) return;
    this.ui.aiuto = false;
    this.ui.mirino = null;
  }

  /**
   * Il livello di assistenza (PROGETTO §5.6): si ricorda per il prossimo `entra` e, in partita, si
   * ordina subito (il server può rifiutarlo con `livello`).
   * @param {number} livello 0-3
   */
  scegliAssistenza(livello) {
    if (!LIVELLI_ASSISTENZA.includes(livello)) return;
    this.ui.assistenza = livello;
    this.salvaAssistenza(livello);
    if (this.stato.partita && this.stato.nave && this.stato.nave.assistenza !== livello) this.ordina('assistenza', livello);
  }

  /**
   * La palette dello schermo: NIGHT quando si guarda dal periscopio di notte (cielo blu notte, sagome
   * rosse, 094), DAY altrimenti.
   * @returns {'giorno' | 'notte'}
   */
  get palette() {
    if (this.ui.stazione !== 'periscopio' || !this.stato.nave?.alberi.periscopio || this.ui.peri.libro) return 'giorno';
    return notte(this.contesto()) ? 'notte' : 'giorno';
  }

  aiuto() {
    this.ui.aiuto = !this.ui.aiuto;
  }

  capo() {
    this.ui.capo = !this.ui.capo;
  }

  /** @param {number} dx @param {number} dy */
  frecciaMirino(dx, dy) {
    const m = this.ui.mirino;
    if (!m) return false;
    m.x = Math.max(FINESTRA.x1, Math.min(FINESTRA.x2, m.x + dx));
    m.y = Math.max(FINESTRA.y1, Math.min(FINESTRA.y2, m.y + dy));
    return true;
  }

  /** @param {number} x @param {number} y */
  puntatore(x, y) {
    this.ui.cursore = { x, y };
    this.ui.fuoco = null;
    const m = this.ui.mirino;
    if (m && x >= FINESTRA.x1 && x <= FINESTRA.x2 && y >= FINESTRA.y1 && y <= FINESTRA.y2) {
      m.x = x;
      m.y = y;
    }
  }

  /** Clic: esegue subito il comando sotto il puntatore. @param {number} x @param {number} y */
  clic(x, y) {
    this.puntatore(x, y);
    if (this.ui.aiuto) { this.ui.aiuto = false; return; }
    if (this.ui.mirino) {
      confermaWaypoint(this.contesto(), x, y);
      return;
    }
    const h = hotspotIn(this.hotspot(), x, y);
    if (h) this.stazione.attiva(this.contesto(), h, { x, y });
  }
}
