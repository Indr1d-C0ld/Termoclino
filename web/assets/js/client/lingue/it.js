// @ts-check
/**
 * Catalogo italiano (lingua predefinita, decisione D6).
 *
 *  - `sonar.*`, `towed.*`, `macchina.*`, `guardia.*`, `navigazione.*`, `timone.*`: i rapporti
 *    dell'equipaggio, con le chiavi del server (docs/PROTOCOLLO.md v1, «Rapporti dell'equipaggio»);
 *  - `ricevuto.*`: l'equipaggio ripete l'ordine accettato, come nel 1989 («HEADING TO 150 FEET
 *    CAPTAIN.»): il server manda `ricevuto {cosa, valore}` e la frase la fa il client;
 *  - `errore.*`, `motivo.*`, `uscita.*`: codici stabili di shared/protocol.js;
 *  - `locale.*`: messaggi che nascono nel client; `ui.*`: scritte disegnate sul pannello;
 *  - `fmt.*`: parole usate dai formati dei segnaposto.
 *
 * Il font del 1989 ha solo maiuscole senza accenti: si scrive come sulle telescriventi (E' per È).
 * Segnaposto: {nome} oppure {nome|formato}; formati in lingue/indice.js.
 */
export default /** @type {Record<string, string>} */ ({
  // --- rapporti dell'equipaggio (chiavi del server) ---
  'sonar.nuovo_contatto': 'NUOVO CONTATTO {contatto}{sensore|sensore} PER {rilevamento|gradi}{speculare|oppure}',
  'sonar.contatto_perso': 'CONTATTO {contatto} PERSO',
  'towed.in_filare': "FILIAMO L'ANTENNA RIMORCHIATA",
  'towed.filata': 'ANTENNA RIMORCHIATA FILATA, COMANDANTE',
  'towed.in_ritiro': "RITIRIAMO L'ANTENNA RIMORCHIATA",
  'towed.ritirata': 'ANTENNA RIMORCHIATA A BORDO',
  'towed.tagliata': 'ANTENNA RIMORCHIATA TAGLIATA',
  'towed.persa': 'ANTENNA RIMORCHIATA PERDUTA, COMANDANTE!',
  'towed.stabilizzata': "L'ANTENNA E' STABILE, SI ASCOLTA",
  'towed.sorda': "A {velocita} NODI L'ANTENNA E' SORDA",
  'towed.curva': "A {velocita} NODI L'ANTENNA SI INCURVA",
  'towed.velocita_pericolosa': "SOPRA I {velocita_danno} NODI PERDIAMO L'ANTENNA!",
  'macchina.cavitazione': 'STIAMO CAVITANDO! SOTTO I {v_cavitazione|nodi} NODI A QUESTA QUOTA',
  'macchina.fine_cavitazione': "NON CAVITIAMO PIU', COMANDANTE",
  'guardia.quota_collaudo_vicina': 'VICINI ALLA QUOTA DI COLLAUDO, COMANDANTE',
  'guardia.oltre_quota_collaudo': 'SIAMO OLTRE LA QUOTA DI COLLAUDO!',
  'guardia.collasso': 'LO SCAFO CEDE! SOMMERGIBILE PERDUTO!',
  'guardia.urto_fondale': 'ABBIAMO TOCCATO IL FONDO, SCAFO DANNEGGIATO!',
  'guardia.in_superficie': 'SIAMO IN SUPERFICIE, COMANDANTE',
  'guardia.ripreso_il_comando': "BENTORNATO, COMANDANTE: IL BATTELLO E' SUO",
  'navigazione.fondale_vicino': 'SOLO {sotto_chiglia|piedi} PIEDI SOTTO LA CHIGLIA!',
  'navigazione.fondale_avanti': 'IL FONDO SALE A {distanza|iarde} IARDE DI PRUA!',
  'navigazione.waypoint_raggiunto': 'WAYPOINT {indice|ordinale} RAGGIUNTO, COMANDANTE',
  'navigazione.ultimo_waypoint': 'ULTIMO WAYPOINT: TENIAMO LA ROTTA',
  'timone.rotta_raggiunta': 'ROTTA {rotta|gradi}, COMANDANTE',
  'timone.quota_raggiunta': 'QUOTA {quota|piedi} PIEDI, COMANDANTE',

  // --- l'equipaggio ripete gli ordini accettati ---
  'ricevuto.macchina': 'MACCHINA {valore|macchina}, COMANDANTE',
  'ricevuto.timone': 'TIMONE {gradi} A {lato|lato}',
  'ricevuto.timone_zero': 'TIMONE AL CENTRO',
  'ricevuto.timoni_o': 'TIMONI ORIZZONTALI {gradi} A {verso|verso}',
  'ricevuto.timoni_o_zero': 'TIMONI ORIZZONTALI A ZERO',
  'ricevuto.quota': 'ANDIAMO A {valore|piedi} PIEDI, COMANDANTE.',
  'ricevuto.quota_automatica': 'ANDIAMO A 150 PIEDI, COMANDANTE.',
  'ricevuto.quota_periscopica': 'ANDIAMO A QUOTA PERISCOPICA, COMANDANTE',
  'ricevuto.quota_emersione': 'EMERSIONE RAPIDA! SOFFIARE LA ZAVORRA!',
  'ricevuto.rotta': 'ACCOSTIAMO PER {valore|gradi}, COMANDANTE',
  'ricevuto.waypoint': 'WAYPOINT IMPOSTATO, COMANDANTE',
  'ricevuto.waypoint_svuota': 'WAYPOINT CANCELLATI',
  'ricevuto.autopilota_si': 'AUTOPILOTA INSERITO',
  'ricevuto.autopilota_no': 'AUTOPILOTA DISINSERITO',
  'ricevuto.scala_tempo': 'SCALA DEL TEMPO {valore}X',
  'ricevuto.pausa_si': 'PAUSA',
  'ricevuto.pausa_no': 'SI RIPRENDE',

  // --- errori del server (codici stabili di shared/protocol.js) ---
  'errore.biglietto_scaduto': 'BIGLIETTO SCADUTO: NE CHIEDO UN ALTRO',
  'errore.biglietto_gia_usato': "BIGLIETTO GIA' USATO: NE CHIEDO UN ALTRO",
  'errore.biglietto_non_valido': 'BIGLIETTO NON RICONOSCIUTO',
  'errore.biglietto_assente': 'MANCA IL BIGLIETTO',
  'errore.versione_protocollo': 'PROTOCOLLO DIVERSO: RICARICARE LA PAGINA',
  'errore.origine_non_ammessa': 'ORIGINE NON AMMESSA',
  'errore.troppo_in_fretta': 'TROPPI ORDINI IN POCO TEMPO',
  'errore.non_presentato': 'IL SERVER ASPETTA ANCORA IL BIGLIETTO',
  'errore.messaggio_malformato': 'MESSAGGIO MALFORMATO',
  'errore.messaggio_troppo_grande': 'MESSAGGIO TROPPO GRANDE',
  'errore.tipo_sconosciuto': 'MESSAGGIO SCONOSCIUTO AL SERVER',
  'errore.scenario_sconosciuto': 'ESERCITAZIONE SCONOSCIUTA',
  'errore.gia_in_partita': "SIAMO GIA' IN MARE",
  'errore.non_in_partita': 'NON SIAMO ANCORA IN MARE',
  'errore.partita_piena': "LA PALESTRA E' AL COMPLETO",
  'errore.ordine_non_valido': 'ORDINE NON VALIDO ({motivo})',
  'errore.ordine_rifiutato': 'ORDINE NON ESEGUIBILE, COMANDANTE',
  'motivo.tempo_bloccato': 'NON SIAMO SOLI IN MARE: IL TEMPO NON SI TOCCA',
  'motivo.senza_towed': "NON ABBIAMO L'ANTENNA RIMORCHIATA",
  'motivo.towed_stato': "L'ANTENNA NON E' NELLO STATO GIUSTO",
  'motivo.troppi_waypoint': 'NON SI POSSONO IMPOSTARE ALTRI WAYPOINT',
  'motivo.nessun_waypoint': 'NESSUN WAYPOINT DA SEGUIRE, COMANDANTE',
  'motivo.fuori_area': "WAYPOINT FUORI DALL'AREA DELL'ESERCITAZIONE",
  'motivo.indice': 'QUEL WAYPOINT NON ESISTE',
  'uscita.esci': 'SIAMO USCITI DALLA PALESTRA',
  'uscita.altra_connessione': "IL BATTELLO E' PASSATO A UN'ALTRA PLANCIA",
  'uscita.partita_chiusa': "L'ESERCITAZIONE E' FINITA",

  // --- messaggi del client ---
  'locale.benvenuto': 'COLLEGAMENTO SATELLITARE STABILITO',
  'locale.collegamento_perso': 'COLLEGAMENTO PERSO: RIPROVO',
  'locale.zoom_massimo': 'IMPOSSIBILE ALLONTANARE ANCORA LA MAPPA, COMANDANTE',
  'locale.zoom_minimo': 'IMPOSSIBILE AVVICINARE ANCORA LA MAPPA, COMANDANTE',
  'locale.non_disponibile': 'NON DISPONIBILE IN QUESTA ESERCITAZIONE',
  'locale.stazione_non_disponibile': 'STAZIONE NON ANCORA IN SERVIZIO (F1)',
  'locale.seleziona_waypoint': 'SCEGLIERE IL PUNTO DEL WAYPOINT',
  'locale.waypoint_massimi': 'NON SI POSSONO IMPOSTARE ALTRI WAYPOINT',
  'locale.nessun_contatto': 'NESSUN CONTATTO',
  'locale.bersaglio_acquisito': 'BERSAGLIO ACQUISITO',
  'locale.contatto_perso': 'CONTATTO PERSO',
  'locale.attesa_partita': 'IN ATTESA DELLA PARTITA...',
  'locale.senza_towed': "QUESTO BATTELLO NON HA L'ANTENNA RIMORCHIATA",

  // --- scritte del client sul pannello ---
  'ui.stazione.X': 'USCITA',
  'ui.stazione.R': 'SALA RADIO (F2)',
  'ui.stazione.U': 'PANNELLO DI STATO (F3)',
  'ui.stazione.T': 'GOVERNO (F4)',
  'ui.stazione.P': 'PERISCOPIO (F5)',
  'ui.stazione.N': 'TAVOLO DI NAVIGAZIONE (F6)',
  'ui.stazione.W': 'CONTROLLO ARMI (F7)',
  'ui.stazione.S': 'SALA SONAR (F8)',
  'ui.contatto_sonar': 'CONTATTO SONAR (SOLO RILEVAMENTO)',
  'ui.contatto_perso': 'CONTATTO PERSO',
  'ui.cascata.sfera': 'SFERA',
  'ui.cascata.towed': 'TOWED',
  'ui.cascata.entrambi': 'S+T',
  'ui.cascata.relativo': 'REL',
  'ui.cascata.vero': 'VERO',
  'ui.cascata.stivata': 'ANTENNA NON FILATA',
  'ui.cascata.in_filare': 'FILANDO: {metri} M',
  'ui.cascata.in_ritiro': 'RITIRANDO: {metri} M',
  'ui.cascata.tagliata': 'ANTENNA TAGLIATA',
  'ui.cascata.persa': 'ANTENNA PERDUTA',
  'ui.cascata.assente': 'NESSUNA ANTENNA RIMORCHIATA',
  'ui.cascata.sorda': 'SORDA',
  'ui.cascata.attesa': 'IN ATTESA DEL SONAR',
  'ui.aiuto.titolo': 'AIUTO',
  'ui.aiuto.testo':
    'F2-F8 STAZIONI   F9 CONN   F10 CAPO\n' +
    'TAB E FRECCE: SCEGLIERE UN COMANDO\n' +
    'LETTERE E CIFRE: PORTARE IL CURSORE\n' +
    'INVIO O CLIC: ESEGUIRE IL COMANDO\n' +
    'I/O ZOOM  H HUD  B FONDALE  T MAPPA\n' +
    'ESC O F1 PER CHIUDERE',

  // --- parole dei formati ---
  'fmt.macchina.stop': 'FERMA',
  'fmt.macchina.1/3': 'AVANTI UN TERZO',
  'fmt.macchina.2/3': 'AVANTI DUE TERZI',
  'fmt.macchina.std': 'AVANTI NORMALE',
  'fmt.macchina.full': 'AVANTI TUTTA',
  'fmt.macchina.flank': 'AVANTI A TUTTA FORZA',
  'fmt.macchina.rev': 'INDIETRO',
  'fmt.lato.dritta': 'DRITTA',
  'fmt.lato.sinistra': 'SINISTRA',
  'fmt.verso.scendere': 'SCENDERE',
  'fmt.verso.salire': 'SALIRE',
  'fmt.sensore.sfera': '',
  'fmt.sensore.towed': " ALL'ANTENNA",
  'fmt.oppure': 'O',
});
