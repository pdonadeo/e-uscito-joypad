# Analisi delle funzioni del backoffice `/bo`

- **Stato:** approvata da Paolo il 2026-11-15 (Fase 3.1).
- **Nota (2026-11-22, rimozione di Django):** l'analisi è nata per riscrivere il vecchio backoffice di `/bo` (React su REST `/api/bo`, codice in `frontend/src/bo/`). Dalla Fase 1 di via-django `/bo` è il backoffice nuovo (`new-bo/`, su GraphQL) e il vecchio non c'è più; Django e `/legacy-bo` sono spariti nelle Fasi 5 e 7. Dove il testo dice «il vecchio `/bo`» parla del backoffice precedente; i riferimenti al suo codice e a quello di Django sono storici.
- **Perimetro:** il backoffice nuovo doveva fare esattamente quello che faceva il vecchio `/bo` (AC-1), niente di più. Dove il vecchio `/bo` e l'admin Django divergevano si è seguito il vecchio `/bo`, e la divergenza è annotata nella sezione [Differenze tra Django e `/bo`](#differenze-tra-django-e-bo).
- **Fonti:**
  - `euscitojoypad_db/backoffice/admin.py` e `euscitojoypad_db/backoffice/models.py` (Django);
  - `django.contrib.auth` (tabella `auth_user`);
  - il frontend di `/bo`, in `frontend/src/bo/*`;
  - l'API `/api/bo`, in `src/admin/*.ml`.

## Convenzioni

- **ID delle funzioni:** `F-<area>-<nn>`, stabili. Un ID non si rinumera e non si riusa: se una funzione sparisce, l'ID resta segnato come ritirato.
  - Aree: `AU` autenticazione, `EP` episodi, `VG` videogame, `AS` associazioni episodio↔videogame, `UT` utenti.
  - Ogni ID `F-` deve avere un'operazione GraphQL (o un commento `# F-xx-nn` nello schema), un test API e un test e2e (AC-4, AC-20).
- **Vincoli trasversali:** `V-<nn>`. Sono regole di sicurezza e comportamento comuni a tutte le operazioni. Si verificano con test API, non con un'operazione dello schema né con un e2e dedicato.
- **Origine:** `file:righe`. I percorsi sono abbreviati:
  - `admin.py` e `models.py` stanno in `euscitojoypad_db/backoffice/`;
  - i file `.ml` stanno in `src/admin/`;
  - i file `.jsx` e `.js` stanno in `frontend/src/bo/`.
- **Messaggi:** i testi tra «» sono i messaggi d'errore dell'API, che `/bo` mostra all'utente così come sono.

## Dati

Sono i campi che l'API espone oggi, e servono da base per i tipi dello schema (Fase 3.3).

### Episodio (`backoffice_episodio`, `models.py:83-142`)

| Campo | Tipo | Regole in scrittura (`input.ml`, `episodi.ml:90-157`) |
|---|---|---|
| `id` | intero | — |
| `titolo` | testo | obbligatorio, al massimo 256 caratteri, spazi esterni rimossi |
| `episodio_numero` | testo o null | al massimo 32 caratteri; vuoto → null |
| `data_uscita` | data | obbligatoria, formato `AAAA-MM-GG` |
| `durata` | durata | obbligatoria. In ingresso `H:MM:SS` o `MM:SS`, con ore fino a 4 cifre e minuti e secondi < 60. In uscita `HH:MM:SS` |
| `url`, `url_post`, `url_video` | URL o null | `http://` o `https://`, senza spazi, al massimo 256 caratteri |
| `descrizione_html`, `descrizione_txt`, `note` | testo o null | testo libero, non viene trimmato; solo spazi → null |
| `pubblicato` | booleano | default `false` |
| `cover` | testo o null | percorso relativo a `MEDIA_ROOT`. Si scrive solo con l'upload (F-EP-10) |
| `cover_url` | URL o null | calcolato: `/bo/files/` + `cover` (`episodi.ml:12-17`) |
| `ts_created`, `ts` | timestamp | sola lettura |
| `associazioni` | lista | solo nel dettaglio (F-EP-05, F-EP-09) |

### Videogame (`backoffice_videogame`, `models.py:16-53`)

| Campo | Tipo | Regole |
|---|---|---|
| `id` | intero | — |
| `rawg_slug` | testo | obbligatorio e unico. Solo lettere, cifre, `-` e `_`, al massimo 256 caratteri (`rawg.ml:17-24`) |
| `titolo` | testo o null | al massimo 256 caratteri; di solito viene da RAWG |
| `descrizione_raw`, `descrizione_html` | testo o null | di solito vengono da RAWG |
| `cover` | URL o null | al massimo 200 caratteri; di solito viene da RAWG |
| `rawg_json` | JSON o null | **sempre in sola lettura** per il client |
| `ts_created`, `ts` | timestamp | sola lettura |

L'elenco espone solo `id`, `titolo`, `rawg_slug`, `cover` e `ts` (`videogame.ml:8`).

### Associazione episodio↔videogame (`backoffice_associazioneepisodiovideogame`, `models.py:167-198`)

| Campo | Tipo | Regole |
|---|---|---|
| `id` | intero | — |
| `episodio_id`, `videogame_id` | intero | `videogame_id` è obbligatorio e il videogame deve esistere |
| `istante` | durata o null | `H:MM:SS`. Campo assente → `0:00:00`; null o stringa vuota → null |
| `speaker` | scelta | `TUTT` (Tutti, default), `BORD` (Matteo Bordone (corri!)), `FOSS` (Francesco Fossetti (salta!)), `ZAMP` (Alessandro Zampini (spara!)) |
| `tipologia` | scelta | `FREE` (Chiacchiera libera, default), `RECE` (Recensione), `CONS` (Consiglio), `STAR` (Osservatorio Start Citizen) |
| `videogame_titolo` | testo | denormalizzato, sola lettura |
| `episodio_titolo`, `episodio_numero`, `data_uscita` | — | denormalizzati, sola lettura. Ci sono solo nella risorsa `associazioni`, non dentro l'episodio |

