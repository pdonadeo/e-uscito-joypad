# Spike GraphQL (Fase 3.3a)

- **Data:** 2026-11-15.
- **Codice:** branch `spike/graphql`, commit `5ea0a28`. È usa e getta e non si mergia.
- **Test:** `tests/api/spike-graphql.spec.js`, 11 test, tutti verdi. Sullo stesso branch passa anche la suite API esistente: 69 test, spike compreso.
- **Cosa conteneva lo spike:**
  - **libreria** `src/graphql/` (`gql`), con dentro:
    - lo schema `me`, `login(credenziali: CredenzialiInput!)`, `logout` ed `eco(righe: [RigaInput!]!)`;
    - un enum `Speaker` usato sia in uscita sia in ingresso;
    - un campo nullable;
    - il wrapper degli errori (opzione E del piano);
  - **route** `Dream.scope "/api/graphql"` con lo stack di `/api/bo` e `Dream.post ""`.

## Esito per punto

| Punto del piano | Esito | Cosa si è visto |
|---|---|---|
| 3.3a.1 Introspection → `buildClientSchema` → `printSchema` | ✅ con una correzione | Funziona anche da anonimo. **Però** i tipi radice di `ocaml-graphql-server` si chiamano di default `query` e `mutation`, in minuscolo: senza `~query_name:"Query" ~mutation_name:"Mutation"` lo schema non coincide con un SDL normale. Per confrontare gli schemi senza descrizioni bisogna toglierle dall'AST (`visit`), non con una regex: le descrizioni dei valori di un enum aggiungono righe vuote |
| 3.3a.1b Enum, liste di input, campi opzionali | ✅ | Lo stesso enum definito con `Schema.enum` e `Schema.Arg.enum` (stesso nome e stessi valori) compare una volta sola nell'introspection, con le descrizioni. Un valore fuori dall'enum → `GRAPHQL_VALIDATION`. In un input **un campo assente e un campo `null` sono indistinguibili**: per la libreria valgono entrambi `None` (vedi le conseguenze) |
| 3.3a.2 Wrapper E: `errors[0].extensions.code` | ✅ | Un resolver risponde `Error "UNAUTHENTICATED: Autenticazione richiesta"` e il wrapper produce `{"message":"Autenticazione richiesta","path":["me"],"extensions":{"code":"UNAUTHENTICATED"}}`. Gli errori della libreria (campo inesistente, sintassi) non hanno prefisso e diventano `GRAPHQL_VALIDATION`. Lo status HTTP resta 200 |
| 3.3a.3 Cookie con `Path=/`; login REST → `me` GraphQL | ✅ | `Set-Cookie: dream.session=…; Max-Age=1209599; Path=/; HttpOnly; SameSite=Lax`. Un login su `/api/bo/login` è visto da `me` su `/api/graphql` |
| 3.3a.4 Adattatore di login | ✅ | `Dream.set_body req <json>` seguito da `Resp.handle Auth.login req` dentro il resolver funziona. La sessione è impostata ed è vista da `/api/bo/me`. Password errata, utente non staff e utente inattivo → `UNAUTHENTICATED` con il messaggio di REST. Un logout GraphQL rende anonimi anche su REST. **Il ripiego (ricomporre il login) non serve** |
| 3.3a.5 `Content-Type` e body non validi | ✅ con due correzioni | `Dream.graphql` risponde 400 **con body vuoto** se il `Content-Type` non è esattamente `application/json`, e anche `application/json; charset=utf-8` viene rifiutato. Il wrapper trasforma quel 400 in `errors[]` con `BAD_USER_INPUT`. Body non JSON → `Yojson.Json_error`; JSON valido ma non un oggetto (per esempio una stringa) → `Yojson.Basic.Util.Type_error`. **Il wrapper deve intercettare tutte e due le eccezioni**, altrimenti la risposta è un 500 |
| 3.3a.6 Pattern `""` e slash finale | ✅ con una correzione | `Dream.post ""` corrisponde esattamente a `/api/graphql`. Un `GET` riceve 404. `POST /api/graphql/` riceve 303 verso `/api/graphql` da `No_trailing_slash`, **a patto che** `is_admin_api` copra anche `/api/graphql/`. Altrimenti, in `DEBUG`, `Json_debug` prova a leggere come JSON il body vuoto del redirect e risponde 500 con la pagina di debug, che riporta gli header della richiesta |
| 3.3a.7 `Auth.login`: `Content-Type` e body | ✅ documentato | `Auth.login` non controlla il `Content-Type`: legge il body con `json_body` (`resp.ml:56-60`). Dopo l'adattatore il body della richiesta contiene le credenziali, non la query GraphQL. Nessun problema, perché `Dream.graphql` l'ha già letto prima di chiamare i resolver |
| V-01 Origin estraneo o assente | ✅ | 403 anche su `/api/graphql`. **Il corpo però è nel formato REST** (`{"message": …}`), non `errors[]`, perché lo produce `Auth.origin_check` prima di GraphQL |
| CORS di debug | ✅ | Con `/api/graphql` in `is_admin_api`, la risposta non ha `Access-Control-Allow-Origin` |

