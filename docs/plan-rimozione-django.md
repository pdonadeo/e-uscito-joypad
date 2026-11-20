# RIMOZIONE DI DJANGO E DEL BACKOFFICE REACT-ADMIN

> Bozza scritta dal controllore il 2026-11-20, con le decisioni di Paolo sugli
> 8 punti discussi e un solo rilascio finale. Da rileggere e approvare prima
> della deep-interview.

## 1. Stato del progetto

Il piano `docs/plan.md` (`/new-bo`) è concluso: il nuovo backoffice (React +
TypeScript + GraphQL + TanStack + shadcn/ui + Bun) è in produzione dal
2026-11-20 con l'immagine `sha-100d7e5` e lo uso per il data entry. Ha
sostituito nei fatti gli altri due backoffice.

Oggi convivono quindi tre backoffice:

- `/legacy-bo`: l'admin di Django, nel container `backoffice`;
- `/bo`: il backoffice react-admin (codice in `frontend/src/bo/`, entry `bo`
  di `frontend/vite.config.js`) sopra l'API REST `/api/bo` (`src/admin/`);
- `/new-bo`: il backoffice nuovo, sopra `/api/graphql` (`src/graphql/`).

Django serve ancora anche a cose che non sono il backoffice:

- crea e aggiorna lo schema del DB con le sue migration (`0001`–`0017`, con le
  estensioni `unaccent`, `pg_trgm`, `btree_gin` e l'indice GIN della `0012`);
- in sviluppo carica la fixture da 8 MB (`backoffice/fixtures/euscitojoypad_db.json`)
  da `docker-entrypoint.sh`;
- nei test Playwright crea gli utenti con
  `docker exec euj-backoffice python manage.py shell` (funzione `django()` in
  `tests/api/env.js`, usata da 12 file);
- ospita `prerendered_index.html` e lo script che lo genera
  (`dump_prerendered_index.py`, con pyppeteer), copiati da `src/dune` e dal
  `Dockerfile`;
- la sua cartella `euscitojoypad_db/MEDIA` contiene le cover degli episodi, montata
  in `app` (`/media`) e in nginx (`/bo/files`, usato anche dal sito pubblico).

## 2. Obiettivo

Restare con un solo backoffice, quello nuovo, e togliere Django del tutto: il
container, l'immagine `-db`, il codice Python e le tabelle che servivano solo a
lui.

## 3. Decisioni

1. **Indirizzo.** Il backoffice nuovo passa da `/new-bo` a `/bo`. Niente
   redirect da `/new-bo`: è durato pochissimo e non lo usa nessuno. `/bo/files`
   continua a servire le cover come oggi, anche al sito pubblico.
2. **REST.** L'API `/api/bo` si toglie tutta tranne
   `/api/bo/episodi/:id/cover`, che il backoffice nuovo usa per la cover.
   `src/admin/` non si cancella: `src/graphql/` usa i suoi moduli (Auth, Utenti,
   Episodi, Videogame, Password, Ra_codec…). Si toglie solo la parte REST e
   quello che resta senza usi. Le spec che usano `/api/bo` come termine di
   confronto (`graphql-parity`) si eliminano; i test GraphQL restano.
3. **Schema del DB.** Al posto delle migration di Django: uno schema di partenza
   in SQL ricavato dal DB attuale (`pg_dump --schema-only`, estensioni comprese),
   più file di migrazione numerati applicati da un comando piccolo, senza
   librerie nuove. Il comando deve riconoscere un DB esistente (quello di
   produzione) come già allineato allo schema di partenza. Il seed di sviluppo
   diventa un dump SQL al posto della fixture JSON.
4. **Test.** Gli utenti di test si creano in SQL, con l'hash
   `pbkdf2_sha256` nel formato di Django calcolato nei test. Nessun test deve
   più dipendere da un container Django.
5. **Messaggi Discord.** La tabella `backoffice_discordmessage` si elimina: in
   produzione è vuota e il bot (Go) non scrive nel DB.
6. **Cover.** La cartella delle cover esce da `euscitojoypad_db/`, per esempio
   in `./media`. Sul server lo spostamento è un passo manuale del deploy, con un
   backup prima.
7. **Tabelle di Django.** Il `DROP` delle tabelle che servivano solo a Django
   (`backoffice_discordmessage`, `django_*`, `auth_group*`, `auth_permission`,
   `auth_user_groups`, `auth_user_user_permissions`) è la prima migrazione
   numerata dopo lo schema di partenza, nello stesso rilascio. `auth_user`
   resta. Oggi la cancellazione di un utente (`src/admin/utenti.ml:167-170`)
   cancella prima le sue righe in `django_admin_log`, `auth_user_groups` e
   `auth_user_user_permissions`: va cambiata insieme al `DROP`.
8. **Pulizie.** `prerendered_index.html` va fuori da `euscitojoypad_db/` e il
   suo script passa da pyppeteer a Playwright, che è già nel repo. Si tolgono
   inoltre:
   - l'immagine `-db` dalla matrix di `.github/workflows/docker-images.yml`;
   - `pip` da `.github/dependabot.yml` e `python` da CodeQL;
   - il servizio `backoffice`, i mount di `STATIC` e la `location /legacy-bo`
     di nginx;
   - le variabili `DJANGO_*` dai `compose_env_*`;
   - i badge di Django nel README.

   Il README va aggiornato con il backoffice nuovo.

## 4. Rilascio

Un solo rilascio alla fine di tutto, con un solo tag (`v45`). È un sito
piccolo, lo uso quasi solo io: qualche minuto di disservizio durante il deploy
è accettabile.

Il lavoro si fa su un branch, a fasi, ognuna con il suo commit; il branch va su
`main` e in produzione solo alla fine. Ordine suggerito per le fasi (lo decide
ralplan):

1. via `/bo` react-admin e la REST tranne la cover; il backoffice nuovo passa a
   `/bo`;
2. schema SQL, comando delle migrazioni, seed di sviluppo, utenti di test in
   SQL;
3. via il container e il codice di Django, cover in `./media`, prerender con
   Playwright, pulizie del punto 8;
4. migrazione col `DROP` delle tabelle di Django e cancellazione degli utenti
   senza di loro;
5. verifica finale e checklist di deploy.

Il deploy è uno solo:

1. backup del DB (`pg_dump`), della cartella delle cover e del compose di
   produzione;
2. spostamento della cartella delle cover, compose e conf di nginx nuovi, nuova
   immagine di `app`;
3. avvio: il comando delle migrazioni riconosce lo schema di partenza e applica
   il `DROP`;
4. prove a mano: sito pubblico con le cover, `/bo` (login, modifica di un
   episodio, cover, cancellazione di un utente di prova).

Rollback: ripristino del backup del DB, compose e conf di nginx di prima,
cartella delle cover al suo posto, tag `sha-100d7e5`.

## 5. Piano di esecuzione

Come per `/new-bo`: deep-interview, ralplan, poi una fase alla volta con il mio
gate e un commit per fase. Il controllore verifica ogni gate sui file e rifà la
suite.

## 6. Vincoli

- Il sito pubblico non cambia, né nell'aspetto né nelle API che usa.
- Il backoffice nuovo non cambia, a parte l'indirizzo.
- Le tabelle dei dati (`backoffice_episodio`, `backoffice_videogame`,
  `backoffice_associazioneepisodiovideogame`, `auth_user`) mantengono nomi e
  colonne. Rinominarle è fuori perimetro.
- Le password restano nel formato `pbkdf2_sha256` di Django: gli utenti
  entrano con le password di oggi.
- Il bot Discord non si modifica.

## 7. Criteri di accettazione

- `/bo` è il backoffice nuovo; `/new-bo` e `/legacy-bo` rispondono come
  indirizzi sconosciuti; l'upload della cover funziona.
- Nessun file Python e nessun container Django nel repo e nel compose.
- Un DB di sviluppo vuoto si crea con lo schema SQL, le migrazioni e il seed.
- Una copia del DB di produzione viene riconosciuta come allineata allo schema
  di partenza, riceve il `DROP` e funziona: va provato prima del deploy, su un
  dump di produzione.
- Nel DB restano solo le tabelle dei dati e `auth_user`; la cancellazione di un
  utente funziona.
- La suite è verde senza `euj-backoffice`.
- Il sito pubblico mostra le stesse cover e lo stesso `prerendered_index.html`.
