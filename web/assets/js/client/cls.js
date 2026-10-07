// @ts-check
/**
 * Interprete degli script CLS di 688 Attack Sub (1989).
 *
 * Nell'originale i pannelli delle stazioni, i dialoghi e la selezione della missione non sono
 * bitmap: sono script di disegno (bytecode «CLS») eseguiti da GAME.EXE 0000:BB44 con 31 primitive
 * (tabella DS:97A2). L'estrattore (tools/estrai/estrai688.py --client) li decodifica in JSON
 * (cls/*.json) e questo modulo li esegue di nuovo, così com'erano, su un «bersaglio» astratto:
 *
 *   - FrameBuffer: due pagine indicizzate da 64 KB in puro JS (prove, confronti, lavoro senza DOM);
 *   - CanvasTarget: un CanvasRenderingContext2D con fattore di scala intero o frazionario. A scala 1
 *     è identico al pixel all'originale 320×200; a scala maggiore rettangoli, linee e riempimenti si
 *     disegnano nitidi alla risoluzione piena e il font bitmap si ingrandisce al pixel più vicino
 *     (è la base della resa «Remastered» dei pannelli).
 *
 * Il comportamento di ogni primitiva è quello del percorso VGA (modo 5) del gioco, stranezze comprese
 * (testo che a fine finestra ricomincia dall'alto, grassetto a doppia passata, cerchi con il contorno
 * in un colore a parte, figure con l'ultima riga non disegnata): vedi docs/ASSET.md §4.7 e §8.
 * Il riferimento è l'interprete Python dell'estrattore; tests/client/cls.test.js li confronta pixel
 * per pixel su tutti i pannelli.
 *
 * Gli script non disegnano mai lo stato vivo del gioco (mappa, valori, spie): lo fa il codice C di
 * GAME.EXE sopra il pannello. Quello che dagli script si può sapere — zone cliccabili, caselle delle
 * cifre e delle barre, attese di un clic, righe della telescrivente — esce come dati («hotspot» e
 * «agganci») che il client userà per disegnare e animare lo stato.
 *
 * Nessuna dipendenza, nessun passo di compilazione: gira nel browser e in Node 20+.
 */

export const LARGHEZZA = 320;
export const ALTEZZA = 200;
const SEGMENTO = 65536;

/** Mnemonici delle primitive, indice = codice operativo (1-31). */
export const PRIMITIVE = Object.freeze([
  '', 'FILLRECT', 'VLINE', 'HLINE', 'PIXEL', 'PRINT', 'MOVETO', 'DIGITBOX', 'PRINT_SHADOW', 'RECT',
  'HOTSPOT', 'SETMAP', 'TEXTCOLOR', 'TEXTSPACING', 'CIRCLE', 'RUN_CLS', 'WAIT_INPUT', 'PAGE_BACK',
  'SHOW_BACK', 'HIDE_MOUSE', 'PICTURE', 'HOTSPOT_TRUNC', 'CIRCLE_EDGE', 'SHOW_ZOOM', 'SAVE_RECT',
  'RESTORE_RECT', 'PRINT2', 'TEXTWINDOW', 'SPRITE', 'TELETYPE', 'HELPWORD', 'HELPPAIR',
]);

// ---------------------------------------------------------------------------------------- tipi

/** @typedef {'schermo' | 'retro'} NomePagina */
/** @typedef {number | string | { p: number, piu?: number, meno?: number }} ArgomentoCls */
/**
 * Un'istruzione decodificata: `op` (primitiva 1-31, con il mnemonico in `n`) oppure `r` (chiamata
 * della routine locale r), `a` gli argomenti, `@` lo scostamento nel file originale.
 * @typedef {{ '@': number, op?: number, n?: string, r?: number, a: ArgomentoCls[] }} IstruzioneCls
 */
/** @typedef {{ indice: number, nome: string, nargs: number, tipi: number[], codice: IstruzioneCls[] }} RoutineCls */
/** @typedef {{ formato: string, nome: string, routine: RoutineCls[] }} ProgrammaCls */
/** @typedef {{ larghezza: number, altezza: number, righe: number, pixel_per_riga: number, dati: string }} FiguraJson */
/** @typedef {{ figure: Record<string, FiguraJson> }} FigureJson */
/** @typedef {{ codice: number, larghezza: number, righe: number[] }} GlifoJson */
/** @typedef {{ primo_codice: number, glifi: GlifoJson[], cirillico: { A_Z: number[] } }} FontJson */
/** @typedef {{ larghezza: number, altezza: number, righe: Uint8Array[] }} Figura */
/** @typedef {{ larghezze: Uint8Array, righe: Uint8Array[], cirillico: Uint8Array }} Font */
/**
 * Tutto ciò che serve all'interprete: programmi per nome maiuscolo ('STAT.CLS'), figure per nome
 * maiuscolo ('4WAY.ENC'), font.
 * @typedef {{ programmi: Record<string, ProgrammaCls>, figure: Record<string, Figura>, font: Font }} Risorse
 */
