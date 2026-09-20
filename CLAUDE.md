# Progetto — regole per il refactoring

Applicazione web con quattro componenti:

| Componente | Stack | Stato nel refactoring |
| --- | --- | --- |
| Frontend | React (JS → TypeScript) | Da migrare: TS + stack moderno |
| API principale | OCaml + Dream | **Non si tocca.** Solo lettura |
| Data entry | Django (solo admin) | Da eliminare |
| Bot | Go | Fuori scope, ma è il riferimento per le convenzioni Go |

## Topologia

Un solo NGINX, una sola origine. Niente CORS, mai.

**Oggi:**

```
/bo/static  → file statici Django (STATIC)      [muoiono con Django]
/bo/files   → upload degli utenti (MEDIA)       [SONO DATI: sopravvivono]
/bo         → backoffice:8000  (Django)
/           → app:3000         (OCaml/Dream)    [serve anche il bundle React]
```

**Obiettivo:**

```
/bo/files   → invariato
/bo/api     → backoffice-go:8000   (nuovo servizio Go: SOLO API)
/bo         → bundle statico della nuova app, con fallback SPA in NGINX
/           → app:3000  (OCaml/Dream, invariato nella sostanza)
```

```nginx
location /bo/files { root /usr/share/nginx/html; }   # invariato

location /bo/api {
    proxy_pass http://backoffice-go:8000;
    proxy_redirect off;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /bo {                                  # build in .../html/bo/
    root /usr/share/nginx/html;
    try_files $uri /bo/index.html;              # fallback SPA: qui, non altrove
}

location / { proxy_pass http://app:3000; ... }  # invariato
```

`/bo/api` e `/bo/files` vincono su `/bo` perché il prefisso è più lungo.

## Le due applicazioni frontend

Sono **separate e indipendenti**. La duplicazione fra le due è accettata: non
si costruisce un monorepo né un package condiviso senza che sia richiesto.

| | `frontend/` | nuova app di backoffice |
| --- | --- | --- |
| Cosa fa | Le due pagine esistenti | Quello che fa oggi l'admin Django |
| Migrazione o nuovo | Migrazione, a parità di comportamento | Greenfield |
| Servita da | Dream, incorporata nel binario via dune | NGINX, file statici sotto `/bo` |
| Base path | `/` | `/bo` |
| Deploy | Richiede rebuild dell'eseguibile OCaml | Indipendente |
| Agent | `frontend-migrator` | `data-entry-ui` |

Dato che `frontend/` finisce dentro l'eseguibile Dream, le sue verifiche vanno
fatte contro il binario ricostruito dietro NGINX, non contro il dev server: il
modo in cui Dream serve gli asset è parte del comportamento.

## Regole non negoziabili

1. **L'OCaml si tocca il meno possibile**, su due livelli distinti:
   - **Logica e handler** (`.ml`, `.mli`): non si toccano. Questo è il vincolo
     vero, e vale per tutti gli agent.
   - **Regole dune che incorporano gli asset**: cambieranno, perché il passaggio
     a TypeScript e a un altro build system cambia i nomi degli artefatti
     prodotti. È previsto e in scope, ma solo per `frontend-migrator` e solo con
     approvazione esplicita della modifica proposta.

   La nuova app di backoffice non tocca l'OCaml in nessun caso: non passa da
   Dream.
2. **Nessun cambiamento di comportamento o di aspetto** durante la migrazione
   del frontend. Miglioramenti e refactoring sono due cose diverse: le idee
   vanno in `NOTES.md`, non nel codice.
3. **Nessun contratto si deduce dal codice a valle.** Le regole stanno in
   `docs/contracts/`. Se un contratto manca o è incompleto, ci si ferma.
4. **Non si dichiara fatto senza evidenza fresca.** Output di test eseguiti
   adesso, non "dovrebbe funzionare".
5. **Un test non si indebolisce mai per farlo passare.** Se un test fallisce,
   o il codice è sbagliato o il test documentava un comportamento che stiamo
   cambiando di proposito — e in quel caso va detto esplicitamente.

