// Pagina pubblica /bo/template (Fase 2 dell'import Excel, criterio T1): si apre senza login,
// non chiama /api/graphql e al clic scarica il template generato nel browser con l'elenco
// aggiornato dei videogame.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { unzipSync, strFromU8 } = require('fflate');
const { sql } = require('./env');
const { uniq } = require('./helpers');

// Il browser deve mandare la sua Origin vera, non quella forzata dalla config per l'API.
test.use({ extraHTTPHeaders: {}, viewport: { width: 1440, height: 900 } });

const u = uniq();
const titolo = `E2E Template pagina ${u} & «virgolette»`;
let id;

test.beforeAll(() => {
  id = Number(
    sql(
      `INSERT INTO backoffice_videogame (ts_created, ts, titolo, rawg_slug)
VALUES (now(), now(), :'titolo', :'slug') RETURNING id`,
      { titolo, slug: `e2e-tplpagina-${u}` },
    ),
  );
});

test.afterAll(() => {
  sql(`DELETE FROM backoffice_videogame WHERE id = :'id'::int`, { id });
});

// Registra le richieste a /api/graphql fatte dalla pagina.
function spiaGraphql(page) {
  const chiamate = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/graphql')) chiamate.push(r.url());
  });
  return chiamate;
}

test('si apre senza login e senza chiamate a /api/graphql', async ({ page }) => {
  const graphql = spiaGraphql(page);
  await page.goto('/bo/template');
  await expect(page).toHaveURL(/\/bo\/template$/);
  await expect(page.getByRole('heading', { name: 'MINUTAGGI' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scarica il template' })).toBeVisible();
  expect(await page.context().cookies()).toEqual([]);
  expect(graphql).toEqual([]);
  // i due canali ufficiali per mandare il file allo staff
  await expect(page.getByRole('link', { name: 'issue su GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/pdonadeo/e-uscito-joypad/issues',
  );
  await expect(page.getByRole('link', { name: 'server Discord' })).toHaveAttribute('href', 'https://discord.gg/abQEbvuBrt');
});

test('il clic scarica minutaggi-joypad.xlsx con il videogame appena creato', async ({ page }) => {
  const graphql = spiaGraphql(page);
  await page.goto('/bo/template');
  const download = page.waitForEvent('download'); // registrato prima del clic
  await page.getByRole('button', { name: 'Scarica il template' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('minutaggi-joypad.xlsx');

  const dati = fs.readFileSync(await file.path());
  expect(dati.length).toBeGreaterThan(0);
  const parti = unzipSync(new Uint8Array(dati));
  expect(Object.keys(parti)).toContain('xl/worksheets/sheet2.xml');
  // la voce del menu è «id-titolo», con l'escape XML
  const voce = `${id}-${titolo}`.replace(/&/g, '&amp;');
  expect(strFromU8(parti['xl/sharedStrings.xml'])).toContain(`<t xml:space="preserve">${voce}</t>`);
  expect(graphql).toEqual([]);
});

test('se l\'elenco non arriva, un Alert lo dice e nessun file viene scaricato', async ({ page }) => {
  await page.route('**/api/template/videogame', (r) => r.fulfill({ status: 500, body: '{"status":"error"}' }));
  let scaricati = 0;
  page.on('download', () => scaricati++);
  await page.goto('/bo/template');
  await page.getByRole('button', { name: 'Scarica il template' }).click();
  await expect(page.getByRole('alert')).toHaveText("Non riesco a scaricare l'elenco dei videogame. Riprova tra poco.");
  await expect(page.getByRole('button', { name: 'Scarica il template' })).toBeEnabled();
  expect(scaricati).toBe(0);
});

test('se il generatore non si carica (sito aggiornato a pagina aperta), l\'Alert chiede di ricaricare', async ({ page }) => {
  await page.goto('/bo/template');
  await expect(page.getByRole('heading', { name: 'MINUTAGGI' })).toBeVisible();
  // la pagina è già caricata: l'unico pezzo «template-*.js» che resta da chiedere è il generatore
  await page.route('**/bo/assets/template-*.js', (r) => r.abort());
  await page.getByRole('button', { name: 'Scarica il template' }).click();
  await expect(page.getByRole('alert')).toHaveText('Non riesco a preparare il file. Ricarica la pagina e riprova.');
});

test('le pagine dello staff restano dietro il login', async ({ page }) => {
  await page.goto('/bo/episodi');
  await expect(page).toHaveURL(/\/bo\/login$/);
});
