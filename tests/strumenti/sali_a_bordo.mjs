// Sale a bordo del server di gioco con un biglietto e stampa il benvenuto.
//   node tests/strumenti/sali_a_bordo.mjs <url-ws> <biglietto> [origine]
// Esce con 0 se accolto, 1 altrimenti. Lo usano le prove end-to-end.
import { WebSocket } from '../../server/node_modules/ws/wrapper.mjs';
import { PROTOCOLLO_VERSIONE } from '../../shared/protocol.js';
const [url, biglietto, origine = 'http://127.0.0.1:8160'] = process.argv.slice(2);
const ws = new WebSocket(url, { origin: origine });
const scadenza = setTimeout(() => { console.error('nessuna risposta'); process.exit(1); }, 5000);
ws.on('open', () => ws.send(JSON.stringify({ t: 'ciao', versione: PROTOCOLLO_VERSIONE, biglietto })));
ws.on('message', (d) => {
  const m = JSON.parse(d.toString());
  clearTimeout(scadenza);
  console.log(JSON.stringify(m));
  ws.close();
  process.exit(m.t === 'benvenuto' ? 0 : 1);
});
ws.on('error', (e) => { console.error('errore:', e.message); process.exit(1); });