### Utente (`auth_user`, `django.contrib.auth`)

| Campo | Tipo | Regole (`utenti.ml:57-93`) |
|---|---|---|
| `id` | intero | — |
| `username` | testo | obbligatorio e unico, al massimo 150 caratteri. Lettere, cifre, `@ . + - _` e caratteri non ASCII |
| `password` | — | **mai restituita**. In scrittura: almeno 8 caratteri, hash `pbkdf2_sha256` compatibile con Django |
| `first_name`, `last_name` | testo | al massimo 150 caratteri; vuoto ammesso |
| `email` | testo | al massimo 254 caratteri; se non è vuota deve essere un indirizzo valido |
| `is_staff`, `is_active`, `is_superuser` | booleano | in creazione il default è `true`, `true`, `false` |
| `last_login`, `date_joined` | timestamp o null | sola lettura |

L'**utente corrente** (`me`) ha `id`, `username`, `fullName` e `is_superuser`. `fullName` è nome + cognome, oppure lo username se sono vuoti (`auth.ml:108-116`).

## Funzioni

### Autenticazione e permessi

| ID | Funzione | Origine | Comportamento atteso |
|---|---|---|---|
| F-AU-01 | Login | `django.contrib.auth`; `auth.ml:118-157`; `authProvider.js:43-54` | Username e password. Si entra solo se l'utente esiste, la password è giusta ed è `is_active` **e** `is_staff`. In tutti gli altri casi la risposta è la stessa: 401 «Credenziali non valide o utente non abilitato». Se l'utente non esiste si spende lo stesso tempo di una verifica vera (`dummy_verify`). Un hash con meno iterazioni del target viene ricalcolato (come `must_update` di Django). Il login rigenera la sessione, aggiorna `last_login` e restituisce l'utente corrente |
| F-AU-02 | Logout | `auth.ml:159-161`; `authProvider.js:56-59` | Invalida la sessione. Risponde sempre con successo, anche senza sessione |
| F-AU-03 | Utente corrente | `auth.ml:108-116,163`; `authProvider.js:61-77` | Restituisce `id`, `username`, `fullName` e `is_superuser`. Senza sessione valida risponde 401 «Autenticazione richiesta», e l'interfaccia porta al login. Nell'intestazione si mostra `fullName` |
| F-AU-04 | Permessi staff/superuser | `routes.ml:16-17,36-46`; `App.jsx:35-64`; `authProvider.js:67-72,81-88` | Lo staff gestisce episodi e videogame (e legge le associazioni). **Utenti** è riservato ai superuser: per gli altri la voce di menu non c'è e l'API risponde 403 «Operazione riservata ai superuser». Un 403 si mostra come notifica e non chiude la sessione; un 401 riporta al login |
| F-AU-05 | Rivalidazione della sessione | `auth.ml:62,75-98` | A ogni richiesta l'utente viene riletto dal DB. Se è stato disattivato o ha perso `is_staff`, la richiesta riceve subito 401. La sessione contiene un'impronta dell'hash della password, quindi un cambio di password fatto da qualunque parte (anche da `/legacy-bo`) chiude le sessioni aperte di quell'utente. Fa eccezione la sessione di chi cambia la propria password (F-UT-05, F-AU-06) |
| F-AU-06 | Cambio della propria password | `django.contrib.admin` (pagina «Cambia password» di `/legacy-bo`); nel vecchio `/bo` mancava; in `/bo` dalla 3.6c.4d | Ogni utente staff, superuser o no, cambia la propria password indicando quella attuale. La nuova deve avere almeno 8 caratteri (stesso messaggio di F-UT-04: «Campo «password»: almeno 8 caratteri») e riceve l'hash di F-UT-04. Password attuale sbagliata → «La password attuale non è corretta», come errore di input e non di autenticazione: la sessione resta aperta. La sessione corrente resta valida, quelle dello stesso utente altrove si chiudono (F-AU-05). Solo GraphQL (`cambiaPassword`), nessun endpoint in `/api/bo` |

### Episodi

