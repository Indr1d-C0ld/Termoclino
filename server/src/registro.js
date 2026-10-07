// @ts-check
/**
 * Registro a righe JSON su stdout: `docker logs` le conserva e le ruota, e una
 * riga JSON si filtra con jq senza espressioni regolari fragili.
 * Il biglietto non si registra MAI per intero: basta il nonce per ritrovarlo.
 */

const PESO = { debug: 10, info: 20, warn: 30, error: 40 };

/**
 * @param {'debug'|'info'|'warn'|'error'} soglia
 * @param {(riga: string) => void} [scrivi]
 */
export function creaRegistro(soglia, scrivi = (r) => process.stdout.write(r + '\n')) {
  /**
   * @param {'debug'|'info'|'warn'|'error'} livello
   * @param {string} evento
   * @param {Record<string, unknown>} [dati]
   */
  function annota(livello, evento, dati = {}) {
    if (PESO[livello] < PESO[soglia]) return;
    scrivi(JSON.stringify({ ora: new Date().toISOString(), livello, evento, ...dati }));
  }
  return {
    /** @param {string} e @param {Record<string, unknown>} [d] */ debug: (e, d) => annota('debug', e, d),
    /** @param {string} e @param {Record<string, unknown>} [d] */ info: (e, d) => annota('info', e, d),
    /** @param {string} e @param {Record<string, unknown>} [d] */ warn: (e, d) => annota('warn', e, d),
    /** @param {string} e @param {Record<string, unknown>} [d] */ error: (e, d) => annota('error', e, d),
  };
}

/** @typedef {ReturnType<typeof creaRegistro>} Registro */
