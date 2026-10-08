// Gancio di risoluzione per le prove del client in Node.
//
// Nel browser i moduli del client importano i moduli comuni come '../../shared/x.js' a partire da
// /assets/js/client/, cioè /assets/shared/x.js: in sviluppo lo serve index.php da ../shared, in
// esercizio deploy/02-pubblica.sh li copia lì. Sul disco però web/assets/shared/ non esiste: questo
// gancio riporta quei percorsi alla cartella shared/ della radice, come fa rootDirs per tsc.
export async function resolve(specifier, context, nextResolve) {
  if (context.parentURL && (specifier.startsWith('./') || specifier.startsWith('../'))) {
    const u = new URL(specifier, context.parentURL);
    if (u.pathname.includes('/web/assets/shared/')) {
      u.pathname = u.pathname.replace('/web/assets/shared/', '/shared/');
      return nextResolve(u.href, context);
    }
  }
  return nextResolve(specifier, context);
}
