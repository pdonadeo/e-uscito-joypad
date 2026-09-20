# Contratto dell'API OCaml/Dream

**Stato: BOZZA, DA RIVEDERE.** Nessun lavoro a valle deve basarsi su questo
documento prima che Paolo lo abbia rivisto.

Ricognizione del 2026-09-20 sul branch `refactoring`, commit `88d9471`.
Descrive **ciò che il servizio fa oggi**, non ciò che dovrebbe fare. Dove il
comportamento attuale sembra sbagliato è segnalato con `⚠ CHARACTERIZATION`:
quei punti vanno pinnati da un test *così come sono* e riportati in `NOTES.md`.
Cambiarli è una decisione separata, non parte della migrazione.

## Livelli di evidenza

Ogni affermazione porta un marcatore. Non ce ne sono senza.

| Marcatore | Significato |
| --- | --- |
| `[SRC]` | Letto nel sorgente, con `file:riga`. |
| `[OSS]` | Osservato a runtime sul binario `_build/default/src/e_uscito_joypad.exe`, **senza database** (`PGPORT=1`), porte 3111/3112/3113, il 2026-09-20. |
| `[NV]` | **Non verificato.** Richiede un PostgreSQL con lo schema Django. Nessun test può considerarsi scritto finché non è stato osservato. |

Tutti i `[NV]` di questo documento hanno la stessa causa: senza database ogni
endpoint che lo usa risponde 500, quindi l'osservazione non discrimina fra
"funziona" e "rotto". Sono il primo lavoro della fase 0.

---

## 1. Due cose da sapere prima di leggere il resto

### 1.1 Gli errori NON restituiscono JSON. Mai. `⚠ CHARACTERIZATION`

`~error_handler:Dream.debug_error_handler` è passato a `serve` in modo
**incondizionato** [SRC `src/e_uscito_joypad.ml:61`], senza guardia su
`Settings.debug`. Il middleware `catch` di Dream invoca l'error handler per
ogni risposta 4xx/5xx, anche quando ha già un body
[SRC `_opam/lib/dream/server/catch.ml:50-71`].

Conseguenza: il JSON `{"status":"error","message":[…]}` che `rest.ml` costruisce
con cura [SRC `src/rest/rest.ml:72-73`, `:83-85`, `:264-265`] **finisce solo nei
log**. Sul filo esce una pagina HTML di debug con `Content-Type: text/html;
charset=utf-8`, titolo `500 Internal Server Error` e un "Debug Dump" che
contiene IP del client, header della richiesta e `dream.params`
[OSS, 1589 byte su `GET /api/last-episodes/2/0`].

Vale identicamente con `DEBUG=false` [OSS]. `compose_env_prod:11` imposta
`DEBUG=False` e non cambia nulla: la produzione espone lo stesso dump.

**Per i golden file:** ogni caso d'errore va pinnato come HTML, non come JSON.
La forma JSON documentata più sotto è quella che il *codice costruisce*, non
quella che il client riceve; serve per il giorno in cui l'error handler verrà
sistemato, ed è la ragione per cui la documento lo stesso.

**Per il frontend e per il futuro Go:** nessun client può fare affidamento sul
JSON di errore. Chi oggi fa `response.json()` su un errore riceve HTML.

**Per la produzione:** è una fuga di informazioni. Segnalata, non toccata.

### 1.2 `/api/joycord/games-for-score.tsv` è probabilmente rotto in modo permanente `⚠ CHARACTERIZATION`

Nella query [SRC `src/rest/rest.ml:227-233`] gli alias sono scritti
`AS \"ID\"`, `AS \"TITOLO\"`, `AS \"RAWG_RATING\"` dentro un literal `{| … |}`.
In OCaml le stringhe *quoted* non interpretano gli escape: i backslash sono
caratteri letterali, quindi PostgreSQL riceve davvero `AS \"ID\"` e dovrebbe
rifiutare la query per errore di sintassi.

Secondo problema sulla stessa query: `g.rawg_json->'rating'` restituisce
`jsonb`, ma è decodificato come `string` non opzionale
[SRC `src/rest/rest.ml:226`]. Servirebbe `->>`, e comunque un `rating` NULL o
non testuale farebbe fallire il decode.

Gli alias per altro non servono a niente — Caqti legge per posizione — e
l'intestazione del TSV è scritta a mano [SRC `src/rest/rest.ml:243`].

