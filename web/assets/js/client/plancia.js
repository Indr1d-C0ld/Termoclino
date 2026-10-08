// @ts-check
/**
 * Plancia — client di gioco, resa Classic (fase F1).
 *
 * Collega i pezzi: la grafica originale (dalla rotta autenticata /originali/), la regia che compone le
 * stazioni sulla tela indicizzata, lo schermo che la mostra ingrandita al pixel, tastiera e mouse, e il
 * collegamento col server di gioco (biglietto, presentazione, battito, riconnessione con un biglietto
 * nuovo: il ciclo di F0, ora in rete.js).
 *
 * L'indirizzo del server lo dà la pagina (configurazione `gioco.ws_url`, che PHP mette anche nella
 * Content-Security-Policy). Per lavorare col finto server (tests/strumenti/finto_server.mjs) si avvia
 * un sito di sviluppo con TERMOCLINO_CONFIG=tests/strumenti/config_finto_server.php: un parametro
 * nell'indirizzo non basterebbe, perché la CSP bloccherebbe il collegamento. In sviluppo (app.debug,
 * data-sviluppo="1") la regia è raggiungibile dalla console come `termoclino`.
 */
import { caricaOriginali, lettoreHttp } from './resa/risorse.js';
import { Schermo } from './resa/schermo.js';
import { Regia } from './regia.js';
import { Ingressi } from './ingressi.js';
import { Collegamento, chiediBiglietto } from './rete.js';
import { fondaleSintetico, caricaFondaleVero } from './fondale.js';

