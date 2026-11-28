// La home non scarica il codice del backoffice. Quali file lo contengono lo dice
// frontend/dist/.vite/chunk.json, scritto dal build di Vite.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./env');

const ELENCO = path.join(ROOT, 'frontend', 'dist', '.vite', 'chunk.json');

// Le definizioni non separate delle rotte del bo (src/routes/bo/*.tsx, anche con ?tsr-shared=1)
// stanno di proposito nel chunk d'ingresso. Sono del bo i pezzi separati dal router (tsr-split),
// le librerie usate solo dal bo e il client GraphQL.
const LIBRERIE_BO =
  /\/node_modules\/(graphql|graphql-request|read-excel-file|fflate|cmdk|@tanstack\/react-table|@tanstack\/react-form|sonner)\//;
const moduloDelBo = (id) =>
  (id.includes('src/routes/bo/') && id.includes('tsr-split')) ||
  LIBRERIE_BO.test(id) ||
  id.includes('src/gql/') ||
  id.includes('src/lib/graphql.ts');

// Il browser deve mandare la sua Origin vera, non quella forzata dalla config per l'API.
test.use({ extraHTTPHeaders: {} });

function leggiChunk() {
  if (!fs.existsSync(ELENCO)) {
    throw new Error(`manca ${ELENCO}: prima serve «bun run --cwd frontend build»`);
  }
  return Object.values(JSON.parse(fs.readFileSync(ELENCO, 'utf8')));
}

test('su / non parte nessuna richiesta ai chunk del backoffice', async ({ page }) => {
  const chunk = leggiChunk();
  const delBo = chunk.filter((c) => c.moduleIds.some(moduloDelBo));
  // senza questi controlli il test passerebbe anche con un elenco vuoto o in un altro formato
  const rotteSeparate = delBo.filter((c) => c.moduleIds.some((id) => id.includes('src/routes/bo/') && id.includes('tsr-split')));
  expect(rotteSeparate.length, 'nessun chunk con rotte separate di src/routes/bo/ in chunk.json').toBeGreaterThan(0);
  const vietati = new Set(delBo.map((c) => `/${c.fileName}`));

  const richiesti = [];
  page.on('request', (r) => richiesti.push(new URL(r.url()).pathname));
  const risposta = page.waitForResponse('**/api/ultima-puntata');
  await page.goto('/');
  await risposta;
  await page.waitForLoadState('networkidle');

  const ingresso = chunk.filter((c) => c.isEntry).map((c) => `/${c.fileName}`);
  expect(ingresso.length).toBeGreaterThan(0);
  expect(richiesti).toEqual(expect.arrayContaining(ingresso));
  expect(richiesti.filter((url) => vietati.has(url))).toEqual([]);
});