**Stato: [NV].** La lettura del sorgente è netta, ma l'endpoint non è mai stato
visto rispondere 200. **Il "happy path" di questo endpoint va registrato come
errore**, non come successo, finché una prova contro il database vero non dice
il contrario. È la prima cosa da verificare quando il database è disponibile.

---

## 2. Superficie HTTP

Un solo `Dream.router` [SRC `src/e_uscito_joypad.ml:69`], nessuno `scope`,
**20 route** [SRC `src/e_uscito_joypad.ml:70-95`]. Nessuna route `OPTIONS`,
nessuna `PUT`/`DELETE`/`PATCH`. Una sola `POST`.

| # | Metodo e path | Riga | Tipo |
| --- | --- | --- | --- |
| 1 | `GET /assets/**` | `:71` | asset |
| 2 | `GET /static/joypad-img.jpg` | `:72` | asset |
| 3 | `GET /static/apple-touch-icon.png` | `:73` | asset |
| 4 | `GET /e-uscito-joypad.css` | `:74` | asset |
| 5 | `GET /joypad-img.jpg` | `:75` | asset |
| 6 | `GET /favicon-16x16.png` | `:76` | asset |
| 7 | `GET /favicon-32x32.png` | `:77` | asset |
| 8 | `GET /favicon.ico` | `:78` | asset |
| 9 | `GET /api/ultima-puntata` | `:79-84` | JSON, senza DB |
| 10 | `GET /api/last-episodes/:num/:offset` | `:85` | JSON |
| 11 | `GET /api/search-game/:searchInput` | `:86` | JSON |
| 12 | `GET /api/search-game-title/:searchInput` | `:87` | JSON |
| 13 | `GET /api/episodes-by-game-id/:gameId` | `:88` | JSON |
| 14 | `POST /api/joycord/channels` | `:89` | JSON, stato in RAM |
| 15 | `GET /api/joycord/channels` | `:90` | JSON, stato in RAM |
| 16 | `GET /api/joycord/games-for-score.tsv` | `:91` | TSV |
| 17 | `GET /se-ne-parla-qui/:selectedGameIdUrl/:searchInputUrl` | `:92` | HTML |
| 18 | `GET /joycord/channels` | `:93` | HTML |
| 19 | `GET /sitemap.xml` | `:94` | XML |
| 20 | `GET /` | `:95` | HTML |

**Qualsiasi altro path risponde 404** [OSS, con `DEBUG` sia `true` sia `false`].
Non esiste alcun fallback SPA lato Dream: una route client-side nuova non
funziona senza una riga in più nel router, oppure un fallback a monte in NGINX.

---

## 3. Catena di middleware

Ordine di applicazione, dall'esterno verso l'interno
[SRC `src/e_uscito_joypad.ml:63-68`]:

| # | Middleware | Riga | Attivo | Può interrompere |
| --- | --- | --- | --- | --- |
| 1 | `logger` | `:63` | sempre | no |
| 2 | `Dream.origin_referrer_check` | `:64` | **solo `DEBUG=false`** | **400** |
| 3 | `Middlewares.Cors.middleware` | `:65` | **solo `DEBUG=true`** | no |
| 4 | `Middlewares.Json_debug.middleware` | `:66` | **solo `DEBUG=true`** | **500** |
| 5 | `Middlewares.No_trailing_slash.middleware` | `:67` | sempre | **303** |
| 6 | `Dream.sql_pool` | `:68` | sempre | no |

`Settings.debug` legge la variabile `DEBUG`, **default `true`**, e tratta come
`true` qualunque valore diverso dalla stringa `"false"` — `0`, `no`, `FALSE`
valgono tutti `true` [SRC `src/settings.ml:13-21`]. Le due modalità producono
risposte diverse: è il fattore che più condiziona i golden file, e ogni test
deve dichiarare in quale modalità gira.

### 3.1 CORS — solo in debug

Con `DEBUG=true`, su **ogni** risposta [SRC `src/middlewares.ml:9-17`]:

```
Vary: Origin
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: <valore di Origin, oppure * se assente>
Access-Control-Allow-Headers: accept, accept-encoding, authorization, content-type, dnt, origin, user-agent, x-csrftoken, x-requested-with
Access-Control-Allow-Methods: DELETE, GET, OPTIONS, PATCH, POST, PUT
Access-Control-Max-Age: 86400
```

