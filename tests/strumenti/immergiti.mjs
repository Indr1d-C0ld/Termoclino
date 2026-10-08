// Prima immersione end-to-end: presenta il biglietto, entra nella palestra,
// ordina 2/3 e quota periscopica, aspetta lo `stato` che li riflette e un
// fotogramma `sonar`, poi esce.
//   node tests/strumenti/immergiti.mjs <url-ws> <biglietto> [origine]
// Esce con 0 se tutto torna, 1 altrimenti. La usa tests/e2e_bordo.sh.
import { WebSocket } from '../../server/node_modules/ws/wrapper.mjs';
import { PROTOCOLLO_VERSIONE, decodificaSettori } from '../../shared/protocol.js';

const [url, biglietto, origine = 'http://127.0.0.1:8160'] = process.argv.slice(2);
const ws = new WebSocket(url, { origin: origine });
const visto = { partita: false, ricevuti: 0, stato: false, sonar: false };
const fine = (/** @type {number} */ codice, /** @type {string} */ testo) => {
  console.log(testo);
  ws.close();
  process.exit(codice);
};
const scadenza = setTimeout(() => fine(1, `tempo scaduto: ${JSON.stringify(visto)}`), 15000);
ws.on('open', () => ws.send(JSON.stringify({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto })));
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  if (m.t === 'errore') fine(1, `errore: ${JSON.stringify(m)}`);
  if (m.t === 'benvenuto') ws.send(JSON.stringify({ t: 'entra', scenario: 'torpex_palestra' }));
  if (m.t === 'partita') {
    visto.partita = true;
    ws.send(JSON.stringify({ t: 'ordine', cosa: 'macchina', valore: '2/3', n: 1 }));
    ws.send(JSON.stringify({ t: 'ordine', cosa: 'quota', valore: 'periscopica', n: 2 }));
  }
  if (m.t === 'ricevuto') visto.ricevuti++;
  if (m.t === 'sonar' && decodificaSettori(m.settori)?.length === 180) visto.sonar = true;
  if (m.t === 'stato' && m.macchina === '2/3' && m.quota_ordinata === 18) visto.stato = true;
  if (visto.partita && visto.ricevuti === 2 && visto.stato && visto.sonar) {
    clearTimeout(scadenza);
    ws.send(JSON.stringify({ t: 'esci' }));
  }
  if (m.t === 'uscita' && m.motivo === 'esci') fine(0, `immersione riuscita: ${JSON.stringify(visto)}`);
});
ws.on('error', (e) => fine(1, `errore: ${e.message}`));
