// @ts-check
/**
 * Plancia — client di gioco, fase F0.
 *
 * Sale a bordo del server di gioco con il biglietto rilasciato dalla pagina,
 * tiene il battito e si ricollega da solo chiedendo un biglietto nuovo. Le
 * stazioni arrivano in F1; il ciclo di collegamento e' gia' quello definitivo.
 */
import {
  PROTOCOLLO_VERSIONE,
  DAL_CLIENT,
  DAL_SERVER,
  ERRORI,
  codifica,
  decodifica,
} from '../../shared/protocol.js';

const radice = /** @type {HTMLElement} */ (document.getElementById('plancia'));
const statoTesto = /** @type {HTMLElement} */ (document.getElementById('stato-collegamento'));
const spia = /** @type {HTMLElement} */ (radice.querySelector('.spia'));
const registro = /** @type {HTMLElement} */ (document.getElementById('registro-bordo'));

/**
 * Testi per i codici d'errore: il client traduce, non mostra il codice grezzo.
 * @type {Record<string, string>}
 */
const SPIEGAZIONI = {
  [ERRORI.BIGLIETTO_SCADUTO]: 'il biglietto è scaduto: ne chiedo un altro',
  [ERRORI.BIGLIETTO_GIA_USATO]: 'il biglietto era già stato usato: ne chiedo un altro',
  [ERRORI.BIGLIETTO_NON_VALIDO]: 'il server non riconosce il biglietto',
  [ERRORI.BIGLIETTO_ASSENTE]: 'manca il biglietto',
  [ERRORI.VERSIONE]: 'il server parla una versione diversa del protocollo: ricarica la pagina',
  [ERRORI.ORIGINE]: 'origine non ammessa',
  [ERRORI.TROPPO_IN_FRETTA]: 'troppi messaggi in poco tempo',
  [ERRORI.NON_PRESENTATO]: 'il server aspetta ancora il biglietto',
};

let biglietto = radice.dataset.biglietto ?? '';
let tentativi = 0;
/** @type {ReturnType<typeof setInterval> | null} */
let battito = null;
let pingInviato = 0;

/** @param {string} testo */
function annota(testo) {
  const ora = new Date().toLocaleTimeString('it-IT');
  registro.textContent = `${ora}  ${testo}\n` + (registro.textContent ?? '').split('\n').slice(0, 40).join('\n');
}

/** @param {'spento'|'in-corso'|'acceso'|'guasto'} stato @param {string} testo */
function segnala(stato, testo) {
  spia.dataset.stato = stato;
  statoTesto.textContent = testo;
}

async function bigliettoNuovo() {
  const r = await fetch(radice.dataset.urlBiglietto ?? '', {
    method: 'POST',
    headers: { 'X-CSRF-Token': radice.dataset.csrf ?? '', Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (r.status === 401) {
    location.href = location.href; // sessione scaduta: la pagina rimanda all'accesso
    throw new Error('sessione scaduta');
  }
  const j = await r.json();
  if (!j.ok) throw new Error(j.errore ?? 'biglietto non rilasciato');
  return /** @type {string} */ (j.biglietto);
}

function collega() {
  segnala('in-corso', 'Collegamento al server di gioco…');
  const ws = new WebSocket(radice.dataset.ws ?? '');
  let accolto = false;

  ws.addEventListener('open', () => {
    ws.send(codifica(DAL_CLIENT.CIAO, { versione: PROTOCOLLO_VERSIONE, biglietto }));
    biglietto = ''; // monouso: il prossimo collegamento ne chiede uno nuovo
  });

  ws.addEventListener('message', (ev) => {
    const esito = decodifica(String(ev.data));
    if (!esito.ok) return annota('messaggio illeggibile dal server');
    const m = esito.messaggio;
    if (m.t === DAL_SERVER.BENVENUTO) {
      accolto = true;
      tentativi = 0;
      const u = /** @type {{nome: string}} */ (m.utente);
      segnala('acceso', `A bordo come ${u.nome}`);
      annota(`benvenuto: protocollo v${m.versione}, server ${(/** @type {any} */ (m.server)).versione}, ${m.presenti} a bordo`);
      battito = setInterval(() => {
        pingInviato = performance.now();
        ws.send(codifica(DAL_CLIENT.PING, { n: Math.round(pingInviato) }));
      }, 15000);
    } else if (m.t === DAL_SERVER.PONG) {
      annota(`battito: ${Math.round(performance.now() - pingInviato)} ms`);
    } else if (m.t === DAL_SERVER.ERRORE) {
      const codice = String(m.codice);
      annota('errore: ' + (SPIEGAZIONI[codice] ?? codice));
    } else if (m.t === DAL_SERVER.ADDIO) {
      annota(`il server chiude: ${m.motivo}`);
    }
  });

  ws.addEventListener('close', (ev) => {
    if (battito) { clearInterval(battito); battito = null; }
    segnala('guasto', accolto ? 'Collegamento perso' : 'Il server non ha accettato il collegamento');
    if (ev.code === 4426) return annota('versione del protocollo diversa: ricarica la pagina');
    // Riprova con attesa crescente, fino a un minuto. Ogni tentativo vuole un
    // biglietto nuovo: quello vecchio e' gia' stato consumato.
    const attesa = Math.min(60000, 1000 * 2 ** tentativi++);
    annota(`nuovo tentativo fra ${Math.round(attesa / 1000)} s (chiusura ${ev.code})`);
    setTimeout(async () => {
      try {
        biglietto = await bigliettoNuovo();
        collega();
      } catch (e) {
        annota('biglietto non ottenuto: ' + /** @type {Error} */ (e).message);
        segnala('guasto', 'Server del sito non raggiungibile');
      }
    }, attesa);
  });
}

collega();