Rimanda l'`Origin` ricevuto insieme a `Allow-Credentials: true`
[SRC `src/middlewares.ml:4-6`, `:10-11`]: in pratica qualunque origine è
autorizzata con credenziali. Solo in debug, ma va saputo.

`Allow-Methods` annuncia sei metodi che il router non implementa, e **non
esiste una route `OPTIONS`**: un preflight su `POST /api/joycord/channels`
riceve **404** [OSS]. In produzione il problema non si pone — stessa origine,
niente CORS, come dice `CLAUDE.md` — ma il dev server Vite passa da qui.

Con `DEBUG=false` nessun header CORS [OSS]. `⚠ CHARACTERIZATION`

### 3.2 Origin/Referrer check — solo in produzione

Con `DEBUG=false`, `POST /api/joycord/channels` senza `Origin` → **400**; con
`Origin: http://evil.example` → **400**; con `Origin` combaciante → **200**
[OSS]. Il 400 esce come pagina HTML di debug (§1.1).

### 3.3 Json_debug — solo in debug

Si attiva solo su `Content-Type: application/json` esatto
[SRC `src/middlewares.ml:27`]. Fa `Yojson.Basic.from_string` sul body della
richiesta **senza protezione** [SRC `src/middlewares.ml:31`]: body non-JSON con
quel Content-Type → eccezione → **500**. Fa lo stesso sul body della *risposta*
[SRC `src/middlewares.ml:45`]. `⚠ CHARACTERIZATION` — un middleware di logging
che può far fallire una richiesta valida.

### 3.4 Trailing slash

Path che finisce per `/` → **303** verso il path senza
[SRC `src/middlewares.ml:65-66`]. `"/"` è escluso [SRC `src/middlewares.ml:63`].
Osservato: `/joycord/channels/` → 303 `Location: /joycord/channels`;
`/se-ne-parla-qui/1/a/` → 303 `Location: /se-ne-parla-qui/1/a` [OSS].

Usa `Dream.target` [SRC `src/middlewares.ml:61`], che **include la query
string**: `/joycord/channels/?x=1` non termina per `/`, niente redirect, il
router non matcha → **404** [OSS]. `⚠ CHARACTERIZATION`

---

## 4. Endpoint JSON

### 4.1 Involucro comune

Le route 10-13 passano da `Rest.decorator` [SRC `src/rest/rest.ml:54-87`].

Successo — **200**, `Content-Type: application/json`
[SRC `src/rest/rest.ml:59`, `:87`]:

```json
{ "status": "ok", "result": <payload> }
```

Errore — costruito a 500 [SRC `src/rest/rest.ml:72-73` errori Caqti,
`:83-85` eccezioni], **ma sostituito dalla pagina HTML di debug prima di
raggiungere il client** (§1.1):

```json
{ "status": "error", "message": ["riga", "riga", …] }
```

Il ramo eccezioni include `Printexc.to_string` e il **backtrace completo**
[SRC `src/rest/rest.ml:76-82`]. `⚠ CHARACTERIZATION` — nel body destinato al
client finirebbe lo stack trace; oggi non ci arriva solo perché l'error handler
lo sostituisce con un dump che espone altro.

La route 16 (TSV) **non** passa dal decorator [SRC `src/e_uscito_joypad.ml:91`].
Le route 14-15 hanno una forma propria.

### 4.2 `GET /api/ultima-puntata`

Unico endpoint `/api` che non tocca il database [SRC `src/e_uscito_joypad.ml:79-84`].
Non passa dal decorator: serializza direttamente e risponde sempre 200.

Campi [SRC `src/joypad_monitor.ml:15-23`]:

| Campo | Tipo JSON | Origine |
| --- | --- | --- |
| `uscito` | bool | `giorni_passati <= 24` [SRC `src/joypad_monitor.ml:27`, `:89`] |
| `giorni_fa` | string | testo italiano da `Utils.distanza` [SRC `src/joypad_monitor.ml:90`] |
| `data_italiano` | string | es. `"sabato 19 Settembre 2026"` [OSS] |
| `ep_num` | variante | vedi sotto |
| `titolo` | string | dallo scrape |
| `msg_risposta_no` | string \| **null** | [SRC `src/joypad_monitor.ml:92-101`] |

Payload reale osservato [OSS]:

```json
{"uscito":true,"giorni_fa":"ieri","data_italiano":"sabato 19 Settembre 2026",
 "ep_num":["Intero",98],"titolo":"…","msg_risposta_no":null}
```

