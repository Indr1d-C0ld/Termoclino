/**
 * Un sigillo ha UNA sola grafia valida. In base64 l'ultimo carattere di un
 * blocco porta bit di riempimento che la decodifica ignora: confrontando i byte
 * decodificati, cambiare quei bit lasciava passare il biglietto (3 casi su 64
 * prima della correzione). Qui si provano tutte le varianti dell'ultimo carattere.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firmaBiglietto, verificaBiglietto } from '../../shared/protocol.js';

const S = 'segreto-di-prova-lungo-almeno-trentadue-caratteri';
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

test('nessuna grafia alternativa del sigillo viene accettata', async () => {
  const b = await firmaBiglietto({ v: 1, uid: 1, nome: 'x', ruolo: 'player', exp: 2e9, nonce: 'ab'.repeat(12) }, S);
  assert.equal((await verificaBiglietto(b, S, 1e9)).ok, true);
  let accettate = 0;
  for (const c of ALFABETO) {
    if (c === b.slice(-1)) continue;
    if ((await verificaBiglietto(b.slice(0, -1) + c, S, 1e9)).ok) accettate++;
  }
  assert.equal(accettate, 0);
});