/**
 * Zona cliccabile registrata da HOTSPOT. `tasto` è il codice di comando (lettera ASCII come 'R' = 82 o
 * codice interno ≥ 128), `gruppo` raggruppa i pulsanti, `cursore` la forma del puntatore (0-16),
 * `colore` il colore di evidenziazione. Le zone si provano dall'ultima registrata alla prima.
 * @typedef {{ cursore: number, x1: number, y1: number, x2: number, y2: number, colore: number, tasto: number, gruppo: number }} Hotspot
 */
/**
 * Aggancio: regione o evento che il client riempie con lo stato vivo.
 *  - cifra: casella di DIGITBOX (tubi, missili, proiezione temporale, codice di sicurezza), con la cifra
 *    iniziale e, se c'è, il rettangolo della barra [x1, y1, x2, y2];
 *  - attesa: WAIT_INPUT, il ciclo modale del gioco che aspetta un clic;
 *  - mostra: la pagina di retro portata sullo schermo (animazione = apertura dal centro di SHOW_ZOOM);
 *  - telescrivente: una riga della telescrivente della sala radio (animata dal gioco, non disegnata qui);
 *  - sfondo: un'immagine a tutto schermo che il chiamante deve mettere nella pagina;
 *  - esegui_cls, immagine: primitive che nessuno script usa (RUN_CLS, PICTURE), solo annotate.
 * @typedef {{ tipo: string, [k: string]: unknown }} Aggancio
 */
/**
 * Variabili di stato del disegno, come le variabili DS del gioco: colore BD75, spaziatura BD71,
 * interlinea BD73, cursore BD6D/BD6F, finestra di testo BD78/BD7C/BD7A/BD7E, grassetto BD86,
 * colore del contorno dei cerchi BD76, pagina di disegno.
 * @typedef {{ colore: number, spaziatura: number, interlinea: number, x: number, y: number,
 *   finestra: number[], grassetto: number, colore_bordo: number, pagina: NomePagina }} StatoCls
 */
/**
 * Un passo di un lavoro di resa (cls/pannelli.json): routine di uno script, primitiva chiamata
 * direttamente dal codice del gioco, cambio di pagina o sfondo.
 * @typedef {{ file?: string, routine?: number, argomenti?: (number|string)[], primitiva?: string,
 *   pagina?: NomePagina, sfondo?: string }} PassoCls
 */
/**
 * Interfaccia del bersaglio di disegno. Le coordinate sono logiche (320×200); i rettangoli arrivano
 * già ordinati (x1 ≤ x2, y1 ≤ y2) ed estremi inclusi.
 * @typedef {object} Bersaglio
 * @property {(pagina: NomePagina) => void} pagina seleziona la pagina su cui disegnare
 * @property {(da: NomePagina, a: NomePagina, x1: number, y1: number, x2: number, y2: number) => void} copia copia un rettangolo fra le pagine
 * @property {(x1: number, y1: number, x2: number, y2: number, c: number) => void} riempi rettangolo pieno (anche le linee)
 * @property {(x: number, y: number, c: number) => void} pixel un pixel
 * @property {(x: number, y: number, righe: Uint8Array, c: number) => void} glifo 13 righe di 8 bit (MSB a sinistra), solo i bit accesi
 * @property {(x: number, y: number, pixel: Uint8Array, trasparente: number) => void} rigaFigura una riga di figura (indici 0-15; trasparente 255 = nessuno)
 */

// ---------------------------------------------------------------------------------------- utilità

/** Parola a 16 bit con segno, come la vedono i confronti del gioco. @param {number} v */
export function s16(v) {
  return ((v & 0xffff) ^ 0x8000) - 0x8000;
}

/** @param {string} b64 */
function daBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/**
 * Prepara le risorse dai JSON dell'estrattore.
 * @param {{ programmi: ProgrammaCls[], figure: FigureJson, font: FontJson }} json
 * @returns {Risorse}
 */
export function preparaRisorse(json) {
  /** @type {Record<string, ProgrammaCls>} */
  const programmi = {};
  for (const p of json.programmi) programmi[p.nome.toUpperCase()] = p;
  /** @type {Record<string, Figura>} */
  const figure = {};
  for (const [nome, f] of Object.entries(json.figure.figure)) {
    const dati = daBase64(f.dati);
    const righe = [];
    for (let k = 0; k < f.righe; k++) righe.push(dati.subarray(k * f.pixel_per_riga, (k + 1) * f.pixel_per_riga));
    figure[nome.toUpperCase()] = { larghezza: f.larghezza, altezza: f.altezza, righe };
  }
  const n = json.font.glifi.length;
  const larghezze = new Uint8Array(n);
  const righe = [];
  for (let g = 0; g < n; g++) {
    larghezze[g] = json.font.glifi[g].larghezza;
    righe.push(Uint8Array.from(json.font.glifi[g].righe));
  }
  return { programmi, figure, font: { larghezze, righe, cirillico: Uint8Array.from(json.font.cirillico.A_Z) } };
}