const radice = /** @type {HTMLElement} */ (document.getElementById('plancia'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('schermo-classic'));
const capo = /** @type {HTMLElement} */ (radice.querySelector('.capo'));
const statoTesto = /** @type {HTMLElement} */ (document.getElementById('stato-collegamento'));
const spia = /** @type {HTMLElement} */ (radice.querySelector('.spia'));
const crediti = /** @type {HTMLElement} */ (document.getElementById('crediti-mappa'));
const d = radice.dataset;
const sviluppo = d.sviluppo === '1';
const lingua = d.lingua === 'en' ? 'en' : 'it';

/** Testi della riga di stato sotto lo schermo (fuori dalla grafica del 1989). */
const NOTE = /** @type {Record<string, Record<string, string>>} */ ({
  it: { collegamento: 'Collegamento al server di gioco…', perso: 'Collegamento perso: riprovo…',
    rifiutato: 'Il server non ha accettato il collegamento: riprovo…', sito: 'Server del sito non raggiungibile',
    acceso: 'A bordo come', carico: 'Carico la grafica originale…', errore: 'Grafica originale non disponibile:',
    sintetico: 'Batimetria dello scenario non disponibile: la mappa mostra un fondale sintetico.' },
  en: { collegamento: 'Connecting to the game server…', perso: 'Connection lost: retrying…',
    rifiutato: 'The server refused the connection: retrying…', sito: 'Site server unreachable',
    acceso: 'On board as', carico: 'Loading the original graphics…', errore: 'Original graphics unavailable:',
    sintetico: 'Scenario bathymetry unavailable: the map shows a synthetic sea floor.' },
});
const nota = NOTE[lingua];

/** @param {'spento'|'in-corso'|'acceso'|'guasto'} stato @param {string} testo */
function segnala(stato, testo) {
  spia.dataset.stato = stato;
  statoTesto.textContent = testo;
}

async function avvia() {
  segnala('in-corso', nota.carico);
  let orig;
  try {
    orig = await caricaOriginali(lettoreHttp(d.originali ?? '/originali/'));
  } catch (e) {
    segnala('guasto', `${nota.errore} ${/** @type {Error} */ (e).message}`);
    return;
  }

  /** @type {Collegamento | null} */
  let rete = null;
  const regia = new Regia({ orig, lingua, ordina: (cosa, valore, n) => rete?.ordina(cosa, valore, n) });
  const schermo = new Schermo(canvas, orig.palette);

  // fondale: sintetico subito, quello vero appena la partita dice lo scenario
  let scenarioFondale = '';
  /** @param {import('./stato.js').Partita} p */
  async function fondalePer(p) {
    if (p.scenario === scenarioFondale) return;
    scenarioFondale = p.scenario;
    regia.fondale = fondaleSintetico(p.area);
    const vero = await caricaFondaleVero(p.scenario, d.shared ?? '/assets/shared/');
    if (vero && scenarioFondale === p.scenario) {
      regia.fondale = vero.campiona;
      regia.cache.clear();
      // attribuzione dei dati della mappa (EMODnet chiede CC BY 4.0): sotto lo schermo, sempre
      crediti.replaceChildren(...vero.crediti.flatMap((c, i) => {
        const r = document.createElement('span');
        r.textContent = `${c.testo}${c.licenza && !c.testo.includes(c.licenza) ? ` (${c.licenza})` : ''}`;
        return i ? [document.createTextNode(' · '), r] : [r];
      }));
      crediti.hidden = vero.crediti.length === 0;
    } else if (scenarioFondale === p.scenario) {
      crediti.textContent = nota.sintetico;
      crediti.hidden = false;
    }
  }

  rete = new Collegamento({
    ws: d.ws ?? '',
    biglietto: d.biglietto ?? '',
    nuovoBiglietto: () => chiediBiglietto(d.urlBiglietto ?? '', d.csrf ?? ''),
    suMessaggio: (m) => {
      regia.ricevi(m);
      if (m.t === 'partita' && regia.stato.partita) fondalePer(regia.stato.partita);
    },
    suStato: (s, n) => {
      if (s === 'acceso') segnala(s, `${nota.acceso} ${n}`);
      else segnala(s, nota[n] ?? n);
      if (s === 'guasto' && n === 'perso') regia.avvisa('locale.collegamento_perso');
    },
  });

  new Ingressi(canvas, {
    stazione: (s) => regia.vaiA(s),
    aiuto: () => regia.aiuto(),
    capo: () => {
      regia.capo();
      mostraCapo();
    },
    muovi: (m) => regia.muovi(m),
    lettera: (k) => regia.lettera(k),
    esegui: () => regia.esegui(),
    esc: () => regia.esc(),
    frecciaMirino: (dx, dy) => regia.frecciaMirino(dx, dy),
    puntatore: (x, y) => regia.puntatore(x, y),
    clic: (x, y) => regia.clic(x, y),
  });

  // dimensioni: il fattore intero più grande che sta nella finestra (meno la riga di stato)
  const adatta = () => {
    schermo.adatta(radice.getBoundingClientRect().width, Math.max(200, window.innerHeight - 48));
  };
  new ResizeObserver(adatta).observe(radice);
  window.addEventListener('resize', adatta);
  adatta();

  // per le verifiche in sviluppo (console del browser): la regia e lo schermo
  if (sviluppo) Object.assign(window, { termoclino: { regia, schermo, rete } });

  // il tasto del capo: il prompt del DOS al posto dello schermo, subito (non al prossimo fotogramma,
  // che in una scheda in secondo piano può non arrivare)
  const titolo = document.title;
  function mostraCapo() {
    const nascosto = regia.ui.capo;
    capo.hidden = !nascosto;
    canvas.hidden = nascosto;
    document.title = nascosto ? 'A:\\' : titolo;
    if (!nascosto) canvas.focus({ preventScroll: true });
  }

  const ciclo = (/** @type {number} */ t) => {
    if (!regia.ui.capo) {
      regia.componi(t / 1000);
      schermo.presenta(regia.tela);
    }
    requestAnimationFrame(ciclo);
  };
  requestAnimationFrame(ciclo);
  radice.scrollIntoView({ block: 'start' });
  canvas.focus({ preventScroll: true });
  rete.apri();
}

avvia();
