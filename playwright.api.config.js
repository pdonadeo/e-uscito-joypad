// @ts-check
// Test d'integrazione del backoffice: GraphQL (/api/graphql), cover (/api/bo/episodi/:id/cover)
// ed e2e di new-bo su /bo (tests/api/*.spec.js).
// Avvia un Dream locale (build di dune) e un finto RAWG; usa il PostgreSQL del
// compose di sviluppo, dove crea gli utenti di test in SQL (tests/api/global-setup.js).
//
//   yarn --cwd frontend build && bun run --cwd new-bo build && opam exec -- dune build @install && npx playwright test -c playwright.api.config.js
const { defineConfig } = require('@playwright/test');
const { API_URL, API_PORT, RAWG_PORT, RAWG_KEY, BINARY, dreamEnv } = require('./tests/api/env');

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
