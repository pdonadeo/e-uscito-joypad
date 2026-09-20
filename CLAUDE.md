# Progetto — regole per il refactoring

| Componente | Stack | Stato |
| --- | --- | --- |
| `frontend/` | React + Vite (JS → TypeScript) | Da migrare a TS, a parità di comportamento |
| API principale | OCaml + Dream | Resta. Vedi `docs/contracts/ocaml-api.md` |
| Backoffice | Django (solo admin) | Da sostituire con app React + backend Go |
| `discord-bot/` | Go | Fuori scope, non toccare |

## Topologia

Un solo NGINX, una sola origine. Niente CORS in produzione, mai.

**Oggi:**

```
/bo/static  → STATIC Django                     [muore con Django]
/bo/files   → MEDIA, upload utenti              [SONO DATI: sopravvivono]
/bo         → backoffice:8000  (Django)
/           → app:3000  (OCaml/Dream, che serve anche il bundle React)
```

**Obiettivo:**

```nginx
location /bo/files { root /usr/share/nginx/html; }   # invariato

location /bo/api { proxy_pass http://backoffice-go:8000; ... }

location /bo {                                  # build in .../html/bo/
    root /usr/share/nginx/html;
    try_files $uri /bo/index.html;              # fallback SPA: qui, non altrove
}

location / { proxy_pass http://app:3000; ... }  # invariato
```

`/bo/api` e `/bo/files` vincono su `/bo` perché il prefisso è più lungo.

Il fallback SPA deve stare in NGINX perché **Dream risponde 404 a qualunque
path non instradato** — verificato, `ocaml-api.md` §2.

## Le due applicazioni frontend

Separate e indipendenti. **La duplicazione fra le due è accettata:** niente
monorepo, niente package condiviso, salvo richiesta esplicita.

| | `frontend/` | nuovo backoffice |
| --- | --- | --- |
| Natura | Migrazione, comportamento invariato | Greenfield |
| Servita da | Dream, incorporata nel binario via dune | NGINX, statica sotto `/bo` |
| Base path | `/` | `/bo` (va impostato in Vite **e** nel router) |
| Deploy | Richiede rebuild del binario OCaml | Indipendente |

## Regole

1. **L'OCaml non si tocca**: né `.ml`, né `.mli`. Le regole dune che
   incorporano gli asset si toccano solo se il build cambia i nomi degli
   artefatti, e solo con approvazione esplicita.
2. **Nessun cambiamento di comportamento o di aspetto** nella migrazione di
   `frontend/`. Le idee di miglioramento vanno in `NOTES.md`, non nel codice.
3. **Nessun contratto si deduce dal codice a valle.** Stanno in
   `docs/contracts/`. Se manca o è incompleto, ci si ferma.
4. **Non si dichiara fatto senza evidenza fresca**: output di comandi eseguiti
   adesso, non "dovrebbe funzionare". Distinguere sempre ciò che è stato
   osservato da ciò che è stato dedotto leggendo il sorgente.
5. **Un test non si indebolisce mai per farlo passare**, e una baseline visiva
   non si rigenera senza una ragione scritta.
6. **Il comportamento attuale si cattura com'è**, anche dov'è sbagliato:
   marcato `CHARACTERIZATION` nel test e annotato in `NOTES.md`. Correggerlo è
   una decisione separata dal refactoring.

## Comandi

### Avvio

```bash
docker compose up --build -d     # tutto dietro NGINX su http://localhost:5000
docker compose logs -f app
```

`compose_env` è un symlink a `compose_env_devel`. Host: NGINX 5000, PostgreSQL 5432.
**Dopo un rebuild del container `app`: `docker compose restart balancer`** —
NGINX tiene in cache il vecchio IP.

Componente per componente:

```bash
docker compose up -d postgresql
dune build @install && dune exec src/e_uscito_joypad.exe   # env da .envrc
cd frontend && yarn install && yarn dev                    # Vite :3000
cd euscitojoypad_db && .venv/bin/python manage.py runserver 8000
```

### Build

```bash
./build.sh                  # yarn build + dune build @install
cd frontend && yarn build   # solo bundle → frontend/build/
```

Il bundle React è **incorporato nel binario**: la regola in `src/dune` copia
`frontend/build/` in `static_filesystem/` e la impacchetta con `ocaml-crunch`.
Quindi `dune build` presuppone che `yarn build` sia già stato fatto. Le
verifiche visive vanno fatte **contro il binario dietro NGINX**, non contro il
dev server Vite.

### Verifica

```bash
npm run screenshots                       # Playwright, richiede l'app su :5000
cd frontend && yarn lint                  # ESLint 9, flat config
cd discord-bot && go vet ./... && golangci-lint run
cd euscitojoypad_db && .venv/bin/black .  # line-length 120
```

`tests/visual.spec.js` è l'unico test del repo e **non è una baseline**: usa
screenshot non deterministici, non `toHaveScreenshot()`, quindi non fallisce se
l'aspetto cambia. Non offre nessuna protezione alla migrazione.

Non esistono ancora: `npm run typecheck`, `test:e2e`, `test:contract`.

### Migrazioni

```bash
cd euscitojoypad_db && .venv/bin/python manage.py migrate   # 17 migration
tern status / tern migrate / tern override-version 1        # NIENTE CONFIGURATO
```

`tern v2.3.2` e `sqlc v1.30.0` sono installati ma non configurati: nessuna
directory di migration, nessun `sqlc.yaml`. `infra/db/01_init_pg.sh` crea utente
e database, non è una migration.