Due fatti che il rewrite in Go deve replicare e che è facile perdere:

- Le varianti `ppx_deriving_yojson` escono come **array** `["Intero", 98]`, non
  come numero. `Stringa` dà `["Stringa","…"]`. La forma di `NonSpecificato`
  (costruttore senza argomenti) è **[NV]**: va pinnata, e si ottiene
  interrogando l'endpoint **nei primi istanti dopo l'avvio**, prima che il
  monitor completi lo scrape [SRC `src/joypad_monitor.ml:103`].
- Le `option` emettono la chiave con valore `null`, **non la omettono** [OSS].
  Vale per tutti i tipi di questo documento.

I tre messaggi di `msg_risposta_no` sono stringhe utente, da riprodurre alla
lettera [SRC `src/joypad_monitor.ml:95`, `:97`, `:99`]. Il primo dipende dal
mese corrente (agosto o settembre), gli altri dalla soglia di 48 giorni
[SRC `src/joypad_monitor.ml:28`].

**Nota per i golden file:** questo endpoint dipende da `Timedesc.now` e da uno
scrape di `ilpost.it` fatto all'avvio e ogni 10 minuti
[SRC `src/joypad_monitor.ml:31`, `settings.ml:7`, `:6`]. **Non è
deterministico.** Va pinnata la *forma* (chiavi, tipi, formato della data con
una regex), non i valori. È il caso tipico che `safety-net` deve normalizzare
senza nascondere un cambio di formato.

### 4.3 `GET /api/last-episodes/:num/:offset`

[SRC `src/e_uscito_joypad.ml:85`, view `src/rest/rest.ml:159-167`]

`result` è un array di `episode` (§4.7), ordinati per `data_uscita DESC`, solo
episodi con `pubblicato = TRUE` [SRC `src/db/django__episodio.ml:75-78`]. `[NV]`

Parametri, con un'asimmetria che va pinnata:

- `:offset` è protetto da `try … with _ -> 0` [SRC `src/rest/rest.ml:162`]:
  non numerico → **0**, nessun errore.
- `:num` **non** è protetto [SRC `src/rest/rest.ml:163`]: non numerico →
  `Failure "int_of_string"` → ramo eccezioni → 500 → pagina HTML.
  `⚠ CHARACTERIZATION` — due parametri adiacenti, due comportamenti opposti.
  `[NV]`: senza DB non è possibile far scattare l'eccezione, perché
  `Dream.sql` fallisce prima che il corpo della view venga eseguito.

Da pinnare anche: `num` negativo, `num` enorme, `offset` oltre la fine. `[NV]`

### 4.4 `GET /api/search-game/:searchInput`

[SRC `src/e_uscito_joypad.ml:86`, view `src/rest/rest.ml:169-179`]

Array di `episode` (§4.7). Il parametro è usato grezzo, senza validazione
[SRC `src/rest/rest.ml:174`]. Ordinamento
`similarity DESC, pri ASC, data_uscita DESC`, solo `pubblicato = TRUE`
[SRC `src/db/django__episodio.ml:192-194`]. `[NV]`

Da pinnare: stringa vuota, accenti (`à è ì ò ù`), apostrofo, `%` e `_`, molto
lunga, URL-encoded, con slash. `[NV]`

### 4.5 `GET /api/search-game-title/:searchInput`

[SRC `src/e_uscito_joypad.ml:87`, view `src/rest/rest.ml:181-211`]

Unico endpoint con un payload proprio invece di `episode`
[SRC `src/rest/rest.ml:204`]:

```json
{ "status": "ok",
  "result": [ { "id": 123, "titolo": "…", "similarity": 0.53 } ] }
```