/**
 * Carica le risorse dalla cartella generata dall'estrattore (web/assets/originali/): legge il
 * manifesto, tutti gli script cls/*.json, le figure e il font.
 * @param {(percorso: string) => Promise<any>} leggiJson legge un JSON dato il percorso relativo alla cartella
 * @returns {Promise<Risorse>}
 */
export async function caricaRisorse(leggiJson) {
  const manifesto = await leggiJson('manifest.json');
  /** @type {string[]} */
  const script = manifesto.file
    .filter((/** @type {{percorso: string, tipo: string}} */ f) => f.tipo === 'script CLS decodificato')
    .map((/** @type {{percorso: string}} */ f) => f.percorso);
  const [programmi, figure, font] = await Promise.all([
    Promise.all(script.map(leggiJson)), leggiJson('cls/figure.json'), leggiJson('font/font.json'),
  ]);
  return preparaRisorse({ programmi, figure, font });
}

/**
 * Lettore di JSON per il browser, relativo a un URL di base.
 * @param {string | URL} base
 * @returns {(percorso: string) => Promise<any>}
 */
export function leggiJsonDaUrl(base) {
  return async (percorso) => {
    const r = await fetch(new URL(percorso, base));
    if (!r.ok) throw new Error(`${percorso}: HTTP ${r.status}`);
    return r.json();
  };
}

// ---------------------------------------------------------------------------------------- interprete

/** @returns {StatoCls} */
export function statoIniziale() {
  return { colore: 15, spaziatura: 1, interlinea: 9, x: 0, y: 0, finestra: [0, 0, 319, 199],
    grassetto: 0, colore_bordo: 15, pagina: 'schermo' };
}

export class InterpreteCls {
  /**
   * @param {{ risorse: Risorse, bersaglio: Bersaglio, cirillico?: boolean, stato?: Partial<StatoCls>,
   *   sfondo?: (nome: string, pagina: NomePagina, bersaglio: Bersaglio) => void,
   *   suAggancio?: (a: Aggancio) => void }} opzioni
   *   cirillico: scritte dell'Alfa (in partita il gioco lo accende sul lato sovietico; Ctrl-R lo spegne);
   *   sfondo: chiamata per i passi «sfondo» (per esempio la sala di controllo sotto gli hotspot di M.CLS).
   */
  constructor(opzioni) {
    this.risorse = opzioni.risorse;
    this.bersaglio = opzioni.bersaglio;
    this.cirillico = opzioni.cirillico ? 1 : 0;
    /** @type {StatoCls} */
    this.stato = { ...statoIniziale(), ...(opzioni.stato ?? {}) };
    this.stato.finestra = [...this.stato.finestra];
    this.sfondo = opzioni.sfondo;
    this.suAggancio = opzioni.suAggancio;
    /** @type {Hotspot[]} */
    this.hotspot = [];
    /** @type {Record<string, number>} tabella di SETMAP (DS:B45A: CGA, configurazione missione, anticopia) */
    this.tabella = {};
    /** @type {Aggancio[]} */
    this.agganci = [];
    /** @type {number[]} */
    this.parole = [];
    /** @type {number[][]} */
    this.coppie = [];
    /** @type {number[] | null} rettangolo di SAVE_RECT */
    this.salvato = null;
    /** @type {Record<string, number>} */
    this.anomalie = {};
    this.profondita = 0;
    this.bersaglio.pagina(this.stato.pagina);
  }

  /** @param {string} cosa */
  anomalia(cosa) {
    this.anomalie[cosa] = (this.anomalie[cosa] ?? 0) + 1;
  }

  /** @param {Aggancio} a */
  aggancia(a) {
    this.agganci.push(a);
    this.suAggancio?.(a);
  }

  /** Risultato da salvare o confrontare: hotspot, agganci, tabella, liste dell'aiuto. */
  get risultato() {
    return { hotspot: this.hotspot, agganci: this.agganci, tabella: this.tabella, parole: this.parole, coppie: this.coppie };
  }

  /**
   * Esegue una routine di uno script (0 = principale, n = Ln-1), con i parametri della routine.
   * @param {string} file per esempio 'STAT.CLS'
   * @param {number} [routine]
   * @param {(number|string)[]} [parametri]
   */
  esegui(file, routine = 0, parametri = []) {
    const prog = this.risorse.programmi[file.toUpperCase()];
    if (!prog) throw new Error(`script CLS assente: ${file}`);
    this.#routine(prog, routine, parametri.map((p) => (typeof p === 'number' ? s16(p) : p)));
  }

