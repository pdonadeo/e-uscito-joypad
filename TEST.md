# Come lanciare i test

Ci sono due suite [Playwright](https://playwright.dev/), ognuna con il suo file di configurazione. Si lanciano dalla
radice del repository. I comandi sono scritti per fish.

## Suite API

Prova l'API del backoffice (`/api/bo`), l'API GraphQL (`/api/graphql`) e il frontend react-admin su `/bo`.
Configurazione: `playwright.api.config.js`. Test: `tests/api/*.spec.js` e `tests/admin.spec.js`.

```fish
cd ~/Programmazione/e-uscito-joypad
docker compose up -d postgresql backoffice
begin; cd frontend; and yarn build; end; and opam exec -- dune build @install; and npx playwright test -c playwright.api.config.js
```

- **Cosa fa da sola:** avvia il binario compilato da dune e un finto RAWG (`tests/api/mock-rawg.js`), poi li spegne
  alla fine. Non serve lanciare nessun server a mano.
- **Cosa le serve acceso:** il PostgreSQL del compose di sviluppo e il container Django `euj-backoffice`, che crea gli
  utenti di test.
- **Perché i due build prima:** i test girano sul binario in `_build/`, non sul container `euj-app`. Se il codice OCaml
  cambia e non si ricompila, si prova il binario vecchio.
- **Durata:** circa 3 minuti. I test girano uno alla volta, perché condividono il database.
- **Una sola esecuzione per volta:** due suite in parallelo usano lo stesso database e la stessa porta, e si disturbano.

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
