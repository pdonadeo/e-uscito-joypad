// @ts-check
// Test d'integrazione HTTP dell'API admin (/api/bo, Fase 2 della rimozione di Django)
// e test e2e del frontend react-admin su /bo (tests/admin.spec.js, Fase 3).
// Avvia un Dream locale (build di dune) e un finto RAWG; usa il PostgreSQL del
// compose di sviluppo e il container Django per creare gli utenti di test.
//
//   (cd frontend && yarn build) && opam exec -- dune build @install && npx playwright test -c playwright.api.config.js
const { defineConfig } = require('@playwright/test');
const { API_URL, API_PORT, RAWG_PORT, RAWG_KEY, BINARY, dreamEnv } = require('./tests/api/env');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: ['api/**/*.spec.js', 'admin.spec.js'],
  timeout: 60000,
  workers: 1,
  fullyParallel: false,
  reporter: 'list',
  globalSetup: './tests/api/global-setup.js',
  globalTeardown: './tests/api/global-teardown.js',
  use: {
    baseURL: API_URL,
    // Origin dello stesso host: richiesto dal controllo Origin/Referer di /api/bo
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
      // /api/bo/me risponde 401 senza sessione: per Playwright vale come "pronto"
      url: `http://127.0.0.1:${API_PORT}/api/bo/me`,
      env: dreamEnv(),
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'ignore',
    },
  ],
});