  /**
   * Esegue i passi di un lavoro di resa (cls/pannelli.json).
   * @param {PassoCls[]} passi
   */
  eseguiPassi(passi) {
    for (const p of passi) {
      if (p.file !== undefined) {
        this.esegui(p.file, p.routine ?? 0, p.argomenti ?? []);
      } else if (p.primitiva !== undefined) {
        const op = PRIMITIVE.indexOf(p.primitiva);
        if (op < 1) throw new Error(`primitiva sconosciuta: ${p.primitiva}`);
        this.primitiva(op, (p.argomenti ?? []).map((a) => (typeof a === 'number' ? s16(a) : a)));
      } else if (p.pagina !== undefined) {
        this.#pagina(p.pagina);
      } else if (p.sfondo !== undefined) {
        this.sfondo?.(p.sfondo, this.stato.pagina, this.bersaglio);
        this.aggancia({ tipo: 'sfondo', file: p.sfondo });
      }
    }
  }

  /** @param {NomePagina} nome */
  #pagina(nome) {
    this.stato.pagina = nome;
    this.bersaglio.pagina(nome);
  }

  /**
   * @param {ProgrammaCls} prog
   * @param {number} indice
   * @param {(number|string)[]} par
   */
  #routine(prog, indice, par) {
    if (this.profondita > 32) {
      this.anomalia('ricorsione');
      return;
    }
    const r = prog.routine[indice];
    if (!r) throw new Error(`${prog.nome}: routine ${indice} inesistente`);
    this.profondita++;
    for (const ist of r.codice) {
      /** @type {(number|string)[]} */
      const val = [];
      for (const a of ist.a) {
        if (typeof a === 'number') {
          val.push(s16(a));
        } else if (typeof a === 'string') {
          val.push(a);
        } else {
          let pv = par[a.p];
          if (pv === undefined) {
            pv = 0;
            this.anomalia('parametro mancante');
          }
          if (typeof pv === 'string') {
            // aritmetica sui puntatori alle stringhe: possibile nel bytecode, mai usata dagli script
            val.push(a.piu !== undefined ? pv.slice(a.piu) : pv);
          } else if (a.piu !== undefined) {
            val.push(s16(pv + a.piu));
          } else if (a.meno !== undefined) {
            val.push(s16(pv - a.meno));
          } else {
            val.push(pv);
          }
        }
      }
      if (ist.r !== undefined) this.#routine(prog, ist.r, val);
      else this.primitiva(/** @type {number} */ (ist.op), val);
    }
    this.profondita--;
  }

  /**
   * Esegue una primitiva con argomenti già valutati (come fa il codice C del gioco quando la chiama
   * direttamente).
   * @param {number} op
   * @param {(number|string)[]} v
   */
  primitiva(op, v) {
    const n = (/** @type {number} */ i) => /** @type {number} */ (v[i]);
    const t = (/** @type {number} */ i) => String(v[i]);
    switch (op) {
      case 1: this.riempi(n(0), n(1), n(2), n(3), n(4)); break;
      case 2: this.vline(n(0), n(1), n(2), n(3)); break;
      case 3: this.hline(n(0), n(1), n(2), n(3)); break;
      case 4: this.bersaglio.pixel(n(0), n(1), n(2) & 0xff); break;
      case 5: case 26: this.stampa(t(0)); break;
      case 6: this.stato.x = n(0); this.stato.y = n(1); break;
      case 7: this.casellaCifra(n(0), n(1), n(2), n(3)); break;
      case 8: this.stampaOmbra(t(0), n(1), n(2)); break;
      case 9: this.rett(n(0), n(1), n(2), n(3), n(4)); break;
      case 10:
        this.hotspot.push({ cursore: n(0), x1: n(1), y1: n(2), x2: n(3), y2: n(4), colore: n(5) & 0xff,
          tasto: n(6) & 0xff, gruppo: n(7) & 0xff });
        break;
      case 11: this.tabella[String(n(0) & 0xffff)] = n(1) & 0xff; break;
      case 12: this.stato.colore = n(0) & 0xff; break;
      case 13: this.stato.spaziatura = n(0); break;
      case 14: this.cerchio(n(0), n(1), n(2), n(3), n(4)); break;
      case 15: this.aggancia({ tipo: 'esegui_cls', file: t(0) }); break;
      case 16: this.aggancia({ tipo: 'attesa', argomenti: v.map(Number) }); break;
      case 17: this.#pagina('retro'); break;
      case 18: case 23:
        // SHOW_BACK porta tutta la pagina di retro sullo schermo; SHOW_ZOOM lo fa con un'apertura
        // animata dal centro della finestra e finisce allo stesso modo (0000:F0CD -> 0000:E9B4)
        this.bersaglio.copia('retro', 'schermo', 0, 0, LARGHEZZA - 1, ALTEZZA - 1);
        this.#pagina('schermo');
        this.aggancia({ tipo: 'mostra', animazione: op === 23 });
        break;
      case 19: break; // nasconde il puntatore del mouse: niente da disegnare
      case 20: this.aggancia({ tipo: 'immagine', file: t(0) }); break;
      case 21: if (n(0) < this.hotspot.length) this.hotspot.length = Math.max(n(0), 0); break;
      case 22: this.stato.colore_bordo = n(0) & 0xff; break;
      case 24:
        this.salvato = [n(0), n(1), n(2), n(3)];
        this.bersaglio.copia('schermo', 'retro', n(0), n(1), n(2), n(3));
        break;
      case 25:
        if (this.salvato && this.salvato[0] >= 0) {
          const [x1, y1, x2, y2] = this.salvato;
          this.bersaglio.copia('retro', 'schermo', x1, y1, x2, y2);
        }
        this.salvato = null;
        break;
      case 27:
        this.stato.finestra = [n(0), n(1), n(2), n(3)];
        this.stato.x = n(0);
        this.stato.y = n(1);
        break;
      case 28: this.figura(t(0), n(1), n(2), n(3) & 0xff); break;
      case 29: this.aggancia({ tipo: 'telescrivente', testo: t(0), colore: this.stato.colore }); break;
      case 30: this.parole.push(n(0) & 0xffff); break;
      case 31: this.coppie.push([n(0) & 0xff, n(1) & 0xff]); break;
      default: this.anomalia(`primitiva sconosciuta ${op}`);
    }
  }

  // ------------------------------------------------------------------------------ grafica

  /** FILLRECT (0000:A2C6). @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  riempi(x1, y1, x2, y2, c) {
    if (x1 > x2) [x1, x2] = [x2, x1];
    if (y1 > y2) [y1, y2] = [y2, y1];
    this.bersaglio.riempi(x1, y1, x2, y2, c & 0xff);
  }

  /** HLINE (0000:ABFE). @param {number} y @param {number} x1 @param {number} x2 @param {number} c */
  hline(y, x1, x2, c) {
    if (x2 < x1) [x1, x2] = [x2, x1];
    this.bersaglio.riempi(x1, y, x2, y, c & 0xff);
  }

  /** VLINE (0000:B004). @param {number} x @param {number} y1 @param {number} y2 @param {number} c */
  vline(x, y1, y2, c) {
    if (y2 < y1) [y1, y2] = [y2, y1];
    this.bersaglio.riempi(x, y1, x, y2, c & 0xff);
  }

  /** RECT (0000:E838): due HLINE e due VLINE. @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  rett(x1, y1, x2, y2, c) {
    this.hline(y1, x1, x2, c);
    this.hline(y2, x1, x2, c);
    this.vline(x1, y1, y2, c);
    this.vline(x2, y1, y2, c);
  }

  /**
   * CIRCLE (0000:EA36). modo 0: contorno di 8 pixel per passo nel colore di CIRCLE_EDGE (non c);
   * modo 1: pieno di colore c; modo 2: pieno e poi il contorno.
   * @param {number} cx @param {number} cy @param {number} r @param {number} c @param {number} modo
   */
  cerchio(cx, cy, r, c, modo) {
    let x = r, y = 0, d1 = 2 * r - 1, d2 = 1, err = 0;
    while (x >= y) {
      if (modo) {
        this.hline(cy + y, cx - x, cx + x, c);
        this.hline(cy - y, cx - x, cx + x, c);
        this.hline(cy + x, cx - y, cx + y, c);
        this.hline(cy - x, cx - y, cx + y, c);
      } else {
        const b = this.stato.colore_bordo & 0xff;
        const p = this.bersaglio;
        p.pixel(cx + x, cy + y, b); p.pixel(cx - x, cy + y, b); p.pixel(cx + x, cy - y, b); p.pixel(cx - x, cy - y, b);
        p.pixel(cx + y, cy + x, b); p.pixel(cx - y, cy + x, b); p.pixel(cx + y, cy - x, b); p.pixel(cx - y, cy - x, b);
      }
      err += d2;
      d2 += 2;
      y++;
      if (err >= x) {
        err -= d1;
        d1 -= 2;
        x--;
      }
    }
    if (modo === 2) this.cerchio(cx, cy, r, c, 0);
  }

  /** Riquadro incassato (0000:ED31). @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  incasso(x1, y1, x2, y2) {
    this.riempi(x1 + 1, y1 + 1, x2 - 1, y2 - 1, 0);
    this.hline(y1, x1, x2, 8);
    this.hline(y2, x1 + 1, x2, 15);
    this.vline(x1, y1, y2, 8);
    this.vline(x2, y1 + 1, y2, 15);
  }

  /**
   * DIGITBOX (0000:EBF4): riquadro incassato con la cifra grande 87h+n e, se barra ≠ 0, il riquadro
   * della barra grigia. La cifra e la barra poi le ridisegna il gioco con lo stato vivo: per questo
   * la casella esce anche come aggancio «cifra».
   * @param {number} n @param {number} x @param {number} y @param {number} barra
   */
  casellaCifra(n, x, y, barra) {
    const car = (0x87 + n) & 0xff;
    this.stato.colore = 15;
    this.incasso(x, y, x + 10, y + 10);
    /** @type {Aggancio} */
    const a = { tipo: 'cifra', x1: x, y1: y, x2: x + 10, y2: y + 10, valore: n };
    if (barra) {
      this.incasso(x + 13, y - 1, x + 59, y + 10);
      this.riempi(x + 15, y + 1, x + 57, y + 8, 8);
      a.barra = [x + 15, y + 1, x + 57, y + 8];
    }
    this.aggancia(a);
    this.stato.x = x + 2;
    this.stato.y = y + 2;
    this.stampa(String.fromCharCode(car));
  }

  /**
   * SPRITE (0000:EFB9 -> 0000:B28F): la base è a y+H; si disegnano H righe dal basso verso l'alto,
   * quindi l'ultima riga memorizzata (quella in cima) resta fuori. Colore = nibble.
   * @param {string} nome @param {number} x @param {number} y @param {number} trasp
   */
  figura(nome, x, y, trasp) {
    const f = this.risorse.figure[nome.toUpperCase()];
    if (!f) {
      this.anomalia(`figura mancante ${nome}`);
      return;
    }
    const H = f.altezza;
    let yb = y + H;
    const limite = yb - H;
    let resto = H;
    let k = 0;
    for (;;) {
      if (k < f.righe.length) this.bersaglio.rigaFigura(x, yb, f.righe[k], trasp);
      if (yb === limite) break;
      yb--;
      resto = (resto - 1) & 0xffff;
      k++;
      if (resto === 0) break;
    }
  }

  // ------------------------------------------------------------------------------ testo (0000:D630)

  /** A capo (0000:D8D8): bordo sinistro; se la riga dopo non ci sta, si ricomincia dall'alto. */
  aCapo() {
    const s = this.stato;
    s.x = s.finestra[0];
    let yy = s.y + 2 * s.interlinea;
    if (yy > s.finestra[3]) yy = s.finestra[1] + s.interlinea;
    s.y = yy - s.interlinea;
  }

  /**
   * PRINT. '@' commuta il grassetto ('@@' stampa '@'), '\n' va a capo, a fine finestra si va a capo
   * prima del glifo. In grassetto il glifo si ridisegna un pixel più a destra partendo dalla posizione
   * salvata PRIMA di un eventuale a capo, e con il carattere non rimappato dal cirillico: è quello che
   * fa il gioco.
   * @param {string} s
   */
  stampa(s) {
    const st = this.stato;
    const font = this.risorse.font;
    const len = s.length;
    let i = 0;
    for (;;) {
      let bl = i < len ? s.charCodeAt(i) & 0xff : 0;
      const dopo = i + 1 < len ? s.charCodeAt(i + 1) & 0xff : 0;
      if (bl !== 0x40) {
        if (this.cirillico) {
          if (bl >= 0x41 && bl <= 0x5a) bl = font.cirillico[bl - 0x41];
          if (bl >= 0x34 && bl <= 0x39) bl += 0xad;
        }
        if (bl === 10) {
          this.aCapo();
          i++;
          continue;
        }
        if (bl === 0) return;
      }
      if (bl < 0x20 || bl === 0x40) {
        if (dopo === 0x40) {
          i++;
        } else {
          st.grassetto ^= 1;
          i++;
          continue;
        }
      }
      const x0 = st.x, y0 = st.y;
      let seconda = false;
      for (;;) {
        const g = bl - 0x20;
        if (g < 0 || g >= font.larghezze.length) {
          this.anomalia(`glifo inesistente ${bl}`);
          break;
        }
        const w = font.larghezze[g];
        if (st.x + w + st.spaziatura > st.finestra[2]) this.aCapo();
        this.bersaglio.glifo(st.x, st.y, font.righe[g], st.colore & 0xff);
        st.x = s16(st.x + w + st.spaziatura);
        if (seconda || !st.grassetto) break;
        seconda = true;
        st.x = x0 + 1;
        st.y = y0;
        bl = i < len ? s.charCodeAt(i) & 0xff : 0;
      }
      i++;
    }
  }

  /**
   * PRINT_SHADOW (0000:EC97): tre passate d'ombra a (+1,0), (+1,+1), (0,+1), poi il testo.
   * @param {string} s @param {number} c @param {number} cOmbra
   */
  stampaOmbra(s, c, cOmbra) {
    const st = this.stato;
    const x0 = st.x, y0 = st.y;
    st.colore = cOmbra & 0xff;
    for (const [dx, dy] of [[1, 0], [1, 1], [0, 1]]) {
      st.x = x0 + dx;
      st.y = y0 + dy;
      this.stampa(s);
    }
    st.x = x0;
    st.y = y0;
    st.colore = c & 0xff;
    this.stampa(s);
  }
}

