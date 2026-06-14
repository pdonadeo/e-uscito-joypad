// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Nota: WebKit (Safari) non funziona su Fedora perché richiede libjpeg.so.8
// con versioned symbol LIBJPEG_8.0, non disponibile nella libjpeg-turbo di Fedora.
// I profili iPhone/iPad usano Chromium per testare layout e CSS a quelle dimensioni.

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5000',
  },
  projects: [
    // --- Motore Blink (Chromium) — Chrome, Edge, Samsung Browser, Brave ~70% utenti ---
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iPhone 14 layout',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
      },
    },
    {
      name: 'iPad Pro 11 layout',
      use: {
        ...devices['iPad Pro 11'],
        browserName: 'chromium',
      },
    },
    // --- Motore Gecko (Firefox) — ~5% utenti ---
    {
      name: 'Desktop Firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'Firefox Mobile',
      use: {
        browserName: 'firefox',
        viewport: { width: 412, height: 915 },
        userAgent: 'Mozilla/5.0 (Android 13; Mobile; rv:109.0) Gecko/117.0 Firefox/117.0',
        hasTouch: true,
      },
    },
  ],
});