## Comandi

<!-- Da compilare dopo il lavoro di safety-net -->

```
# Avvio locale
make dev                      # TODO

# Verifica
npm run typecheck             # tsc --noEmit
npm run test:e2e              # Playwright, E2E + baseline visive
npm run test:contract         # golden file API OCaml
go vet ./... && golangci-lint run
```

## Ordine delle fasi

Ogni fase si chiude con `refactor-reviewer` prima di aprire la successiva.

0. `safety-net` — rete di sicurezza. **Prima di toccare qualsiasi cosa.**
1. `ocaml-reader` + `django-archaeologist` — contratti (in parallelo).
2. `frontend-migrator` — JS → TS, modulo per modulo.
3. Baseline dello schema: dump, prima migration tern, `tern override-version 1`
   su una copia ripristinata, poi sul database vero. Backup prima.
4. `django-auth-compat` — login e password. **Prima di qualsiasi altro
   endpoint.** Finché non è verificato, niente scritture esposte.
5. `go-api-builder` — scrive `docs/contracts/data-entry-api.md`, lo fai
   rivedere, poi implementa.
6. `go-api-builder` + `data-entry-ui` — in parallelo contro quel contratto.
7. Rimozione di Django, solo dopo che il nuovo backoffice è in uso e verificato.
   Prima di staccarlo: backup del database e degli upload.

`frontend-migrator` e `data-entry-ui` lavorano su due applicazioni diverse e
non si incontrano mai. Il primo migra l'esistente a parità di comportamento; il
secondo costruisce un'app nuova. Vincoli opposti, codebase separati.

## Dati, schema, autenticazione

Schema e dati **restano**. Il backend Go li adotta così come sono: non si
progetta uno schema nuovo e non si migra dentro. Le tabelle di Django, comprese
quelle di `django.contrib.auth`, sopravvivono e passano al Go.

- **sqlc + tern.** Baseline: `pg_dump --schema-only` → prima migration tern →
  `tern override-version 1` per registrarla come applicata **senza eseguirla**.
  Quel comando è il più pericoloso del progetto: backup prima, prova su una
  copia ripristinata prima. Poi sqlc legge la stessa directory di migration
  (supporta tern e ignora la parte sotto il separatore), `sql_package: pgx/v5`.
- **Login compatibile con Django.** Il Go verifica gli hash esistenti in
  `auth_user` — formato `<algoritmo>$<iterazioni>$<salt>$<hash>` — e scrive le
  nuove password nello stesso formato, così un rollback a Django resta
  possibile. È il pezzo più rischioso del lavoro e ha un agent dedicato,
  `django-auth-compat`, che viene prima di ogni altro endpoint.
- **MEDIA compatibili.** Gli upload restano dove sono, con gli stessi URL, e i
  nuovi devono essere indistinguibili dai vecchi: stesso `upload_to`, stessa
  sanitizzazione del nome, stesso comportamento sulle collisioni. E come
  Django, cancellare un record **non** cancella il file.

Le colonne scelte da Django diventano vincoli: non si rinominano e non si
ritipizzano perché sembrano sbagliate.

## Decisioni ancora aperte

- [ ] Django e OCaml condividono il database? (cambia quanto è vincolante lo
      schema adottato dal Go)
- [ ] Le tabelle di servizio di Django (`django_migrations`, `django_session`,
      `django_content_type`, `django_admin_log`) si tengono o si eliminano?
      Default: si tengono — non costano nulla e lasciano aperto il rollback.
- [ ] Gli hash non-PBKDF2 eventualmente presenti in `auth_user` si supportano
      o si forza un reset per quegli account?
- [ ] Le pagine di backoffice seguono la grafica dell'app o quella dell'admin?
      (default: una grafica propria)
- [ ] Quali pezzi di TanStack (Query? Router? entrambi?) e quale form library
- [ ] Il build del frontend si sposta a Vite?
