// @ts-check
/**
 * Tastiera e mouse come nel 1989 (docs/ORIGINALE.md §4):
 *  - F2-F8 stazioni, F9 CONN, F1 aiuto, F10 tasto del capo;
 *  - Tab / Maiusc-Tab: gruppo di comandi successivo / precedente;
 *  - frecce destra / sinistra: comando successivo / precedente dentro il gruppo;
 *  - frecce su / giù: comando precedente / successivo qualunque sia il gruppo;
 *  - lettere e cifre SPOSTANO SOLO il cursore (la lettera del comando, la cifra del gruppo): per
 *    eseguire serve Invio, come nell'originale;
 *  - Invio esegue il comando sotto il cursore; il clic del mouse esegue direttamente.
 *
 * Le funzioni di navigazione sono pure (le prova tests/client/ingressi.test.js); `Ingressi` le collega
 * agli eventi del DOM e traduce le coordinate del puntatore nella griglia logica 320×200.
 */

/** @typedef {import('./cls.js').Hotspot} Hotspot */
/** @typedef {'tab' | 'tab-indietro' | 'destra' | 'sinistra' | 'su' | 'giu'} Movimento */

/** Tasti funzione → stazione. */
export const TASTI_STAZIONE = Object.freeze(/** @type {Record<string, string>} */ ({
  F2: 'radio', F3: 'status', F4: 'governo', F5: 'periscopio', F6: 'navigazione', F7: 'armi', F8: 'sonar', F9: 'conn',
}));

/**
 * Gruppi nell'ordine in cui compaiono nella lista (l'ordine di registrazione degli script).
 * @param {Hotspot[]} hs
 */
function ordineGruppi(hs) {
  /** @type {number[]} */
  const gruppi = [];
  for (const h of hs) if (!gruppi.includes(h.gruppo)) gruppi.push(h.gruppo);
  return gruppi;
}

/**
 * Nuovo indice del fuoco dopo un movimento. Senza fuoco si parte dal primo comando del primo gruppo
 * che non sia l'uscita (gruppo 0), come fa il giro dell'aiuto.
 * @param {Hotspot[]} hs @param {number | null} corrente @param {Movimento} mossa
 * @returns {number | null}
 */
export function naviga(hs, corrente, mossa) {
  if (hs.length === 0) return null;
  if (corrente === null || corrente < 0 || corrente >= hs.length) {
    const primo = hs.findIndex((h) => h.gruppo !== 0);
    return primo < 0 ? 0 : primo;
  }
  const h = hs[corrente];
  switch (mossa) {
    case 'giu':
      return (corrente + 1) % hs.length;
    case 'su':
      return (corrente - 1 + hs.length) % hs.length;
    case 'destra':
    case 'sinistra': {
      const nelGruppo = hs.map((x, i) => (x.gruppo === h.gruppo ? i : -1)).filter((i) => i >= 0);
      const k = nelGruppo.indexOf(corrente);
      const passo = mossa === 'destra' ? 1 : -1;
      return nelGruppo[(k + passo + nelGruppo.length) % nelGruppo.length];
    }
    case 'tab':
    case 'tab-indietro': {
      const gruppi = ordineGruppi(hs);
      const k = gruppi.indexOf(h.gruppo);
      const passo = mossa === 'tab' ? 1 : -1;
      const g = gruppi[(k + passo + gruppi.length) % gruppi.length];
      return hs.findIndex((x) => x.gruppo === g);
    }
    default:
      return corrente;
  }
}

/**
 * Indice del comando per una lettera o una cifra premuta (null se nessuno): la lettera porta al
 * comando con quel tasto, la cifra n al primo comando del gruppo n; «0» e «X» all'uscita.
 * @param {Hotspot[]} hs @param {string} tasto un carattere
 * @returns {number | null}
 */
export function perTasto(hs, tasto) {
  if (tasto.length !== 1) return null;
  const c = tasto.toUpperCase();
  if (c >= '0' && c <= '9') {
    const g = c.charCodeAt(0) - 48;
    const i = hs.findIndex((h) => h.gruppo === g);
    if (i >= 0) return i;
  }
  const codice = c.charCodeAt(0);
  const i = hs.findIndex((h) => h.tasto === codice);
  return i >= 0 ? i : null;
}

/** Centro di una zona, dove si porta il cursore. @param {Hotspot} h */
export function centro(h) {
  return { x: Math.round((h.x1 + h.x2) / 2), y: Math.round((h.y1 + h.y2) / 2) };
}

/**
 * @typedef {object} Gestore
 * @property {(stazione: string) => void} stazione
 * @property {() => void} aiuto
 * @property {() => void} capo
 * @property {(m: Movimento) => void} muovi
 * @property {(tasto: string) => void} lettera
 * @property {() => void} esegui Invio
 * @property {() => void} esc
 * @property {(dx: number, dy: number) => boolean} frecciaMirino true se c'è un mirino da spostare
 * @property {(x: number, y: number) => void} puntatore posizione logica
 * @property {(x: number, y: number) => void} clic
 */

export class Ingressi {
  /**
   * @param {HTMLCanvasElement} tela @param {Gestore} gestore
   */
  constructor(tela, gestore) {
    this.tela = tela;
    this.g = gestore;
    /** @param {KeyboardEvent} ev */
    this.suTasto = (ev) => this.#tasto(ev);
    window.addEventListener('keydown', this.suTasto);
    tela.addEventListener('mousemove', (ev) => {
      const p = this.logico(ev.clientX, ev.clientY);
      this.g.puntatore(p.x, p.y);
    });
    tela.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      tela.focus();
      const p = this.logico(ev.clientX, ev.clientY);
      this.g.clic(p.x, p.y);
    });
    tela.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  /** Coordinate logiche 320×200 di un punto dello schermo. @param {number} cx @param {number} cy */
  logico(cx, cy) {
    const r = this.tela.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(319, Math.floor(((cx - r.left) / r.width) * 320))),
      y: Math.max(0, Math.min(199, Math.floor(((cy - r.top) / r.height) * 200))),
    };
  }

  /** @param {KeyboardEvent} ev */
  #tasto(ev) {
    // non si rubano i tasti a un campo di testo della pagina
    const bersaglio = /** @type {HTMLElement | null} */ (ev.target);
    if (bersaglio && /^(INPUT|TEXTAREA|SELECT)$/.test(bersaglio.tagName)) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const k = ev.key;
    let preso = true;
    if (TASTI_STAZIONE[k]) this.g.stazione(TASTI_STAZIONE[k]);
    else if (k === 'F1') this.g.aiuto();
    else if (k === 'F10') this.g.capo();
    else if (k === 'Tab') this.g.muovi(ev.shiftKey ? 'tab-indietro' : 'tab');
    else if (k.startsWith('Arrow')) {
      const passo = ev.shiftKey ? 8 : 1;
      const d = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[k] ?? [0, 0];
      if (!this.g.frecciaMirino(d[0], d[1])) {
        this.g.muovi(/** @type {Movimento} */ ({ ArrowLeft: 'sinistra', ArrowRight: 'destra', ArrowUp: 'su', ArrowDown: 'giu' }[k]));
      }
    } else if (k === 'Enter') this.g.esegui();
    else if (k === 'Escape') this.g.esc();
    else if (k.length === 1 && /[a-z0-9.=\-]/i.test(k)) this.g.lettera(k);
    else preso = false;
    if (preso) ev.preventDefault();
  }
}
