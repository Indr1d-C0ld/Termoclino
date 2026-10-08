// @ts-check
/**
 * Testo con il font di GAME.EXE (224 glifi, 20h-FFh) sulla tela indicizzata.
 *
 * Il font ha due corpi: 20h-5Fh maiuscole piccole (5 righe) e segni, 60h-7Fh maiuscole grandi
 * (7 righe) che nel gioco si scrivono in minuscolo; 87h-90h le cifre grandi (le stesse di DIGITBOX).
 * Il nastro dei messaggi usa le maiuscole grandi con le cifre piccole, la barra di stato le cifre
 * grandi e «%» come due punti (è il glifo largo 2 con i due quadratini): l'abbiamo misurato sulle
 * catture DOSBox, vedi la nota in cima a ogni funzione che lo usa.
 *
 * I cataloghi dei messaggi sono in italiano e in inglese, ma il font del 1989 non ha lettere accentate:
 * `perIlFont` le riduce alla lettera semplice con l'apostrofo, come si scriveva sulle telescriventi.
 */

/** @typedef {import('./tela.js').Tela} Tela */
/** @typedef {{ larghezze: Uint8Array, righe: Uint8Array[] }} FontGioco il font come lo prepara cls.js */

/** Codice del primo glifo. */
const PRIMO = 0x20;
/** Cifre grandi: 87h + n. */
export const CIFRA_GRANDE = 0x87;

/**
 * Riduce un testo ai caratteri del font: maiuscole, niente accenti (È → E'), niente '@' (che per
 * l'interprete CLS commuta il grassetto), caratteri ignoti → spazio.
 * @param {string} s
 */
export function perIlFont(s) {
  const accentate = /** @type {Record<string, string>} */ ({ 'À': "A'", 'È': "E'", 'É': "E'", 'Ì': "I'", 'Ò': "O'", 'Ù': "U'" });
  let out = '';
  for (const ch of s.toUpperCase()) {
    if (accentate[ch]) { out += accentate[ch]; continue; }
    const c = ch.charCodeAt(0);
    if (ch === '@' || c < 0x20 || c > 0x5f) {
      const base = ch.normalize('NFD').charAt(0);
      const b = base.charCodeAt(0);
      out += b >= 0x20 && b <= 0x5f && base !== '@' ? base : ' ';
    } else out += ch;
  }
  return out;
}

/**
 * Le lettere passano alle maiuscole grandi (codici 61h-7Ah, cioè le minuscole ASCII); cifre e segni
 * restano piccoli, come nel nastro dei messaggi del 1989.
 * @param {string} s già passato da perIlFont
 */
export function inGrande(s) {
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/**
 * Larghezza in pixel di un testo (avanzamento = larghezza del glifo + spaziatura, l'ultima compresa).
 * @param {FontGioco} font @param {string} s @param {number} [spaziatura]
 */
export function larghezzaTesto(font, s, spaziatura = 1) {
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const g = (s.charCodeAt(i) & 0xff) - PRIMO;
    if (g >= 0 && g < font.larghezze.length) w += font.larghezze[g] + spaziatura;
  }
  return w;
}

/**
 * Disegna un testo (codici del font così come sono) e restituisce la x dopo l'ultimo glifo.
 * @param {Tela} tela @param {FontGioco} font @param {number} x @param {number} y @param {string} s
 * @param {number} colore @param {number} [spaziatura]
 */
export function scrivi(tela, font, x, y, s, colore, spaziatura = 1) {
  for (let i = 0; i < s.length; i++) {
    const g = (s.charCodeAt(i) & 0xff) - PRIMO;
    if (g < 0 || g >= font.larghezze.length) continue;
    const righe = font.righe[g];
    for (let r = 0; r < 13; r++) {
      const b = righe[r];
      if (!b) continue;
      for (let bit = 0; bit < 8; bit++) if (b & (0x80 >> bit)) tela.pixel(x + bit, y + r, colore);
    }
    x += font.larghezze[g] + spaziatura;
  }
  return x;
}

/**
 * Testo con contorno di un pixel (le etichette dell'HUD sopra la mappa: ciano bordato di nero).
 * @param {Tela} tela @param {FontGioco} font @param {number} x @param {number} y @param {string} s
 * @param {number} colore @param {number} bordo
 */
export function scriviBordato(tela, font, x, y, s, colore, bordo) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    scrivi(tela, font, x + dx, y + dy, s, bordo);
  }
  return scrivi(tela, font, x, y, s, colore);
}

/**
 * Testo con ombra come PRINT_SHADOW (0000:EC97): tre passate d'ombra a (+1,0), (+1,+1), (0,+1).
 * @param {Tela} tela @param {FontGioco} font @param {number} x @param {number} y @param {string} s
 * @param {number} colore @param {number} ombra
 */
export function scriviOmbra(tela, font, x, y, s, colore, ombra) {
  for (const [dx, dy] of [[1, 0], [1, 1], [0, 1]]) scrivi(tela, font, x + dx, y + dy, s, ombra);
  return scrivi(tela, font, x, y, s, colore);
}

/**
 * Cifre grandi (quelle di DIGITBOX e della barra di stato): '0'-'9' → 87h+n, ':' → '%'.
 * @param {string} s
 */
export function cifreGrandi(s) {
  let out = '';
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') out += String.fromCharCode(CIFRA_GRANDE + ch.charCodeAt(0) - 48);
    else if (ch === ':') out += '%';
    else out += ch;
  }
  return out;
}