| ID | Funzione | Origine | Comportamento atteso |
|---|---|---|---|
| F-EP-01 | Elenco paginato | `admin.py:29-38,41-42,45-67`; `episodi.jsx:36-58` | 20 righe per pagina, con il totale e il selettore «Righe per pagina» (5, 10, 25, 50) della paginazione del vecchio `/bo`. Colonne: numero, titolo, data uscita, durata, **cover presente**, **URL audio presente**, **URL post presente**, **URL video presente**, pubblicato. Le quattro colonne "presente" sono booleani calcolati: vero se il campo non è null e non è vuoto. Un clic sulla riga apre la modifica |
| F-EP-02 | Ordinamento | `admin.py:39`; `episodi.ml:66-76`; `ra_codec.ml:78-86` | Il default è `data_uscita` decrescente. Si può ordinare per numero, titolo, data uscita, durata e pubblicato, in entrambe le direzioni; le colonne "presente" non sono ordinabili. I null vanno in fondo, e a parità decide l'`id` |
| F-EP-03 | Ricerca | `admin.py:40`; `episodi.ml:60-61`; `ra_codec.ml:60-63`; `input.ml:124-133` | Una casella di testo, sempre visibile, cerca in numero e titolo. La ricerca è "contiene" e non distingue maiuscole e minuscole. Gli spazi esterni si ignorano, e `%`, `_` e `\` valgono letteralmente. Una stringa vuota non filtra |
| F-EP-04 | Filtro «Pubblicato» | `episodi.jsx:31-34`; `episodi.ml:64,81`; `ra_codec.ml:65-69` | Non è sempre visibile: si aggiunge da «Aggiungi filtro». Tre stati: tutti, sì, no. Si combina con la ricerca. **C'è solo in `/bo`**: vedi la questione aperta Q-1 |
| F-EP-05 | Dettaglio | `episodi.ml:19-51,84`; `choices.js:16-19` | Tutti i campi della tabella [Episodio](#episodio-backoffice_episodio-modelspy83-142), con l'anteprima della cover e le associazioni (F-EP-09) ordinate per istante (null in fondo, a parità per `id`). Il form di modifica parte **sempre** dal dettaglio completo e mai dalla riga dell'elenco: altrimenti un salvataggio cancellerebbe associazioni e cover |
| F-EP-06 | Creazione | `episodi.ml:90-157,244-259`; `episodi.jsx:62-101,109-113` | Validazione come nella tabella [Episodio](#episodio-backoffice_episodio-modelspy83-142). Nel form la durata vale `0:30:00` e pubblicato vale `false`. Le associazioni si salvano nella stessa richiesta e nella stessa transazione. Una cover scelta nel form si carica subito dopo, con F-EP-10. Dopo il salvataggio si apre la modifica del nuovo episodio |
| F-EP-07 | Modifica | `episodi.ml:184-279`; `episodi.jsx:103-107` | Stesse regole della creazione. Il salvataggio aspetta la risposta del server (modalità pessimistica). Se il campo `associazioni` manca, le associazioni non si toccano; se vale `null` le cancella tutte, come `[]` (`episodi.ml:111`); altrimenti le sostituisce (F-EP-09). Le modifiche alla cover partono dopo il salvataggio dei campi (F-EP-10, F-EP-11). Su un id inesistente risponde 404 «Risorsa non trovata» |
| F-EP-08 | Eliminazione | `models.py:175-176`; `episodi.ml:281-299` | Cancella l'episodio e le sue associazioni in un'unica transazione, e restituisce il record cancellato. Il file della cover resta su disco. Si può cancellare dalla modifica oppure **in blocco** dall'elenco, selezionando più righe (azione «Elimina» del vecchio `/bo`, che corrisponde a `delete_selected` di Django) |
| F-EP-09 | Giochi associati (inline) | `admin.py:19-23,43`; `models.py:145-198`; `episodi.jsx:84-99`; `episodi.ml:108-171,203-242` | Nel form dell'episodio c'è un elenco di righe da aggiungere e rimuovere. Ogni riga ha: videogame (obbligatorio, scelto con la ricerca testuale di F-VG-03 (titolo, descrizione, slug), opzioni ordinate per titolo; in `/bo` la scelta usa invece `cercaVideogame` (3.6c.4b), che cerca solo nel titolo con le regole della ricerca del sito pubblico: sotto i 6 caratteri «contiene» per parole, per titolo; dai 6 in su `word_similarity` > 0.25, per somiglianza; vedi `docs/schema.graphql`), istante (`H:MM:SS`, default `0:00:00`), speaker (default Tutti) e tipologia (default Chiacchiera libera). Il salvataggio sostituisce le associazioni in tre passi: cancella quelle che non ci sono più, aggiorna quelle con un `id` dell'episodio, inserisce le altre. Due `id` uguali → 400 «Campo «associazioni»: id duplicati». Un videogame inesistente → 400 «Videogame inesistenti: [..]» |
| F-EP-10 | Caricamento della cover | `admin.py:10-16`; `models.py:73-80,116-123`; `media.ml:1-131`; `episodi.ml:311-329`; `dataProvider.js:12-45,55-68` | **Resta su REST:** `POST /api/bo/episodi/:id/cover`, multipart con il campo `file`. Accetta solo PNG (estensione `.png` e firma del file), al massimo 10 MB. Il nome salvato è `covers/episodi-<numero>-<nome>.png` (in slug); se esiste già, si aggiunge un suffisso casuale `_xxxxxxx`. Il campo del form di `/bo` dice «Trascina qui un'immagine PNG o fai clic per sceglierla» (`episodi.jsx:69-77`); l'avvertenza di Django «PNG 256×256, nessun ridimensionamento» (`models.py:121-122`) in `/bo` non c'è. Se in creazione l'upload fallisce, l'episodio appena creato **si cancella**, così un nuovo "Salva" non crea un duplicato. Errori: «Il file deve essere un'immagine PNG», «File troppo grande (massimo 10 MB)» (413), «Campo «file» mancante», «File vuoto», «Atteso un upload multipart/form-data con il campo «file»», 404 «Risorsa non trovata» se l'episodio non esiste |
| F-EP-11 | Rimozione della cover | `episodi.ml:331-337`; `dataProvider.js:35-45` | **Resta su REST:** `DELETE /api/bo/episodi/:id/cover`. Azzera il campo e lascia il file su disco, come il "Cancella" di Django. Parte quando si toglie la cover dal form e si salva |

### Videogame

| ID | Funzione | Origine | Comportamento atteso |
|---|---|---|---|
| F-VG-01 | Elenco paginato | `admin.py:72`; `videogame.jsx:25-33` | Colonne: **miniatura della cover** (massimo 60×40), titolo, RAWG slug. 10 righe per pagina, con il totale e il selettore «Righe per pagina». Un clic sulla riga apre la modifica |
| F-VG-02 | Ordinamento | `models.py:20`; `videogame.ml:36-37` | Il default è `titolo` crescente. Si può ordinare per titolo e per RAWG slug; la cover non è ordinabile |
| F-VG-03 | Ricerca | `admin.py:73`; `videogame.ml:29-32` | Cerca in titolo, descrizione testuale e RAWG slug, con le stesse regole di F-EP-03. Serve anche per scegliere il videogame in F-EP-09 |
| F-VG-04 | Dettaglio | `admin.py:74-88`; `videogame.ml:10-22`; `videogame.jsx:38-59,93-101` | RAWG slug, titolo, descrizione (TXT), descrizione (HTML), cover (URL), più `rawg_json` **in sola lettura**: JSON formattato, che va a capo e non allarga la pagina (altezza massima 400 px, con scorrimento). La sezione F-VG-08 sta sotto |
| F-VG-05 | Creazione con dati da RAWG | `models.py:41-49,56-70`; `videogame.ml:50-109`; `rawg.ml:26-67`; `videogame.jsx:83-91,103-107` | Serve solo lo slug RAWG. Il server interroga sempre RAWG (`/games/{slug}`), e titolo, descrizioni, cover e `rawg_json` arrivano da lì, **sovrascrivendo** quello che è stato scritto nel form. Titolo e cover si troncano a 256 e 200 caratteri. Sotto quei campi il form avverte «NON COMPILARE MANUALMENTE: viene preso da RAWG». Errori: «Gioco «x» non trovato su RAWG» (400), «RAWG non ha risposto in tempo» (timeout 15 s, 504), «Impossibile contattare RAWG», «RAWG ha risposto con lo stato N», «Risposta RAWG non valida» o «Risposta RAWG senza il campo «name»» (502), «Esiste già un videogame con questo slug RAWG» (409). Dopo il salvataggio si apre la modifica |
| F-VG-06 | Modifica | `videogame.ml:111-146`; `dataProvider.js:70-76` | Si possono modificare slug, titolo, descrizioni e cover. `rawg_json` non è mai modificabile dal client. Se `rawg_json` c'è già, resta quello e RAWG **non** viene interrogato, nemmeno se lo slug cambia. Se manca, si interroga RAWG, che sovrascrive titolo, descrizioni e cover |
| F-VG-07 | Eliminazione | `models.py:175`; `videogame.ml:148-167` | Cancella il videogame e le sue associazioni in un'unica transazione, e restituisce il record cancellato. Si può cancellare dalla modifica oppure in blocco dall'elenco |
| F-VG-08 | Episodi in cui è citato | `admin.py:90`; `videogame.jsx:64-81`; `associazioni.ml` | Nella modifica del videogame c'è una tabella **in sola lettura**: numero, titolo dell'episodio, data uscita, istante e tipologia (con l'etichetta). È ordinata per data uscita decrescente e, a parità, per istante decrescente (`associazioni.ml:49`); 25 righe per pagina. Un clic sulla riga apre la modifica dell'episodio. Le associazioni si modificano solo dall'episodio (F-EP-09) |

### Associazioni

| ID | Funzione | Origine | Comportamento atteso |
|---|---|---|---|
| F-AS-01 | Elenco filtrato | `associazioni.ml:8-16,34-62` | Associazioni filtrate per videogame o per episodio, con i campi denormalizzati di episodio e videogame. Il default è data uscita crescente e poi istante, come l'ordinamento dell'inline Django (`admin.py:23`). Si può ordinare per data uscita (più istante), istante, speaker, tipologia, titolo del videogame e titolo dell'episodio. È la base di F-VG-08 |
| F-AS-02 | Dettaglio per id | `associazioni.ml:18-27`; `routes.ml:44` | Una singola associazione con i campi denormalizzati; 404 se non esiste. **`/bo` non lo usa**: la risorsa `associazioni` (`App.jsx:53`) non ha schermate, e F-VG-08 passa solo dall'elenco filtrato. L'endpoint esiste solo in `/api/bo`; qui è elencato per la parità (vedi Q-4) |
| F-AS-03 | Valori ammessi ed etichette | `models.py:145-161`; `choices.js:1-14`; `episodi.ml:7-8` | Speaker e tipologia accettano solo i codici della tabella [Associazione](#associazione-episodiovideogame-backoffice_associazioneepisodiovideogame-modelspy167-198). Un valore diverso → 400 «Campo «speaker»: valori ammessi: …». L'interfaccia mostra le etichette, mai i codici |

### Utenti (solo superuser)

| ID | Funzione | Origine | Comportamento atteso |
|---|---|---|---|
| F-UT-01 | Elenco e ordinamento | `django.contrib.auth` (UserAdmin); `utenti.ml:28-53`; `utenti.jsx:19-32` | Colonne: username, nome, cognome, email, staff, attivo, superuser, ultimo accesso (data e ora). Il default è `username` crescente; tutte le colonne sono ordinabili. 10 righe per pagina, con il totale e il selettore «Righe per pagina»; un clic sulla riga apre la modifica |
| F-UT-02 | Ricerca | `django.contrib.auth` (UserAdmin, `search_fields`); `utenti.jsx:19`; `utenti.ml:33-35` | Cerca in username, email, nome e cognome, con le stesse regole di F-EP-03 |
| F-UT-03 | Dettaglio | `django.contrib.auth` (UserAdmin); `utenti.jsx:36-59`; `utenti.ml:9-26,55` | Tutti i campi della tabella [Utente](#utente-auth_user-djangocontribauth), tranne la password |
| F-UT-04 | Creazione | `utenti.ml:57-133`; `utenti.jsx:34-53,61-65` | Validazione come nella tabella [Utente](#utente-auth_user-djangocontribauth); la password è obbligatoria. L'hash usa le iterazioni del più robusto tra gli hash esistenti, con un minimo di 1.500.000 (`auth.ml:48-57`). Nel form staff e attivo sono accesi e superuser è spento. Username già usato → 409 «Esiste già un utente con questo username». Dopo il salvataggio si apre la modifica (come nel vecchio `/bo`) |
| F-UT-05 | Modifica | `utenti.ml:135-164`; `utenti.jsx:36-59` | La password è opzionale: «Lascia vuoto per non cambiarla». I flag assenti dal payload tornano ai default `true`, `true`, `false` (`utenti.ml:89-91`): il form li manda sempre. Se cambia, si chiudono le sessioni di quell'utente (F-AU-05), ma non quella di chi cambia la propria. Un superuser non può togliere a se stesso staff, attivo o superuser: 400 «Non puoi togliere a te stesso i privilegi di staff, attivo o superuser» |
| F-UT-06 | Eliminazione | `django.contrib.auth` (UserAdmin); `utenti.jsx:21`; `utenti.ml:166-193` | Non ci si può cancellare da soli: 400 «Non puoi cancellare te stesso». Prima dell'utente si cancellano le sue righe in `django_admin_log`, `auth_user_groups` e `auth_user_user_permissions` (come il CASCADE di Django). Restituisce il record cancellato. Si può cancellare dalla modifica oppure in blocco dall'elenco: il blocco manda una `DELETE` per riga, e se la selezione include se stessi quella riga fallisce con 400 |

### Vincoli trasversali

| ID | Vincolo | Origine | Comportamento atteso |
|---|---|---|---|
| V-01 | Controllo di Origin e Referer | `auth.ml:165-214` | Se c'è `Origin` (oppure, in sua assenza, `Referer`), il suo host deve coincidere con l'header `Host`, oppure l'origine deve stare in `BO_ALLOWED_ORIGINS`. Sui metodi che modificano dati almeno uno dei due header è obbligatorio. Altrimenti 403 «Origine della richiesta non consentita» o «… non verificabile». Vale anche con `DEBUG=True` |
| V-02 | Cookie `Secure` | `auth.ml:216-238` | Fuori da `DEBUG`, ogni `Set-Cookie` riceve l'attributo `Secure` |
| V-03 | Sessione condivisa | `routes.ml:8-13,30` | Sessione nel cookie cifrato `dream.session` (`DREAM_SECRET`), durata 14 giorni come `SESSION_COOKIE_AGE` di Django. `/bo` (GraphQL) e le route REST della cover (`/api/bo/episodi/:id/cover`) usano **la stessa** sessione: un login o un logout su GraphQL vale anche per la cover |
| V-04 | Limite dei login concorrenti | `password.ml:55-81` | Al massimo 2 hash in calcolo e 8 in coda; oltre, 429 «Troppe richieste di login, riprova tra poco». L'interfaccia mostra il messaggio del server |
| V-05 | Errori | `resp.ml:9-49`; `input.ml:14` | Gli errori di validazione sono 400 e nominano il campo: «Campo «x»: …». Un valore duplicato è 409, un riferimento a un record inesistente è 400. Un errore del DB o un'eccezione non prevista diventano 500 «Errore del database» o «Errore interno», senza dettagli, e finiscono nel log. Un 404 su id inesistente è «Risorsa non trovata». Le creazioni rispondono 201. Anche un'eccezione sfuggita agli handler produce un JSON `{"message": …}` e mai la pagina d'errore HTML di Dream (`routes.ml:50-71`) |
| V-06 | Limiti degli elenchi | `ra_codec.ml:24-51` | Al massimo 1000 righe per pagina. Oltre alle colonne visibili, l'API accetta l'ordinamento per `id` (tutte le risorse) e per `ts` (episodi, videogame), che `/bo` non usa. Un ordinamento su un campo non consentito → 400 «Ordinamento non consentito sul campo «x»» |
| V-07 | Niente tentativi ripetuti sui 4xx | `App.jsx:12-21` | L'interfaccia non ritenta le richieste fallite con 4xx: mostra subito l'errore o il login |
| V-08 | Lingua e titolo | `i18n.js`; `App.jsx:10` | Interfaccia in italiano. Il titolo è «Retrobottega di «È uscito Joypad?»» |

## Endpoint di `/api/bo` → ID

Dalla Fase 1 di via-django la REST `/api/bo` ha solo le due route della cover; tutto il resto è in GraphQL (`docs/schema.graphql`, con gli ID nei commenti di ogni operazione).

| Metodo e route | ID | Note |
|---|---|---|
| `POST /api/bo/episodi/:id/cover` | F-EP-10 | **resta su REST**, niente equivalente GraphQL |
| `DELETE /api/bo/episodi/:id/cover` | F-EP-11 | **resta su REST**, niente equivalente GraphQL |

## Esclusioni

| Cosa | Origine | Motivo |
|---|---|---|
| Messaggi Discord (`DiscordMessage`): elenco, ricerca, filtro «consiglio», gerarchia per data, link a Discord | `admin.py:93-113`; `models.py:201-224` | Li scrive il bot Discord e `/bo` non li gestisce già oggi. Sono un non-obiettivo della spec |
| Gruppi e permessi di `django.contrib.auth` (admin dei `Group`, campi `groups` e `user_permissions`) | `django.contrib.auth` | Né `/bo` né l'API li usano: i permessi dipendono solo da `is_staff` e `is_superuser`. Le righe collegate a un utente si cancellano con lui (F-UT-06) |
| Filtri laterali dell'elenco utenti di Django (`is_staff`, `is_superuser`, `is_active`, gruppi) e pagina separata «Cambia password» | `django.contrib.auth` (UserAdmin) | I filtri non c'erano nel vecchio `/bo` e non ci sono in `/bo`. La pagina «Cambia password» mancava nel vecchio `/bo`: un superuser cambia la password dal form dell'utente (F-UT-05), uno staff non superuser poteva farlo solo da `/legacy-bo`. In `/bo` la sostituisce F-AU-06 |
| Modifica delle associazioni dalla pagina del videogame | `admin.py:90` | In `/bo` sono in sola lettura (F-VG-08): si modificano dall'episodio |
| Registro delle azioni (`django_admin_log`) e cronologia del record | Django admin | `/bo` non scrive il registro |
| Upload della cover via GraphQL | spec, non-obiettivi | La cover resta su REST (F-EP-10, F-EP-11) |
| Esportazione CSV degli elenchi | vecchio `/bo` (pulsante «Esporta» di default) | Default della libreria del vecchio `/bo` che Django non ha e nessuno ha chiesto (Q-2) |

## Differenze tra Django e `/bo`

Il perimetro segue `/bo`.

| Punto | Django | `/bo` |
|---|---|---|
| Ricerca | divide la stringa in parole e le cerca tutte (AND) | cerca la stringa intera come sottostringa |
| Elenco episodi | niente colonna né filtro «pubblicato» | colonna e filtro «pubblicato» (F-EP-01, F-EP-04) |
| Elenco videogame | titolo, slug | miniatura della cover, titolo, slug (F-VG-01) |
| Righe per pagina | 20 per gli episodi, 100 per il resto | 20 per gli episodi, 10 per il resto (default del vecchio `/bo`, modificabile) |
| Creazione di un videogame | `pre_save` chiama RAWG se `rawg_json` è vuoto, cioè sempre in creazione | uguale: chiama sempre RAWG (F-VG-05) |
| Scelta del videogame nell'inline | popup `raw_id_fields` | campo con ricerca testuale (F-VG-03, F-EP-09) |

## Questioni aperte

- **Q-1. Filtro «Pubblicato» (F-EP-04).** La spec dice "filtri e ordinamenti solo dove li ha admin.py", ma AC-1 dice che il perimetro coincide con `/bo`, e `/bo` il filtro ce l'ha. **Deciso da Paolo (2026-11-15):** si tiene, perché prevale la parità con `/bo`.
- **Q-2. Esportazione CSV.** È un default della libreria del vecchio `/bo` che Django non ha, e nessuno l'ha mai chiesta esplicitamente. **Deciso da Paolo (2026-11-15):** esclusa.
- **Q-3. Vincoli `V-` fuori dal lint dello schema.** Il lint di 3.3b verifica che nello schema compaiano solo gli ID `F-`. I vincoli `V-` si verificano con i test API di 3.5 e non hanno un e2e dedicato. **Deciso da Paolo (2026-11-15):** divisione approvata.
- **Q-4. Funzioni dell'API non usate da `/bo`** (F-AS-02, filtro `id` sugli episodi, ordinamenti per `id` e `ts`). **Deciso da Paolo (2026-11-15):** in GraphQL c'è solo F-AS-02, per la parità delle route richiesta da AC-4; gli altri non si replicano.
- **Q-4b. Ordinamento degli utenti per `date_joined`.** L'API lo ammette, ma `/bo` non mostra la colonna. **Deciso da Paolo (2026-11-15):** escluso da GraphQL, come `id` e `ts` in Q-4.
- **Q-5. Associazioni dalla pagina del videogame.** Django le rende modificabili (`admin.py:90`), `/bo` le mostra in sola lettura (F-VG-08). **Deciso da Paolo (2026-11-15):** restano in sola lettura, perché nessuno le modifica da lì.
- **Q-6. Ricerca.** Django divide la stringa in parole e le cerca tutte, `/bo` cerca la stringa intera come sottostringa (F-EP-03, F-VG-03, F-UT-02). **Deciso da Paolo (2026-11-15):** si cerca per sottostringa come in `/bo`, che basta.

## Note per la Fase 3.3 (schema)

- I codici d'errore del piano (`UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `INTERNAL`, `GRAPHQL_VALIDATION`) non coprono tre risposte di `/api/bo`:
  - 429 del login (V-04);
  - 502 e 504 di RAWG (F-VG-05);
  - 409 dei duplicati, che il piano unisce a `BAD_USER_INPUT`.

  Mappati su `INTERNAL`, i primi due perderebbero il loro significato. Da decidere nello schema, per esempio con `RATE_LIMITED` e `UPSTREAM_ERROR`.