// ---------------------------------------------------------------------------------------- bersagli

/**
 * Due pagine indicizzate in puro JS, modellate come i segmenti del gioco: 64 KB lineari, scrittura
 * all'indirizzo (y·320 + x) mod 65536, nessun ritaglio. Le scritture fuori dai 320×200 si contano in
 * `fuoriSchermo` (negli script originali non ce n'è nessuna).
 * @implements {Bersaglio}
 */
export class FrameBuffer {
  constructor() {
    /** @type {Record<NomePagina, Uint8Array>} */
    this.pagine = { schermo: new Uint8Array(SEGMENTO), retro: new Uint8Array(SEGMENTO) };
    /** @type {Uint8Array} */
    this.attiva = this.pagine.schermo;
    this.fuoriSchermo = 0;
  }

  /** @param {NomePagina} nome */
  pagina(nome) {
    this.attiva = this.pagine[nome];
  }

  /** @param {number} x @param {number} y @param {number} c */
  #scrivi(x, y, c) {
    if (x < 0 || x >= LARGHEZZA || y < 0 || y >= ALTEZZA) this.fuoriSchermo++;
    this.attiva[(y * LARGHEZZA + x) & 0xffff] = c;
  }

  /** @param {NomePagina} da @param {NomePagina} a @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  copia(da, a, x1, y1, x2, y2) {
    const src = this.pagine[da], dst = this.pagine[a];
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        const o = (y * LARGHEZZA + x) & 0xffff;
        dst[o] = src[o];
      }
    }
  }

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  riempi(x1, y1, x2, y2, c) {
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) this.#scrivi(x, y, c);
  }

  /** @param {number} x @param {number} y @param {number} c */
  pixel(x, y, c) {
    this.#scrivi(x, y, c);
  }

  /** @param {number} x @param {number} y @param {Uint8Array} righe @param {number} c */
  glifo(x, y, righe, c) {
    for (let r = 0; r < 13; r++) {
      const b = righe[r];
      if (!b) continue;
      for (let bit = 0; bit < 8; bit++) if (b & (0x80 >> bit)) this.#scrivi(x + bit, y + r, c);
    }
  }

  /** @param {number} x @param {number} y @param {Uint8Array} pixel @param {number} trasparente */
  rigaFigura(x, y, pixel, trasparente) {
    for (let i = 0; i < pixel.length; i++) {
      const p = pixel[i];
      if (trasparente !== 0xff && p === trasparente) continue;
      this.#scrivi(x + i, y, p);
    }
  }

  /** I 64000 indici visibili di una pagina. @param {NomePagina} [nome] */
  indici(nome = 'schermo') {
    return this.pagine[nome].subarray(0, LARGHEZZA * ALTEZZA);
  }

  /** Riempie una pagina con 64000 indici (per esempio una sala di controllo). @param {NomePagina} nome @param {ArrayLike<number>} dati */
  caricaIndici(nome, dati) {
    const pg = this.pagine[nome];
    const n = Math.min(dati.length, LARGHEZZA * ALTEZZA);
    for (let i = 0; i < n; i++) pg[i] = dati[i];
  }

  /**
   * Pagina convertita in RGBA (per ImageData o per salvarla).
   * @param {NomePagina} nome @param {number[][]} palette 256 colori [r, g, b]
   */
  rgba(nome, palette) {
    const ind = this.indici(nome);
    const out = new Uint8ClampedArray(LARGHEZZA * ALTEZZA * 4);
    for (let i = 0; i < ind.length; i++) {
      const c = palette[ind[i]] ?? [0, 0, 0];
      out[i * 4] = c[0];
      out[i * 4 + 1] = c[1];
      out[i * 4 + 2] = c[2];
      out[i * 4 + 3] = 255;
    }
    return out;
  }
}