### Toolchain

dune 3.20.2, opam 2.5.2 (switch locale `_opam/`), node 24, yarn 1.22, go 1.26,
golangci-lint 2.13, uv 0.12, direnv, jq, docker 29.8, psql 18.6, sqlc 1.30,
tern 2.3. Browser Playwright presenti. Assenti: `tsc`, `flake8`, `poetry`.

## Trappole note

### OCaml/Dream

Il dettaglio sta in `docs/contracts/ocaml-api.md`. Le tre cose che riguardano
chiunque lavori qui:

- **Gli errori non restituiscono mai JSON.** `Dream.debug_error_handler` è
  passato a `serve` incondizionatamente, anche con `DEBUG=false`: ogni 4xx/5xx
  esce come pagina HTML di debug che contiene IP del client, header e
  `dream.params`. Il JSON che `rest.ml` costruisce finisce solo nei log. Nessun
  client può fare `response.json()` su un errore. **In produzione è una fuga di
  informazioni** — segnalata, non ancora affrontata.
- **`DEBUG` cambia tre middleware su sei** (CORS, origin check, json debug), e
  vale `true` per qualunque valore diverso dalla stringa `"false"`. Ogni test
  deve dichiarare in quale modalità gira.
- **Le varianti escono come array** (`["Intero", 98]`, non `98`) e le `option`
  emettono la chiave con `null` invece di ometterla. Due cose che un rewrite
  perde senza accorgersene.

### Django, quando verrà sostituito

- **Password.** `auth_user.password` è `<algoritmo>$<iterazioni>$<salt>$<hash>`.
  Per PBKDF2: il salt si usa come byte grezzi della stringa (non è base64),
  la chiave derivata è lunga quanto il digest (32 byte per SHA-256), base64
  standard con padding, confronto a tempo costante. **Le iterazioni si leggono
  riga per riga**, mai fissate nel codice. Se c'è `bcrypt_sha256`, Django
  pre-hasha con SHA-256 e passa il digest esadecimale a bcrypt. Un valore che
  inizia con `!` non deve mai autenticarsi. L'admin richiedeva `is_active` **e**
  `is_staff`.
- **MEDIA.** Il valore in colonna è il path relativo a `MEDIA_ROOT`. Nome
  sanitizzato (spazi → underscore, via tutto ciò che non è `[-\w.]`, ma le
  lettere accentate restano). Sulle collisioni Django non sovrascrive, aggiunge
  un suffisso casuale. **Cancellare un record non cancella il file**: gli
  orfani sono lo stato normale, non fare pulizia.
- **Baseline dello schema.** `pg_dump --schema-only` → prima migration tern →
  `tern override-version 1`, che la registra come applicata **senza eseguirla**.
  `tern migrate` invece proverebbe a creare tabelle già esistenti. Backup prima,
  prova su una copia ripristinata prima. Poi sqlc legge la stessa directory
  (supporta tern, ignora la parte sotto il separatore), `sql_package: pgx/v5`.

## Dati e schema

Schema e dati **restano**. Il Go li adotta come sono: non si progetta uno schema
nuovo. Le tabelle di Django, comprese quelle di `django.contrib.auth`,
sopravvivono e passano al Go. Le colonne scelte da Django diventano vincoli: non
si rinominano e non si ritipizzano perché sembrano sbagliate.

Le nuove password si scrivono nel formato Django, così un rollback resta
possibile finché la migrazione è in corso.

## Ordine del lavoro

1. **Contratti** — `docs/contracts/ocaml-api.md` ✅ (da rivedere), spec
   dell'admin Django ⬜. Sono in sola lettura: vengono prima di tutto, perché
   rendono verificabile ogni cosa a valle.
2. **Rete di sicurezza** — golden file sugli endpoint dell'API, baseline
   Playwright vere. Il contratto elenca in §8 la copertura minima e i dodici
   `CHARACTERIZATION` da pinnare.
3. **Migrazione `frontend/`** a TypeScript, un modulo per volta, verificando
   contro il binario ricostruito.
4. **Baseline dello schema** con tern, a mano.
5. **Login compatibile Django**, prima di qualsiasi altro endpoint del
   backoffice. Finché non è verificato con un account reale, niente scritture
   esposte.
6. **Backend Go + app di backoffice**, contro un contratto d'API scritto e
   rivisto prima dell'implementazione.
7. **Rimozione di Django**, solo dopo che il backoffice nuovo è in uso.
   Backup del database e degli upload prima di staccarlo.

## Decisioni aperte

- [ ] `postgres-data` locale: contiene fixture o dati veri? L'entrypoint di
      Django carica `backoffice/fixtures/euscitojoypad_db.json` con
      `DEBUG=True`, quindi **probabilmente fixture** — ma il volume persiste,
      quindi va verificato prima di lanciare test contro `localhost:5000`.
- [ ] Django e OCaml condividono il database? (il Dream legge tabelle
      `django__*`, quindi la risposta sembra sì: da confermare)
- [ ] Le tabelle di servizio Django (`django_migrations`, `django_session`,
      `django_content_type`, `django_admin_log`) si tengono? Default: sì —
      non costano nulla e lasciano aperto il rollback.
- [ ] Hash non-PBKDF2 in `auth_user`: supportarli o forzare un reset?
- [ ] Grafica del backoffice: propria o simile all'admin?
- [ ] Quali pezzi di TanStack, e quale form library.
