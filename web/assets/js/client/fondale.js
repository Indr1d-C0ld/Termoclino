// @ts-check
/**
 * Il fondale per la mappa: la batimetria vera dello scenario, letta con il modulo comune
 * shared/ambiente.js (dati EMODnet ed ETOPO in shared/data/scenari/<scenario>.json + .batimetria.bin).
 * Se per qualche ragione non si carica (file mancanti, rete), un fondale sintetico dichiarato come
 * tale permette comunque di lavorare.
 *
 * Il client chiede alla batimetria una cosa sola: la profondità del fondo in un punto del piano dello
 * scenario (metri, positiva = acqua, ≤ 0 = terra, null = fuori dai dati). È il `Campionatore` di
 * resa/mappa.js; `Ambiente.fondale` restituisce già metri positivi in mare e negativi a terra, NaN
 * fuori dalla griglia.
 *
 * I dati della batimetria chiedono l'attribuzione (EMODnet, CC BY 4.0): il campo `crediti` dello
 * scenario si mostra insieme alla mappa (plancia.js).
 */

/** @typedef {import('./resa/mappa.js').Campionatore} Campionatore */
/** @typedef {{ dati: string, licenza: string, testo: string }} Credito */

/**
 * Fondale sintetico «alla Fær Øer»: un arcipelago sull'origine, una piattaforma fra 20 e 250 m, una
 * scarpata verso un canale profondo a sud-est e il bacino a nord. Serve solo a lavorare senza i dati
 * veri (e al finto server); si riconosce dal nome.
 * @param {{ x0: number, y0: number, x1: number, y1: number } | null} area
 * @returns {Campionatore}
 */
export function fondaleSintetico(area) {
  const isole = [
    { x: -9000, y: 6000, rx: 7000, ry: 11000 },
    { x: 4000, y: 9000, rx: 5000, ry: 7000 },
    { x: -2000, y: -9000, rx: 4000, ry: 6000 },
    { x: 12000, y: -2000, rx: 3500, ry: 3000 },
  ];
  return (x, y) => {
    if (area && (x < area.x0 || x > area.x1 || y < area.y0 || y > area.y1)) return null;
    // distanza «normalizzata» dalla costa più vicina (negativa dentro un'isola), in metri
    let costa = Infinity;
    for (const i of isole) {
      const dx = (x - i.x) / i.rx, dy = (y - i.y) / i.ry;
      const r = Math.hypot(dx, dy);
      const frastagliato = 0.12 * Math.sin(5 * Math.atan2(dy, dx) + i.x * 1e-3) + 0.06 * Math.sin(13 * Math.atan2(dy, dx));
      costa = Math.min(costa, (r - 1 - frastagliato) * Math.min(i.rx, i.ry));
    }
    if (costa <= 0) return -1;
    let d = Math.min(250, 20 + costa * 0.012);
    const canale = (x - y) / Math.SQRT2 - 30000;
    if (canale > 0) d += Math.min(1300, canale * 0.06);
    if (y > 45000) d += Math.min(2200, (y - 45000) * 0.08);
    d += 12 * Math.sin(x / 2300) * Math.cos(y / 3100);
    return Math.max(2, d);
  };
}

/**
 * Carica la batimetria vera dello scenario con shared/ambiente.js (che legge i suoi file accanto a
 * sé, cioè da assets/shared/). Null se non ci riesce: il chiamante ripiega sul sintetico.
 * @param {string} scenario
 * @param {string} baseShared URL di assets/shared/ (finisce con '/')
 * @returns {Promise<{ campiona: Campionatore, crediti: Credito[] } | null>}
 */
export async function caricaFondaleVero(scenario, baseShared) {
  try {
    const modulo = await import(new URL('ambiente.js', new URL(baseShared, location.href)).href);
    const amb = await modulo.caricaAmbiente(scenario);
    /** @type {Campionatore} */
    const campiona = (x, y) => {
      const d = amb.fondale(x, y);
      return Number.isFinite(d) ? d : null;
    };
    return { campiona, crediti: creditiDi(amb.grezzi) };
  } catch (e) {
    console.warn('batimetria dello scenario non disponibile:', e);
    return null;
  }
}

/**
 * I crediti di uno scenario (campo `crediti` del JSON), nella forma che si mostra.
 * @param {unknown} grezzi
 * @returns {Credito[]}
 */
export function creditiDi(grezzi) {
  const c = /** @type {any} */ (grezzi)?.crediti;
  if (!Array.isArray(c)) return [];
  return c
    .filter((x) => x && typeof x.testo === 'string')
    .map((x) => ({ dati: String(x.dati ?? ''), licenza: String(x.licenza ?? ''), testo: x.testo }));
}