## Scelte conseguenti (valgono per 3.3b e 3.6a)

1. **Tipi radice:** `Schema.schema ~query_name:"Query" ~mutation_name:"Mutation"`.
2. **`is_admin_api`:** deve coprire `/api/graphql` **e** `/api/graphql/`. Resta l'unica modifica a `src/middlewares.ml` consentita dal piano.
3. **Wrapper degli errori:** quattro compiti.
   - Sposta il prefisso `CODE: ` in `extensions.code`; un messaggio senza prefisso diventa `GRAPHQL_VALIDATION`.
   - `Yojson.Json_error` → 400 con `BAD_USER_INPUT`.
   - `Yojson.Basic.Util.Type_error` → 400 con `BAD_USER_INPUT`.
   - Il 400 vuoto di `Dream.graphql` (Content-Type sbagliato) → 400 con `BAD_USER_INPUT`.
4. **Codici d'errore:** si aggiungono due codici a quelli del piano. Elenco completo e mappatura degli status di `src/admin`:

   | Codice | Status di `src/admin` |
   |---|---|
   | `UNAUTHENTICATED` | 401 |
   | `FORBIDDEN` | 403 |
   | `BAD_USER_INPUT` | 400, 409 |
   | `NOT_FOUND` | 404 |
   | **`RATE_LIMITED`** (nuovo) | 429 del calcolo degli hash (V-04): login, e creazione o modifica di un utente con password |
   | **`UPSTREAM_ERROR`** (nuovo) | 502 e 504 di RAWG (F-VG-05) |
   | `INTERNAL` | tutto il resto |
   | `GRAPHQL_VALIDATION` | errori della libreria, senza prefisso |
5. **Login:** si fa con l'adattatore su `Auth.login`. Dopo il login l'utente si rilegge con `Auth.load_session_user`.
6. **Assente e `null` negli input:** non si distinguono. In due punti REST li distingue, e lo schema sceglie così:
   - **`associazioni` in modifica:** in REST "assente" lascia stare, `null` cancella tutto. In GraphQL assente o `null` lascia stare, e per cancellare tutto si manda `[]`. `/bo` manda sempre l'array, quindi per l'interfaccia non cambia niente.
   - **`istante` di un'associazione:** in REST "assente" vale `0:00:00` e `null` lascia il campo vuoto. In GraphQL assente o `null` lascia il campo vuoto. Il default `0:00:00` lo mette l'interfaccia, come fa già il form di `/bo`.
7. **Origine rifiutata:** risponde 403 con un JSON `{"message": …}`, non GraphQL. Il client di `/new-bo` deve gestire anche questa forma. Non si cambia `Auth.origin_check`, perché è codice di `src/admin`.
8. **Dipendenze:** in 3.6a `graphql-lwt` va aggiunto ai `depends` di `dune-project`. Oggi arriva solo come dipendenza di Dream.
9. **Client:** il client GraphQL di `/new-bo` deve mandare `Content-Type: application/json` esatto, senza charset. Da verificare in 3.6c con `graphql-request`.

## Cosa lo spike non ha provato

- **Scalar personalizzati:** non servono. Lo schema usa `String` con il formato documentato, per date, durate, timestamp e `rawg_json`.
- **Interfacce e union:** non servono.
- **Prestazioni degli elenchi** (N+1 sulle associazioni): sono un tema di 3.6a, e i test di parità di 3.5 lo misurano indirettamente.