/**
 * Disegno su Canvas 2D con un fattore di scala qualunque. Ogni pixel logico (x, y) occupa il
 * rettangolo di dispositivo [round(x·s), round((x+1)·s)) × [round(y·s), round((y+1)·s)): a scala 1 è
 * l'originale pixel per pixel; a scala intera o frazionaria non ci sono né sbavature né fessure.
 * La pagina «schermo» è il contesto dato; la «retro» è una tela fuori schermo della stessa misura
 * (si può passare la propria).
 * @implements {Bersaglio}
 */
export class CanvasTarget {
  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {{ palette: number[][], scala?: number, retro?: CanvasRenderingContext2D }} opzioni
   *   palette: 256 colori [r, g, b] (DAY per le stazioni); scala: pixel di dispositivo per pixel logico
   */
  constructor(ctx, opzioni) {
    this.scala = opzioni.scala ?? 1;
    this.colori = opzioni.palette.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
    const w = this.#dx(LARGHEZZA), h = this.#dx(ALTEZZA);
    let retro = opzioni.retro;
    if (!retro) {
      const tela = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(w, h)
        : Object.assign(document.createElement('canvas'), { width: w, height: h });
      retro = /** @type {CanvasRenderingContext2D} */ (tela.getContext('2d'));
    }
    // il buffer di retro del gioco parte nero (indice 0), come quello di FrameBuffer
    retro.fillStyle = this.colori[0] ?? 'rgb(0,0,0)';
    retro.fillRect(0, 0, w, h);
    /** @type {Record<NomePagina, CanvasRenderingContext2D>} */
    this.pagine = { schermo: ctx, retro };
    for (const c of Object.values(this.pagine)) c.imageSmoothingEnabled = false;
    /** @type {CanvasRenderingContext2D} */
    this.attiva = ctx;
  }