`id` è emesso come `` `Intlit `` — numero JSON **non quotato**, non stringa
[SRC `src/rest/rest.ml:204`]. Il Go deve fare lo stesso.

Soglia `word_similarity(unaccent(?), unaccent(titolo)) > 0.25`, ordine
`sim DESC` [SRC `src/rest/rest.ml:193-196`]. L'input è `String.trim`-ato
[SRC `src/rest/rest.ml:184`], a differenza di §4.4.
Richiede le estensioni PostgreSQL `pg_trgm` e `unaccent`. `[NV]`

### 4.6 `GET /api/episodes-by-game-id/:gameId`

[SRC `src/e_uscito_joypad.ml:88`, view `src/rest/rest.ml:213-219`]

Array di `episode` (§4.7), ordine `pri ASC, data_uscita DESC`, solo
`pubblicato = TRUE` [SRC `src/db/django__episodio.ml:373-375`].

`Int64.of_string` non protetto [SRC `src/rest/rest.ml:216`]: `gameId` non
numerico → 500 → pagina HTML. Da pinnare: id inesistente (array vuoto?
`⚠` da verificare), id negativo, id oltre Int64. `[NV]`

### 4.7 Forma di `episode`

[SRC `src/rest/rest.ml:38-51`, popolato in `:128-157`]

| Campo | Tipo JSON | Note |
| --- | --- | --- |
| `titolo` | string | |
| `episodio_numero` | string \| null | **stringa**, non numero [SRC `:40`] |
| `data_uscita` | string | RFC 3339, **solo data** [SRC `:141`] |
| `descrizione_html` | string | NULL → `""` [SRC `:142`] |
| `descrizione_txt` | string | NULL → `""` [SRC `:143`] |
| `durata` | number | **secondi**, float [SRC `:144`] |
| `url` | string \| null | |
| `url_post` | string \| null | |
| `url_video` | string \| null | |
| `cover` | string \| null | `"/" ^ MEDIA_URL ^ valore` [SRC `:133`] |
| `giochi` | array | `gioco_episodio`, vedi sotto |

`gioco_episodio` [SRC `src/rest/rest.ml:4-13`, popolato in `:113-124`]:

| Campo | Tipo JSON | Note |
| --- | --- | --- |
| `titolo` | string | |
| `descrizione_txt` | string | da `game.descrizione_raw` [SRC `:98`] |
| `descrizione_html` | string | |
| `cover` | string \| null | **grezzo, senza prefisso** [SRC `:120`] |
| `istante` | number | secondi, float [SRC `:121`] |
| `speaker` | string | decodificato, vedi sotto |
| `tipologia` | string | decodificato, vedi sotto |

`⚠ CHARACTERIZATION` — **le due `cover` non hanno la stessa forma.** Quella
dell'episodio è prefissata con `/` + `MEDIA_URL` [SRC `:133`], quella del gioco
esce grezza dal database [SRC `:120`]. Due campi con lo stesso nome nello stesso
payload e due convenzioni diverse. Il frontend evidentemente compensa; il Go
dovrà riprodurre l'asimmetria. `[NV]`

`MEDIA_URL` viene dall'ambiente, default `""` [SRC `src/settings.ml:23`]; nel
compose vale `bo/files/`, quindi `cover` diventa `/bo/files/covers/…`. Con la
variabile assente diventerebbe `/covers/…`: da pinnare con la variabile
impostata come in `compose_env_devel:22`.

**`speaker`** [SRC `src/rest/rest.ml:15-20`] — valore DB → stringa utente:
`TUTT` → `Tutti`, `BORD` → `Matteo Bordone (corri!)`,
`FOSS` → `Francesco Fossetti (salta!)`, `ZAMP` → `Alessandro Zampini (spara!)`.

**`tipologia`** [SRC `src/rest/rest.ml:22-27`]: `FREE` → `Chiacchiera libera`,
`RECE` → `Recensione`, `CONS` → `Consiglio`,
`STAR` → `Osservatorio Start Citizen`.

Due cose da pinnare alla lettera:

- `⚠ CHARACTERIZATION` `"Osservatorio Start Citizen"` — il gioco si chiama
  *Star* Citizen, e la migration Django che ha introdotto il valore si chiama
  `0010_osservatorio_star_citizen`. È un refuso visibile all'utente
  [SRC `src/rest/rest.ml:26`]. Va riprodotto identico: correggerlo è una
  decisione separata.
- Un valore sconosciuto in una delle due colonne solleva `Failure`
  [SRC `src/rest/rest.ml:20`, `:27`] → 500 sull'**intero** endpoint. Una sola
  riga con una tipologia nuova inserita da Django fa cadere la lista intera.
  `[NV]`

### 4.8 `POST` e `GET /api/joycord/channels`

[SRC `src/e_uscito_joypad.ml:89-90`, handler `:44-47` e `:49-52`]

Stato **in memoria di processo**, non nel database: un `string option ref`
globale [SRC `src/e_uscito_joypad.ml:42`].

`POST`: salva il body **verbatim, senza validarlo**
[SRC `src/e_uscito_joypad.ml:45-46`] e risponde 200 con i byte esatti
`{ "status": "ok" }` — spazi interni compresi, diversi dall'involucro compatto
del decorator [SRC `src/e_uscito_joypad.ml:47`].

`GET`: `[]` se non è mai stato fatto un POST
[SRC `src/e_uscito_joypad.ml:51`], altrimenti i byte salvati, sempre con
`Content-Type: application/json` [SRC `src/e_uscito_joypad.ml:52`].

`⚠ CHARACTERIZATION`, verificato [OSS]: dopo un `POST` con
`Content-Type: text/plain` e body `ciao`, il `GET` restituisce `ciao` con
`Content-Type: application/json`. Nessuna autenticazione: chiunque raggiunga
l'endpoint può sostituire l'albero dei canali. Lo stato sopravvive fra le
richieste e si azzera al riavvio [OSS].

Nota per il futuro: essendo stato di processo, non sopravvive a un riavvio e
non sarebbe condiviso fra più istanze.

### 4.9 `GET /api/joycord/games-for-score.tsv`

[SRC `src/e_uscito_joypad.ml:91`, view `src/rest/rest.ml:221-266`]

Vedi §1.2: **probabilmente non risponde mai 200**. `[NV]`

Forma prevista dal codice, se la query venisse corretta:
`Dream.stream` con `Content-Type: text/tab-separated-values; charset=UTF-8`
[SRC `src/rest/rest.ml:239-241`], intestazione `ID\tTITOLO\tRAWG_RATING\n`
[SRC `:243`], una riga per gioco ordinata per `id DESC` [SRC `:232`], e il punto
decimale del rating sostituito da **virgola** [SRC `:247`].

In errore: JSON 500 [SRC `:264-265`] → sostituito dalla pagina HTML (§1.1).

---

## 5. Route HTML e XML

### 5.1 `/`, `/joycord/channels`, `/se-ne-parla-qui/:a/:b`

Le tre route rendono la **stessa identica pagina**
[SRC `src/e_uscito_joypad.ml:92`, `:93`, `:95`, handler `:37-39`].

`Views.index` [SRC `src/views.ml:46-73`] fonde `index.html` e
`prerendered_index.html` presi dal filesystem incorporato nel binario
[SRC `src/views.ml:52-53`]: sostituisce `main#root`, cancella
`div#episode-section`, riscrive `p#for-prerender`. Il risultato è messo in
cache in un `ref` globale [SRC `src/views.ml:44`, `:56`]: **la prima richiesta
dopo l'avvio costruisce la pagina, le successive riusano la stessa stringa.**