- **Divergenze da REST decise con lo spike** (`docs/spike-graphql.md`, punto 6): in GraphQL `associazioni` assente o `null` lascia le associazioni come sono (F-EP-07), e `istante` assente o `null` lascia il campo vuoto (F-EP-09). Il default `0:00:00` lo mette l'interfaccia.
- Il filtro per lista di `id` (`getMany`) è un meccanismo interno del vecchio `/bo`. In GraphQL forse non serve, perché l'episodio porta già `videogame_titolo` per ogni associazione.

## Tabella di copertura

Si riempie nelle Fasi 3.5 (test API) e 3.6c (test e2e). I file sono in `tests/api/`, con il
nome senza `.spec.js`; i nomi lunghi dei test sono abbreviati con «…».

| ID | Test API (GraphQL) | Test e2e (`/bo`) |
|---|---|---|
| F-AU-01 | `graphql-auth` › «login di un utente staff → UtenteCorrente, poi me»; «login rifiutato: … → UNAUTHENTICATED, nessuna sessione» | `new-bo-e2e` › «credenziali sbagliate: messaggio del server nell'Alert…»; «un utente non staff o non attivo non entra…» |
| F-AU-02 | `graphql-auth` › «anonimo: logout riesce sempre»; «logout su GraphQL → anonimo su GraphQL e su REST» | `new-bo-e2e` › «ESCI chiude la sessione, anche per /api/bo» |
| F-AU-03 | `graphql-auth` › «login di un utente staff → UtenteCorrente, poi me»; «login su REST → me su GraphQL» | `new-bo-e2e` › «staff: Sidebar espansa senza UTENTI, nome utente ed ESCI nella barra»; «senza sessione ogni pagina porta al login…» |
| F-AU-04 | `graphql-auth` › «staff: le operazioni sugli utenti → FORBIDDEN, il resto è consentito» | `new-bo-e2e-utenti` › «F-AU-04: uno staff non vede UTENTI e l'indirizzo lo riporta agli episodi»; `new-bo-e2e` › «superuser: Sidebar a rotaia con UTENTI» |
| F-AU-05 | `graphql-auth` › «un utente disattivato perde subito l'accesso anche su GraphQL»; «il cambio password con aggiornaUtente chiude le sessioni di quell'utente»; `graphql-utenti` › «un superuser che cambia la propria password con aggiornaUtente resta loggato» | `new-bo-e2e-utenti` › «F-AU-05: se l'utente viene disattivato…»; «F-AU-05: se un'altra sessione gli cambia la password…»; «F-AU-05, F-UT-05: chi cambia la propria password resta dentro» |
| F-AU-06 | `graphql-cambia-password` › «staff non superuser: cambia la propria password…»; «superuser: cambia la propria password…»; «l'hash nuovo è pbkdf2_sha256 con le iterazioni di F-UT-04…»; «password attuale sbagliata → BAD_USER_INPUT, password invariata, sessione aperta»; «nuova password corta → BAD_USER_INPUT…»; «anonimo → UNAUTHENTICATED, nessuna password cambiata»; «un solo cambio per richiesta…»; «primo alias con la password sbagliata…» | `new-bo-e2e-password` (a 306, 390, 1180 e 1440) › «F-AU-06: percorso completo da utente non superuser»; «F-AU-06: conferma diversa → errore nel campo, nessuna richiesta»; «F-AU-06: password attuale sbagliata → errore nel campo, si resta sulla pagina»; «F-AU-06: accesso dalla barra, prima di ESCI…» (1180, 1440); «F-AU-06: accesso dallo Sheet, voce sopra ESCI» (306, 390); «F-AU-06: nuova corta (7 caratteri) → errore nel campo, nessuna richiesta (1440)»; «F-AU-06: nuova corta («àààà», 4 caratteri e 8 byte) → …»; «F-AU-06: gli altri errori del server vanno nel Toast, non nel campo (1440)»; «F-AU-06: ANNULLA su una pagina aperta direttamente…» |
| F-EP-01 | `graphql-episodi` › «elencoEpisodi: default data_uscita decrescente, totale, offset e limit» | `new-bo-e2e-episodi` › «F-EP-01: righe con numero, titolo, data…; 20 righe di default; clic → modifica»; «F-EP-01: righe per pagina e pagine» |
| F-EP-02 | `graphql-episodi` › «elencoEpisodi: ogni ordinamento in entrambe le direzioni» | `new-bo-e2e-episodi` › «F-EP-02: default data decrescente, clic sulle intestazioni ordina nei due versi» |
| F-EP-03 | `graphql-episodi` › «elencoEpisodi: ricerca in titolo e numero, senza maiuscole, con il filtro pubblicato» | `new-bo-e2e-episodi` › «F-EP-03: la ricerca è «contiene», senza maiuscole…» |
| F-EP-04 | `graphql-episodi` › «elencoEpisodi: ricerca in titolo e numero, senza maiuscole, con il filtro pubblicato» | `new-bo-e2e-episodi` › «F-EP-04: «+ Aggiungi filtro» aggiunge «Pubblicato»…» |
| F-EP-05 | `graphql-episodi` › «episodio: dettaglio con le associazioni ordinate per istante; id inesistente → NOT_FOUND» | `new-bo-e2e-episodi` › «F-EP-05: il form parte dal dettaglio completo, associazioni per istante» |
| F-EP-06 | `graphql-episodi` › «creaEpisodio con associazioni: default di speaker e tipologia…»; «creaEpisodio: durata MM:SS e numero vuoto → null» | `new-bo-e2e-episodi` › «F-EP-06: valori iniziali, CREA con associazione e cover, poi la modifica» |
| F-EP-07 | `graphql-episodi` › «aggiornaEpisodio: sostituzione completa…»; «aggiornaEpisodio: payload non valido → BAD_USER_INPUT senza scritture parziali» | `new-bo-e2e-episodi` › «F-EP-07: salva i campi e torna all'elenco; un errore del server va nel Toast» |
| F-EP-08 | `graphql-episodi` › «eliminaEpisodio: restituisce il record e cancella le associazioni» | `new-bo-e2e-episodi` › «F-EP-08: elimina dalla modifica, con ANNULLA che non cancella»; «F-EP-08: eliminazione in blocco con conferma…» |
| F-EP-09 | `graphql-episodi` › «aggiornaEpisodio: sostituisce le associazioni (aggiorna per id, cancella, inserisce)»; «aggiornaEpisodio: associazioni [] le cancella tutte»; `graphql-cerca-videogame` (3.6c.4b) › «testo vuoto o di soli spazi…»; «meno di 6 caratteri: «contiene» sul titolo…»; «meno di 6 caratteri: più parole unite da %…»; «meno di 6 caratteri: niente errori di battitura…»; «6 caratteri o più: un titolo scritto con un errore di battitura si trova»; «6 caratteri o più: ordine per similarità decrescente, poi per titolo»; «6 caratteri o più: soglia di similarità 0.25, esclusa»; «il testo che sta solo nella descrizione o nello slug non trova nulla»; «limite: 20 se manca…»; «limite 0 / -1 / 51 / 1000 → BAD_USER_INPUT»; «anonimo → UNAUTHENTICATED» | `new-bo-e2e-episodi` › «F-EP-09, F-AS-03: aggiunge, modifica e toglie righe…»; «F-EP-09: nel Combobox INVIO prima dei risultati…»; `new-bo-e2e-dialog-videogame` (3.6c.4b) › «un testo senza trigrammi in comune con i titoli: «Nessun videogame trovato.»…»; «un titolo scritto con un errore di battitura si trova e INVIO lo sceglie»; «il testo che sta solo nella descrizione non trova più il videogame» |
| F-EP-10 | `graphql-episodi` › «cover: caricata via REST, letta da GraphQL (F-EP-10, F-EP-11)» | `new-bo-e2e-episodi` › «F-EP-10: SOSTITUISCI carica il PNG dopo il salvataggio…»; «F-EP-10: se in creazione l'upload fallisce…» |
| F-EP-11 | `graphql-episodi` › «cover: caricata via REST, letta da GraphQL (F-EP-10, F-EP-11)» | `new-bo-e2e-episodi` › «F-EP-11: RIMUOVI toglie la cover al salvataggio» |
| F-VG-01 | `graphql-videogame` › «elencoVideogame: ricerca, totale, righe leggere senza rawg_json» | `new-bo-e2e-videogame` › «F-VG-01: miniatura della cover, titolo e slug; 10 righe di default…»; «F-VG-01: righe per pagina e pagine» |
| F-VG-02 | `graphql-videogame` › «elencoVideogame: default per titolo crescente, ordinamento per slug nelle due direzioni» | `new-bo-e2e-videogame` › «F-VG-02: default titolo crescente; titolo e slug ordinano nei due versi, la cover no» |
| F-VG-03 | `graphql-videogame` › «elencoVideogame: ricerca, totale, righe leggere senza rawg_json» | `new-bo-e2e-videogame` › «F-VG-03: la ricerca è «contiene», senza maiuscole, su titolo, descrizione e slug» |
| F-VG-04 | `graphql-videogame` › «videogame: dettaglio con rawg_json serializzato; id inesistente → NOT_FOUND» | `new-bo-e2e-videogame` › «F-VG-04: il form parte dal dettaglio; rawg_json in sola lettura, al massimo 400 px…» |
| F-VG-05 | `graphql-videogame` › «creaVideogame: titolo, descrizioni, cover e rawg_json arrivano da RAWG»; «creaVideogame: errori di RAWG e di validazione, nessun salvataggio» | `new-bo-e2e-videogame` › «F-VG-05: solo lo slug; CREA DA RAWG…»; «F-VG-05: gli errori di RAWG e lo slug già usato vanno nel Toast…» |
| F-VG-06 | `graphql-videogame` › «aggiornaVideogame: con rawg_json presente non interroga RAWG; opzionali assenti azzerati» | `new-bo-e2e-videogame` › «F-VG-06: con rawg_json presente salva i campi senza interrogare RAWG…»; «F-VG-06: senza rawg_json il salvataggio interroga RAWG…» |
| F-VG-07 | `graphql-videogame` › «eliminaVideogame: restituisce il record e cancella solo le associazioni» | `new-bo-e2e-videogame` › «F-VG-07: elimina dalla modifica, con il numero dei collegamenti…»; «F-VG-07: eliminazione in blocco…» |
| F-VG-08 | `graphql-videogame` › «elencoAssociazioni ed associazione (F-AS-01, F-AS-02, F-VG-08)» | `new-bo-e2e-videogame` › «F-VG-08: episodi citati per data decrescente…»; «F-VG-08: 25 righe per pagina» |
| F-AS-01 | `graphql-videogame` › «elencoAssociazioni ed associazione (F-AS-01, F-AS-02, F-VG-08)» | `new-bo-e2e-videogame` › «F-AS-01: la tabella è l'elenco delle associazioni filtrato per videogame»; `new-bo-e2e-episodi` › «F-AS-01: le associazioni salvate dall'interfaccia…» |
| F-AS-02 | `graphql-videogame` › «elencoAssociazioni ed associazione (F-AS-01, F-AS-02, F-VG-08)» | `new-bo-e2e-episodi` › «F-AS-02: un'associazione salvata dall'interfaccia si legge per id…» |
| F-AS-03 | `graphql-schema` › «le etichette di Speaker e Tipologia sono le descrizioni dei valori (F-AS-03)»; `graphql-episodi` › «valori di speaker e tipologia fuori dagli enum → GRAPHQL_VALIDATION» | `new-bo-e2e-episodi` › «F-EP-09, F-AS-03: aggiunge, modifica e toglie righe; etichette e non codici» |
| F-UT-01 | `graphql-utenti` › «elencoUtenti: ricerca, ordinamento di default per username, nessun campo password»; `graphql-parity` › «F-UT-01 F-UT-02 elenco, ricerca e ordinamento…» (ogni ordinamento) | `new-bo-e2e-utenti` › «F-UT-01: colonne, «—» e «mai», 10 righe di default…»; «F-UT-01: default username crescente, tutte le colonne si ordinano…» |
| F-UT-02 | `graphql-utenti` › «elencoUtenti: ricerca, ordinamento di default per username, nessun campo password» | `new-bo-e2e-utenti` › «F-UT-02: la ricerca è «contiene», senza maiuscole, su username, email, nome e cognome» |
| F-UT-03 | `graphql-utenti` › «utente: dettaglio; id inesistente → NOT_FOUND» | `new-bo-e2e-utenti` › «F-UT-03: il form parte dal dettaglio, senza password…» |
| F-UT-04 | `graphql-utenti` › «creaUtente: hash Django valido, login GraphQL…»; «creaUtente: validazioni → BAD_USER_INPUT» | `new-bo-e2e-utenti` › «F-UT-04: password obbligatoria, permessi iniziali; CREA apre la modifica»; «F-UT-04: uno username già usato va nel Toast» |
| F-UT-05 | `graphql-utenti` › «creaUtente: …; aggiornaUtente senza password la conserva»; «un superuser non può cancellarsi né togliersi i privilegi» | `new-bo-e2e-utenti` › «F-UT-05: salva i campi; senza password la password resta…»; «F-UT-05: un superuser non può togliersi i privilegi…» |
| F-UT-06 | `graphql-utenti` › «eliminaUtente: un utente con righe in django_admin_log si cancella»; «un superuser non può cancellarsi né togliersi i privilegi» | `new-bo-e2e-utenti` › «F-UT-06: elimina dalla modifica…»; «F-UT-06: nel proprio account ELIMINA è disattivato…»; «F-UT-06: la propria riga non ha la casella…»; «F-UT-06: eliminazione in blocco…» |