  /** Coordinata logica -> dispositivo. @param {number} v */
  #dx(v) {
    return Math.round(v * this.scala);
  }

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} colore */
  #rett(x1, y1, x2, y2, colore) {
    const a = this.#dx(x1), b = this.#dx(y1);
    this.attiva.fillStyle = colore;
    this.attiva.fillRect(a, b, this.#dx(x2 + 1) - a, this.#dx(y2 + 1) - b);
  }

  /** @param {number} c */
  #colore(c) {
    return this.colori[c] ?? 'rgb(0,0,0)';
  }

  /** @param {NomePagina} nome */
  pagina(nome) {
    this.attiva = this.pagine[nome];
  }

  /** @param {NomePagina} da @param {NomePagina} a @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 */
  copia(da, a, x1, y1, x2, y2) {
    const sx = this.#dx(x1), sy = this.#dx(y1), w = this.#dx(x2 + 1) - sx, h = this.#dx(y2 + 1) - sy;
    if (w <= 0 || h <= 0) return;
    // copia esatta: si svuota la destinazione, poi si disegna (anche i pixel trasparenti restano tali)
    this.pagine[a].clearRect(sx, sy, w, h);
    this.pagine[a].drawImage(this.pagine[da].canvas, sx, sy, w, h, sx, sy, w, h);
  }

  /** @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {number} c */
  riempi(x1, y1, x2, y2, c) {
    this.#rett(x1, y1, x2, y2, this.#colore(c));
  }

  /** @param {number} x @param {number} y @param {number} c */
  pixel(x, y, c) {
    this.#rett(x, y, x, y, this.#colore(c));
  }

  /** Bit accesi del glifo, a tratti orizzontali (ingrandimento al pixel più vicino).
   * @param {number} x @param {number} y @param {Uint8Array} righe @param {number} c */
  glifo(x, y, righe, c) {
    const col = this.#colore(c);
    for (let r = 0; r < 13; r++) {
      const b = righe[r];
      let bit = 0;
      while (bit < 8) {
        if (!(b & (0x80 >> bit))) {
          bit++;
          continue;
        }
        const inizio = bit;
        while (bit < 8 && b & (0x80 >> bit)) bit++;
        this.#rett(x + inizio, y + r, x + bit - 1, y + r, col);
      }
    }
  }

  /** @param {number} x @param {number} y @param {Uint8Array} pixel @param {number} trasparente */
  rigaFigura(x, y, pixel, trasparente) {
    let i = 0;
    while (i < pixel.length) {
      const p = pixel[i];
      if (trasparente !== 0xff && p === trasparente) {
        i++;
        continue;
      }
      const inizio = i;
      while (i < pixel.length && pixel[i] === p) i++;
      this.#rett(x + inizio, y, x + i - 1, y, this.#colore(p));
    }
  }

  /**
   * Disegna un'immagine a tutto schermo (per esempio la sala di controllo) nella pagina attiva,
   * ingrandita al pixel più vicino. @param {CanvasImageSource} immagine
   */
  disegnaImmagine(immagine) {
    this.attiva.imageSmoothingEnabled = false;
    this.attiva.drawImage(immagine, 0, 0, this.#dx(LARGHEZZA), this.#dx(ALTEZZA));
  }
}

