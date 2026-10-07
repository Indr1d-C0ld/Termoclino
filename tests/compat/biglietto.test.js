/**
 * Il biglietto e' il contratto fra PHP (che lo firma) e Node (che lo verifica).
 * Questa prova li mette uno contro l'altro con un carico e un segreto fissi:
 * se uno dei due cambia formato, codifica o algoritmo, qui si rompe subito —
 * invece che in esercizio, con nessuno che riesce a salire a bordo.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { firmaBiglietto, verificaBiglietto } from '../../shared/protocol.js';

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SEGRETO = 'vettore-di-prova-segreto-lungo-trentadue-caratteri';
const CARICO = { v: 1, uid: 42, nome: 'Comandante Prova ò', ruolo: 'admin', exp: 2000000000, nonce: '0123456789abcdef01234567' };

/** Firma lo stesso carico con la classe PHP vera. */
function firmaConPhp() {
  const codice = `
    require '${radice}/web/src/autoload.php';
    echo App\\Gioco\\Biglietto::firma(json_decode($argv[1], true), $argv[2]);
  `;
  return execFileSync('php', ['-r', codice, JSON.stringify(CARICO), SEGRETO], { encoding: 'utf8' });
}

let php = '';
try { execFileSync('php', ['-v']); php = 'si'; } catch { php = ''; }

test('PHP e JavaScript producono lo stesso biglietto, byte per byte', { skip: php ? false : 'php non installato' }, async () => {
  assert.equal(firmaConPhp(), await firmaBiglietto(CARICO, SEGRETO));
});

test('il server accetta un biglietto firmato da PHP', { skip: php ? false : 'php non installato' }, async () => {
  const esito = await verificaBiglietto(firmaConPhp(), SEGRETO, 1999999990);
  assert.equal(esito.ok, true);
  if (esito.ok) assert.equal(esito.carico.nome, 'Comandante Prova ò');
});