Unica differenza fra le tre: `/se-ne-parla-qui` aggiunge
`X-Robots-Tag: noindex, follow` [SRC `src/e_uscito_joypad.ml:32-35`, `:41`],
verificato presente lì e assente sulle altre due [OSS].

I due parametri di `/se-ne-parla-qui/:selectedGameIdUrl/:searchInputUrl`
**non vengono mai letti** dall'handler [SRC `src/e_uscito_joypad.ml:41`]:
esistono solo perché il path matchi. Qualunque valore dà la stessa pagina.

### 5.2 `GET /sitemap.xml`

[SRC `src/e_uscito_joypad.ml:94`, `src/sitemap.ml:1-18`]

Documento **statico**, scritto in un literal: contiene solo
`https://www.euscitojoypad.it/` con `changefreq: daily`
[SRC `src/sitemap.ml:9-16`]. Non elenca gli episodi e non tocca il database.
`Content-Type: application/xml; charset=UTF-8` [SRC `src/sitemap.ml:4`].
L'URL è **hardcodato sul dominio di produzione**: in locale la sitemap punta
comunque a `www.euscitojoypad.it`. `⚠ CHARACTERIZATION`

---

## 6. Asset statici

Le 8 route servono file **incorporati nell'eseguibile**, non dal disco: la
regola in `src/dune:41-74` copia `frontend/build/` in `static_filesystem/` e la
impacchetta con `ocaml-crunch`.

- Il loader risponde `Dream.respond asset` **senza header**
  [SRC `src/e_uscito_joypad.ml:30`]; il `Content-Type` lo mette Dream con
  `Magic_mime.lookup` [SRC `_opam/lib/dream/unix/static.ml:89-96`]. Osservati:
  `.js → application/javascript`, `.css → text/css`, `.ico → image/x-icon`,
  `.jpg → image/jpeg` [OSS].