// ---------------------------------------------------------------------------------------- comodità

/**
 * Esegue un lavoro di cls/pannelli.json su un bersaglio e restituisce l'interprete (con hotspot,
 * agganci, tabella e stato finale).
 * @param {Risorse} risorse
 * @param {{ passi: PassoCls[], cirillico?: boolean }} lavoro
 * @param {Bersaglio} bersaglio
 * @param {{ cirillico?: boolean, sfondo?: (nome: string, pagina: NomePagina, bersaglio: Bersaglio) => void }} [opzioni]
 *   cirillico: sostituisce quello del lavoro (Ctrl-R sul lato Alfa)
 */
export function eseguiLavoro(risorse, lavoro, bersaglio, opzioni = {}) {
  const it = new InterpreteCls({
    risorse, bersaglio, cirillico: opzioni.cirillico ?? lavoro.cirillico ?? false, sfondo: opzioni.sfondo,
  });
  it.eseguiPassi(lavoro.passi);
  return it;
}

/**
 * Zona cliccabile sotto il punto (x, y), come la cerca il gioco (0000:C975): dall'ultima registrata
 * alla prima, estremi inclusi.
 * @param {Hotspot[]} hotspot @param {number} x @param {number} y
 * @returns {Hotspot | null}
 */
export function hotspotIn(hotspot, x, y) {
  for (let i = hotspot.length - 1; i >= 0; i--) {
    const h = hotspot[i];
    if (x >= h.x1 && x <= h.x2 && y >= h.y1 && y <= h.y2) return h;
  }
  return null;
}
