// @ts-check
/**
 * Il collegamento con il server di gioco: biglietto, presentazione, battito, riconnessione.
 *
 * È il ciclo della plancia di F0 (collaudato da tests/e2e_bordo.sh) chiuso in una classe: il primo
 * biglietto arriva con la pagina, ogni nuovo tentativo ne chiede uno nuovo a PHP (sono monouso), con
 * attesa crescente fino a un minuto. In più, dalla versione 1 del protocollo: appena accolto il
 * client chiede di entrare nella palestra, e manda gli ordini.
 */
import { PROTOCOLLO_VERSIONE, DAL_CLIENT, DAL_SERVER, SCENARI, codifica, decodifica } from '../../shared/protocol.js';

/** Lo scenario di F1. */
export const SCENARIO_F1 = SCENARI[0];

/** @typedef {'spento' | 'in-corso' | 'acceso' | 'guasto'} StatoCollegamento */
/**
 * @typedef {object} OpzioniCollegamento
 * @property {string} ws indirizzo del WebSocket
 * @property {string} biglietto il primo biglietto, rilasciato con la pagina
 * @property {() => Promise<string>} nuovoBiglietto chiede un biglietto nuovo a PHP
 * @property {(m: import('../../shared/protocol.js').Messaggio) => void} suMessaggio
 * @property {(s: StatoCollegamento, nota: string) => void} suStato
 * @property {string} [scenario]
 */

export class Collegamento {
  /** @param {OpzioniCollegamento} o */
  constructor(o) {
    this.o = o;
    this.biglietto = o.biglietto;
    this.tentativi = 0;
    /** @type {WebSocket | null} */
    this.ws = null;
    /** @type {ReturnType<typeof setInterval> | null} */
    this.battito = null;
    this.accolto = false;
    /** Ultima latenza misurata col ping, in ms. */
    this.latenza = NaN;
    this.pingInviato = 0;
  }

  apri() {
    this.o.suStato('in-corso', 'collegamento');
    const ws = new WebSocket(this.o.ws);
    this.ws = ws;
    this.accolto = false;

    ws.addEventListener('open', () => {
      ws.send(codifica(DAL_CLIENT.CIAO, { versione: PROTOCOLLO_VERSIONE, biglietto: this.biglietto }));
      this.biglietto = ''; // monouso: il prossimo collegamento ne chiede uno nuovo
    });

    ws.addEventListener('message', (ev) => {
      const esito = decodifica(String(ev.data));
      if (!esito.ok) return;
      const m = esito.messaggio;
      if (m.t === DAL_SERVER.BENVENUTO) {
        this.accolto = true;
        this.tentativi = 0;
        this.o.suStato('acceso', String(/** @type {any} */ (m.utente)?.nome ?? ''));
        this.battito = setInterval(() => {
          this.pingInviato = performance.now();
          this.invia(DAL_CLIENT.PING, { n: Math.round(this.pingInviato) });
        }, 15000);
        this.invia(DAL_CLIENT.ENTRA, { scenario: this.o.scenario ?? SCENARIO_F1 });
      } else if (m.t === DAL_SERVER.PONG) {
        this.latenza = Math.round(performance.now() - this.pingInviato);
      }
      this.o.suMessaggio(m);
    });

    ws.addEventListener('close', (ev) => {
      if (this.battito) { clearInterval(this.battito); this.battito = null; }
      this.ws = null;
      this.o.suStato('guasto', this.accolto ? 'perso' : 'rifiutato');
      if (ev.code === 4426) return; // versione diversa: serve ricaricare la pagina
      // Riprova con attesa crescente, fino a un minuto. Ogni tentativo vuole un biglietto nuovo:
      // quello vecchio e' gia' stato consumato.
      const attesa = Math.min(60000, 1000 * 2 ** this.tentativi++);
      setTimeout(async () => {
        try {
          this.biglietto = await this.o.nuovoBiglietto();
          this.apri();
        } catch {
          this.o.suStato('guasto', 'sito');
        }
      }, attesa);
    });
  }

  /** @param {string} t @param {Record<string, unknown>} [campi] */
  invia(t, campi = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(codifica(t, campi));
  }

  /**
   * Un ordine al battello (PROTOCOLLO.md v1): `n` torna in `ricevuto` o nell'`errore`.
   * @param {string} cosa @param {unknown} valore @param {number} n
   */
  ordina(cosa, valore, n) {
    this.invia(DAL_CLIENT.ORDINE, { cosa, valore, n });
  }
}

/**
 * Biglietto nuovo da PHP (POST con il token CSRF). Se la sessione è scaduta si ricarica la pagina,
 * che rimanda all'accesso.
 * @param {string} url @param {string} csrf
 */
export async function chiediBiglietto(url, csrf) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrf, Accept: 'application/json' },
    credentials: 'same-origin',
  });
  if (r.status === 401) {
    location.reload();
    throw new Error('sessione scaduta');
  }
  const j = await r.json();
  if (!j.ok) throw new Error(j.errore ?? 'biglietto non rilasciato');
  return /** @type {string} */ (j.biglietto);
}