- **Nessun header di caching**: niente `Cache-Control`, niente `ETag`, niente
  `Last-Modified` su nessuno degli 8 path [OSS]. `⚠ CHARACTERIZATION` — da
  pinnare, perché un build system nuovo potrebbe aggiungerli e sembrerebbe un
  miglioramento gratuito. Non lo è: è un cambio di comportamento.
- Metodo diverso da GET → 404 [SRC `_opam/lib/dream/unix/static.ml:77-79`].
- Path con `.`, `..`, `//` o backslash → rifiutato
  [SRC `_opam/lib/dream/unix/static.ml:47-72`].
- Asset inesistente sotto `/assets/**` → 404
  [SRC `src/e_uscito_joypad.ml:29`] → pagina HTML di debug (§1.1).
- `site.webmanifest` è referenziato dall'`index.html` incorporato ma **non è
  servito da nessuna route** e non è nel filesystem incorporato → 404.
  `⚠ CHARACTERIZATION`, preesistente [SRC `_build/default/src/static_filesystem.ml:479`].

---

## 7. Dipendenze d'ambiente

[SRC `src/settings.ml:9-32`]

| Variabile | Default | Effetto |
| --- | --- | --- |
| `REST_LISTEN_ADDRESS` | `0.0.0.0` | `:9` |
| `REST_LISTEN_PORT` | `3000` | `:10` |
| `DEBUG` | **`true`** | cambia 3 middleware su 6 — `:13-21` |
| `MEDIA_URL` | `""` | prefisso di `episode.cover` — `:23` |
| `GC_PERIOD_SEC` | 86400 | `:24` |
| `PGHOST` `PGPORT` `PGUSER` `PGPASSWORD` `PGDATABASE` | vedi `:27-31` | stringa di connessione `:32` |

Dipendenza esterna: all'avvio e ogni 10 minuti il processo scarica
`https://www.ilpost.it/podcasts/joypad/` [SRC `src/settings.ml:7`,
`src/joypad_monitor.ml:31`, `:105`]. Se il sito è irraggiungibile o cambia
markup, `/api/ultima-puntata` resta sui valori di fallback
[SRC `src/joypad_monitor.ml:103`] e l'eccezione finisce solo nei log
[SRC `src/joypad_monitor.ml:117-120`]. I test non devono dipendere dalla rete.

---

## 8. Cosa deve fare la fase 0 con questo documento

Copertura minima per considerare pinnato il contratto:

1. **Tutti i `[NV]` osservati contro un database reale.** Sono 5 endpoint su 8:
   §4.3, §4.4, §4.5, §4.6, §4.9. Finché restano `[NV]`, la rete di sicurezza
   non copre il cuore dell'API.
2. Per ciascuno: happy path + almeno un input non valido, secondo la condizione
   di fase 0. Gli input non validi da coprire sono elencati endpoint per
   endpoint qui sopra.
3. Ogni `⚠ CHARACTERIZATION` di questo documento ha un test che lo pinna e una
   riga in `NOTES.md`. Sono 12: §1.1, §1.2, §3.1 (CORS assente in prod),
   §3.3, §3.4, §4.3 (asimmetria num/offset), §4.7 (doppia convenzione `cover`),
   §4.7 (`Start Citizen`), §4.7 (Failure su valore sconosciuto), §4.8,
   §5.2 (dominio hardcodato), §6 (niente caching), §6 (`site.webmanifest`).
4. I test dichiarano la modalità `DEBUG` in cui girano, e le route dove le due
   modalità divergono sono coperte in entrambe.

**Prerequisito bloccante:** i test richiedono un PostgreSQL con lo schema
Django e dei dati. `GOALS.md` vieta l'auto mode su qualunque cosa tocchi il
database reale. Prima di scrivere un solo assert va stabilito se il volume
`postgres-data` locale contiene le fixture o i dati di produzione.

---

## 9. Cosa questo documento NON copre

- Le risposte **200** dei 5 endpoint che leggono il database: forma reale,
  formati di data e durata, encoding delle `option`, ordinamento a parità di
  chiave. Tutto `[NV]`.
- Il comportamento di `:searchInput` con caratteri URL-encoded o slash.
- La forma JSON di `ep_num = NonSpecificato`.
- Codici di stato per collezioni vuote (array vuoto con 200, o altro).
- Tutto ciò che sta dietro `/bo` — è Django, ha un documento suo.
