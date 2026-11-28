// @ts-check
// Test d'integrazione del backoffice: GraphQL (/api/graphql), cover (/api/bo/episodi/:id/cover)
// rotte e meta del sito, ed e2e del backoffice su /bo (tests/api/*.spec.js).
// Avvia un Dream locale (build di dune), un finto RAWG e una finta pagina del Post; usa il PostgreSQL del
// compose di sviluppo, dove crea gli utenti di test in SQL (tests/api/global-setup.js).
//
//   bun run --cwd frontend build && opam exec -- dune build @install src/migrazioni/test/prova_sintassi.exe @src/meta/test/runtest && npx playwright test -c playwright.api.config.js
const { defineConfig } = require('@playwright/test');
const { API_URL, API_PORT, RAWG_PORT, ILPOST_PORT, RAWG_KEY, BINARY, dreamEnv } = require('./tests/api/env');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['api/**/*.spec.js'],
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  globalSetup: './tests/api/global-setup.js',
  globalTeardown: './tests/api/global-teardown.js',
  use: {
    baseURL: API_URL,
    // Origin dello stesso host: richiesto dal controllo Origin/Referer di /api/graphql e /api/bo
    extraHTTPHeaders: { Origin: API_URL },
  },
  webServer: [
    {
      command: 'node tests/api/mock-rawg.js',
      url: `http://127.0.0.1:${RAWG_PORT}/health`,
      env: { PORT: String(RAWG_PORT), RAWG_TEST_KEY: RAWG_KEY },
      reuseExistingServer: false,
    },
    // prima del binario: il monitor scarica la pagina appena parte
    {
      command: 'node tests/api/mock-ilpost.js',
      url: `http://127.0.0.1:${ILPOST_PORT}/health`,
      env: { PORT: String(ILPOST_PORT) },
      reuseExistingServer: false,
    },
    {
      command: BINARY,
      // rotta pubblica che tocca il DB: 200 solo con il DB raggiungibile
      url: `http://127.0.0.1:${API_PORT}/api/last-episodes/1/0`,
      env: dreamEnv(),
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  ],
});
