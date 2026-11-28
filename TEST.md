# Come lanciare i test

Ci sono due suite [Playwright](https://playwright.dev/), ognuna con il suo file di configurazione, più i test unitari
di new-bo con `bun test` e quelli OCaml con dune. Si lanciano dalla radice del repository. I comandi sono scritti per
fish.

## Suite API

Prova l'API GraphQL del backoffice (`/api/graphql`), la cover (`/api/bo/episodi/:id/cover`) e il backoffice new-bo
su `/bo`. Configurazione: `playwright.api.config.js`. Test: `tests/api/*.spec.js`.

```fish
cd ~/Programmazione/e-uscito-joypad
docker compose up -d postgresql
bun run --cwd frontend build; and opam exec -- dune build @install src/migrazioni/test/prova_sintassi.exe @src/meta/test/runtest; and npx playwright test -c playwright.api.config.js
```

- **Cosa fa da sola:** avvia il binario compilato da dune e un finto RAWG (`tests/api/mock-rawg.js`), poi li spegne
  alla fine. Non serve lanciare nessun server a mano.
- **Cosa le serve acceso:** il PostgreSQL del compose di sviluppo (`euj-postgresql`). Gli utenti di test li crea la
  suite stessa, in SQL con `psql` dentro quel container.
- **Perché i build prima:** i test girano sul binario in `_build/`, non sul container `euj-app`. Se il codice OCaml
  cambia e non si ricompila, si prova il binario vecchio.
- **Migrazioni:** `tests/api/migrazioni.spec.js` prova il runner delle migrazioni su un PostgreSQL usa e getta
  (`euj-prova-migrazioni`, porta 55433) che avvia e toglie da solo. Usa `prova_sintassi.exe`, che `@install` non
  compila: per questo il comando lo nomina. I casi «initdb» avviano un secondo PostgreSQL usa e getta
  (`euj-prova-initdb`, porta 55435) con `infra/db/` montato come nel compose di sviluppo, e provano schema e seed
  con `DEBUG=True` e con `DEBUG=False`.
- **Durata:** circa 10 minuti. I test girano uno alla volta, perché condividono il database.
- **Una sola esecuzione per volta:** due suite in parallelo usano lo stesso database e la stessa porta, e si disturbano.

## Test unitari di new-bo (`bun test`)

Provano le funzioni pure dell'import Excel, in `new-bo/src/lib/excel/`: lo scrittore del template
(`template.test.ts`), la lettura e il controllo del file (`importa.test.ts`) e la ricerca dei videogame con un DB e
un RAWG finti (`risolvi.test.ts`). Non servono né il browser né il server né il database.

```fish
cd ~/Programmazione/e-uscito-joypad
bun run --cwd new-bo codegen; and bun run --cwd new-bo test
```

- **Perché lo script e non `bun test`:** `--cwd` è un'opzione di `bun`, non di `bun test`. Lo script `test` di
  `new-bo/package.json` imposta anche `TZ=Europe/Rome`: gli orari convertiti da Excel arrivano come date del 1899, e
  il fuso di Roma di allora non deve spostarli. Ogni file di test controlla il fuso e fallisce se manca.
- **Perché il codegen prima:** i moduli importano i tipi generati da GraphQL (`src/gql/`).
- **Typecheck:** i test hanno un `tsconfig.test.json` loro, con i tipi di Bun; `bun run --cwd new-bo typecheck`
  controlla anche quelli.
- **Durata:** meno di un secondo.

## Fixture manuali dell'import Excel

`tests/api/fixture/import-excel/` contiene i file `.xlsx` dei test dell'import. Quasi tutti si rigenerano da soli:

- `~/.bun/bin/bun run new-bo/scripts/genera-fixture-excel.ts` rigenera quelli prodotti dal template;
- `scripts/prova-template-libreoffice.sh` rifà `libreoffice.xlsx`, cioè `valido-slug.xlsx` risalvato da
  LibreOffice.

`excel.xlsx` e `sheets.xlsx` invece sono compilati a mano, in Excel e in Google Sheets, per provare l'andata e
ritorno nei programmi veri. **Valgono solo per il DB di sviluppo**: citano il videogame 542 «Death Stranding 2».
Se quel gioco cambia, l'e2e lo dice e i due file vanno rifatti così:

1. avviare il binario compilato su una porta libera e scaricare il template dalla sua pagina `/bo/template`
   (oppure dal sito, se il gioco 542 è lo stesso);
2. compilare il foglio `minutaggi`, scegliendo dai menu tutto quello che ha un menu:

   | Riga | VIDEOGAME | RAWG SLUG | ISTANTE | TIPOLOGIA | SPEAKER |
   |---|---|---|---|---|---|
   | 2 | `542-Death Stranding 2` | | `12:30` | Recensione | Matteo Bordone (corri!) |
   | 3 | | `e2e-excel-manuale` (lo stesso in tutti e due i file) | `1:02:03` | Consiglio | Tutti |

3. salvare in formato `.xlsx` (in Sheets: «File → Scarica → Microsoft Excel (.xlsx)») come `excel.xlsx` o
   `sheets.xlsx` in `tests/api/fixture/import-excel/`.

## Test unitari (OCaml)

`opam exec -- dune test` lancia i test unitari del runner delle migrazioni (`src/migrazioni/test/`): nomi e
contenuto dei file in `infra/db/migrazioni/` e funzioni pure. Non servono né Docker né il database.

## Suite visual

Fa gli screenshot del sito pubblico. Configurazione: `playwright.config.js`. Test: `tests/visual.spec.js`.

```fish
cd ~/Programmazione/e-uscito-joypad
docker compose up -d
npm run screenshots
```

- **Con chi parla:** con `localhost:5000`, cioè con il container `euj-app`. Serve tutto il compose acceso.
- **Dopo una modifica al codice:** l'immagine va ricostruita (`docker compose build app && docker compose up -d app`),
  altrimenti si prova la versione vecchia.
- **Profili:** sei, tutti su Chromium o Firefox: Desktop Chrome, Pixel 7, iPhone 14, iPad Pro 11, Desktop Firefox,
  Firefox Mobile. WebKit non funziona su Fedora, quindi i profili Apple usano Chromium con le loro dimensioni.

## Opzioni utili

Si aggiungono in coda a `npx playwright test -c playwright.api.config.js`.

| Cosa serve                         | Opzione                                             |
| ---------------------------------- | --------------------------------------------------- |
| Un solo file                       | `tests/api/graphql-episodi.spec.js`                 |
| I test con un certo titolo         | `-g "ordinamento"`                                  |
| Fermarsi al primo test rosso       | `-x`                                                |
| Solo i test falliti l'ultima volta | `--last-failed`                                     |
| Rapporto navigabile nel browser    | `--reporter=html`, poi `npx playwright show-report` |
| Solo l'elenco, senza eseguire      | `--list`                                            |

## Leggere l'output

Ogni riga è un test: `✓` è verde, `✘` è rosso. In fondo c'è il riepilogo con i totali. Per ogni test rosso Playwright
mostra l'asserzione fallita, il valore atteso, quello ricevuto e la riga del file.
