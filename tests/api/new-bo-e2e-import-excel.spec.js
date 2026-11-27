// Import Excel nel form dell'episodio (Fase 4 del piano dell'import, criteri I1-I7, I10, P1-P6).
// I file di prova sono in fixture/import-excel/ (li genera new-bo/scripts/genera-fixture-excel.ts)
// e citano i videogame 990001-990003, inseriti da global-setup.js. Gli slug «e2e-…» passano dal
// finto RAWG (mock-rawg.js), che conta le chiamate su /calls.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { RAWG_PORT, USERS, sql } = require('./env');
const { loggedIn, uniq } = require('./helpers');
const { creaEpisodio, leggiEpisodio } = require('./gql-helpers');

test.use({ extraHTTPHeaders: {}, viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: 'serial' }); // le chiamate a RAWG si contano: una cosa alla volta

const FIXTURE = path.join(__dirname, 'fixture', 'import-excel');
const fixture = (nome) => path.join(FIXTURE, nome);

let api;

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
});

test.afterAll(async () => {
  await api.dispose();
});

// --- aiuti ---------------------------------------------------------------------------------------

// Toglie dal DB un gioco che l'import deve creare: così il test non dipende da un'esecuzione
// precedente interrotta prima del teardown.
function senzaGioco(slug) {
  sql(
    `DELETE FROM backoffice_associazioneepisodiovideogame
WHERE videogame_id IN (SELECT id FROM backoffice_videogame WHERE rawg_slug = :'slug');
DELETE FROM backoffice_videogame WHERE rawg_slug = :'slug';`,
    { slug },
  );
}
const giocoNelDb = (slug) => sql(`SELECT count(*) FROM backoffice_videogame WHERE rawg_slug = :'slug'`, { slug }) === '1';

async function chiamateRawg() {
  const res = await fetch(`http://127.0.0.1:${RAWG_PORT}/calls`);
  return Number(await res.text());
}

const episodio = (associazioni = []) =>
  creaEpisodio(api, {
    titolo: `[E2E] import ${uniq()}`,
    data_uscita: '2001-01-01',
    durata: '1:30:00',
    associazioni,
  });

async function entra(page) {
  await page.goto('/bo/login');
  await page.getByLabel('Nome utente').fill(USERS.staff.username);
  await page.getByLabel("Parola d'ordine").fill(USERS.staff.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
}

async function apri(page, id) {
  await entra(page);
  await page.goto(`/bo/episodi/${id}`);
  await expect(page.getByRole('button', { name: 'Importa da Excel' })).toBeVisible();
}

const importa = (page, file) => page.getByTestId('file-excel').setInputFiles(file);
const toast = (page) => page.locator('[data-slot=toast]');
const dialogo = (page) => page.getByRole('alertdialog');
// Il Dialog degli errori: per contenuto, perché quello di avanzamento può essere ancora in uscita.
const dialogoErrori = (page) => dialogo(page).filter({ hasText: 'Import non riuscito' });

// Le righe di «Videogiochi citati» come le mostra il form: [videogame, istante, tipologia, speaker].
async function righeForm(page) {
  const giochi = page.getByRole('combobox', { name: /^Videogame, riga \d+$/ });
  const n = await giochi.count();
  const righe = [];
  for (let i = 1; i <= n; i++) {
    righe.push([
      await page.getByRole('combobox', { name: `Videogame, riga ${i}` }).inputValue(),
      await page.getByLabel(`Istante, riga ${i}`).inputValue(),
      (await page.getByRole('combobox', { name: `Tipologia, riga ${i}` }).textContent()).trim(),
      (await page.getByRole('combobox', { name: `Speaker, riga ${i}` }).textContent()).trim(),
    ]);
  }
  return righe;
}

// Il Dialog degli errori: titolo e voci dell'elenco; poi lo chiude.
async function errori(page) {
  const d = dialogoErrori(page);
  await expect(d).toBeVisible();
  const titolo = await d.getByRole('heading').textContent();
  const voci = await d.getByRole('list', { name: 'Errori' }).getByRole('listitem').allTextContents();
  await expect(d).toContainText('Il form non è cambiato');
  await d.getByRole('button', { name: 'Chiudi' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  return { titolo, voci };
}

const VALIDO = [
  ['E2E Fixture 1', '0:12:30', 'Recensione', 'Matteo Bordone (corri!)'],
  ['E2E Fixture 2', '1:02:03', 'Chiacchiera libera', 'Alessandro Zampini (spara!)'],
  ['E2E Fixture 3', '0:10:11', 'Chiacchiera libera', 'Tutti'],
];

// --- scenari -------------------------------------------------------------------------------------

test('1. episodio senza righe, file valido: nessuna conferma, righe nell\'ordine del file, niente salvato', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  await importa(page, fixture('valido.xlsx'));
  await expect(toast(page)).toContainText('3 righe importate: ricordati di salvare');
  await expect(dialogo(page)).toHaveCount(0);
  expect(await righeForm(page)).toEqual(VALIDO);
  await expect(page.getByText('Videogiochi citati · 3')).toBeVisible();
  await expect(page.locator('form[data-modificato=true]')).toHaveCount(1); // da salvare
  expect((await leggiEpisodio(api, e.id)).associazioni).toEqual([]);
});

test('2. episodio con righe: la conferma ha i due numeri; «annulla» non chiama né RAWG né il DB', async ({ page }) => {
  const e = await episodio([
    { videogame_id: 990003, istante: '0:01:00' },
    { videogame_id: 990002, istante: '0:02:00' },
  ]);
  await apri(page, e.id);
  const prima = await righeForm(page);
  const chiamate = await chiamateRawg();
  const graphql = [];
  page.on('request', (r) => r.url().includes('/api/graphql') && graphql.push(r.postData()));

  // valido-slug.xlsx creerebbe un gioco da RAWG: con «annulla» non deve succedere
  await importa(page, fixture('valido-slug.xlsx'));
  await expect(dialogo(page).getByRole('heading')).toHaveText('Sostituire le 2 associazioni presenti con le 3 del file?');
  await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
  await expect(dialogo(page)).toHaveCount(0);
  expect(await righeForm(page)).toEqual(prima);
  expect(await chiamateRawg()).toBe(chiamate);
  expect(graphql).toEqual([]);

  await importa(page, fixture('valido.xlsx'));
  await dialogo(page).getByRole('button', { name: 'Sostituisci' }).click();
  await expect(toast(page)).toContainText('3 righe importate');
  expect(await righeForm(page)).toEqual(VALIDO);
  expect(await chiamateRawg()).toBe(chiamate);
});

test('3. slug nuovo su due righe: RAWG chiamato una volta, riepilogo «1 videogame creato»', async ({ page }) => {
  senzaGioco('e2e-import-nuovo');
  const e = await episodio();
  await apri(page, e.id);
  const chiamate = await chiamateRawg();
  // la creazione si rallenta di proposito, per vedere il Dialog di avanzamento che copre il form
  let lascia;
  const attesa = new Promise((ok) => (lascia = ok));
  await page.route('**/api/graphql', async (r) => {
    if ((r.request().postData() || '').includes('CreaVideogame')) await attesa;
    await r.continue();
  });
  await importa(page, fixture('valido-slug.xlsx'));
  await expect(dialogo(page)).toContainText('Creo i videogame nuovi da RAWG: 0 di 1.');
  // Dialog modale di Radix: il resto della pagina non riceve i clic
  await expect(page.locator('body')).toHaveCSS('pointer-events', 'none');
  await page.keyboard.press('Escape'); // non si chiude
  await expect(dialogo(page)).toBeVisible();
  lascia();
  await expect(toast(page)).toContainText('3 righe importate, 1 videogame creato da RAWG: ricordati di salvare');
  await expect(dialogo(page)).toHaveCount(0);
  expect(await chiamateRawg()).toBe(chiamate + 1);
  expect((await righeForm(page)).map((r) => r[0])).toEqual([
    'E2E Game e2e-import-nuovo',
    'E2E Fixture 1',
    'E2E Game e2e-import-nuovo',
  ]);
});

test('4. slug già nel DB: nessuna chiamata a RAWG', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  const chiamate = await chiamateRawg();
  await importa(page, fixture('slug-esistente.xlsx'));
  await expect(toast(page)).toContainText('1 riga importata: ricordati di salvare');
  expect(await righeForm(page)).toEqual([['E2E Fixture 2', '0:03:00', 'Chiacchiera libera', 'Tutti']]);
  expect(await chiamateRawg()).toBe(chiamate);
});

test('5. VIDEOGAME e slug insieme: si usa il gioco, lo slug si ignora', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  const chiamate = await chiamateRawg();
  await importa(page, fixture('videogame-e-slug.xlsx'));
  await expect(toast(page)).toContainText('1 riga importata');
  expect((await righeForm(page)).map((r) => r[0])).toEqual(['E2E Fixture 3']);
  expect(await chiamateRawg()).toBe(chiamate);
});

test('6. slug che RAWG non conosce: errore di riga, form invariato', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  const chiamate = await chiamateRawg();
  await importa(page, fixture('slug-sconosciuto.xlsx'));
  expect(await errori(page)).toEqual({
    titolo: '1 errore nel file',
    voci: ['Riga 3: Gioco «e2e-missing-import» non trovato su RAWG'],
  });
  expect(await righeForm(page)).toEqual([]);
  expect(await chiamateRawg()).toBe(chiamate + 1);
});

test('6b. id che nel DB non c\'è: errore di riga prima di qualsiasi chiamata a RAWG', async ({ page }) => {
  senzaGioco('e2e-import-mai');
  const e = await episodio();
  await apri(page, e.id);
  const chiamate = await chiamateRawg();
  await importa(page, fixture('id-inesistente.xlsx'));
  expect((await errori(page)).voci).toEqual(["Riga 3: videogame non trovato: nel DB non c'è l'id 990999"]);
  expect(await chiamateRawg()).toBe(chiamate);
  expect(giocoNelDb('e2e-import-mai')).toBe(false);
});

test('6c. uno slug creato e uno sconosciuto: errore, e il Dialog dice che il gioco creato resta (D4)', async ({ page }) => {
  senzaGioco('e2e-import-resta');
  const e = await episodio();
  await apri(page, e.id);
  await importa(page, fixture('slug-misto.xlsx'));
  await expect(dialogoErrori(page)).toContainText('Il videogame creato da RAWG nel frattempo resta nel DB.');
  expect((await errori(page)).voci).toEqual(['Riga 3: Gioco «e2e-missing-misto» non trovato su RAWG']);
  expect(await righeForm(page)).toEqual([]);
  expect(giocoNelDb('e2e-import-resta')).toBe(true);
});

test('6d. il server non risponde durante la ricerca dei giochi: errore che non dà la colpa al file', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  await page.route('**/api/graphql', (r) => r.abort());
  await importa(page, fixture('valido.xlsx'));
  await expect(dialogoErrori(page).getByRole('heading')).toHaveText('Qualcosa è andato storto');
  await expect(dialogoErrori(page)).not.toContainText('correggi il file');
  expect((await errori(page)).voci).toEqual(['Il server non risponde. Controlla la connessione e riprova.']);
  expect(await righeForm(page)).toEqual([]);
});

test('7. errori misti: elenco con i numeri di riga, form invariato', async ({ page }) => {
  const e = await episodio([{ videogame_id: 990001, istante: '0:05:00' }]);
  await apri(page, e.id);
  const prima = await righeForm(page);
  await importa(page, fixture('errori-misti.xlsx'));
  // gli errori locali arrivano prima della conferma: nessuna domanda su un file sbagliato
  expect(await errori(page)).toEqual({
    titolo: '6 errori nel file',
    voci: [
      'Riga 3: videogame non riconoscibile: «Gioco senza id»',
      'Riga 4: istante non valido: «1:75:00» (si scrive H:MM:SS o MM:SS)',
      'Riga 5: tipologia non riconosciuta: «Intervista»',
      'Riga 5: speaker non riconosciuto: «Pippo»',
      'Riga 6: manca il videogame (o il suo RAWG slug)',
      'Riga 7: RAWG slug non valido: «slug con spazi» (solo lettere, cifre, «-» e «_»)',
    ],
  });
  expect(await righeForm(page)).toEqual(prima);
});

test('8. istante oltre la durata (P1): errore di riga', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  await importa(page, fixture('istante-orario.xlsx'));
  expect((await errori(page)).voci).toEqual([
    'Riga 2: istante 12:30:00 oltre la durata nel form (1:30:00): forse MM:SS letto come ore?',
  ]);
  expect(await righeForm(page)).toEqual([]);
});

test('9. le righe importate si modificano e si eliminano, e SALVA le scrive', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  await importa(page, fixture('valido.xlsx'));
  await expect(toast(page)).toContainText('3 righe importate');
  await page.getByLabel('Istante, riga 1').fill('0:20:00');
  await page.getByRole('button', { name: 'Rimuovi E2E Fixture 2' }).click();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
  const salvate = (await leggiEpisodio(api, e.id)).associazioni.map((a) => [a.videogame_id, a.istante, a.tipologia, a.speaker]);
  expect(salvate.sort()).toEqual(
    [
      [990001, '00:20:00', 'RECE', 'BORD'],
      [990003, '00:10:11', 'FREE', 'TUTT'],
    ].sort(),
  );
});

test('9b. dopo l\'import, SALVA E CONTINUA scrive le righe e resta sulla pagina', async ({ page }) => {
  const e = await episodio([{ videogame_id: 990003, istante: '0:09:00' }]);
  await apri(page, e.id);
  await importa(page, fixture('valido.xlsx'));
  await dialogo(page).getByRole('button', { name: 'Sostituisci' }).click();
  await expect(toast(page)).toContainText('3 righe importate');
  await page.getByRole('button', { name: 'Salva e continua' }).click();
  // il Toast dell'import sta ancora uscendo: si cerca quello nuovo per testo
  await expect(toast(page).filter({ hasText: 'Modifiche salvate' })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/bo/episodi/${e.id}$`));
  await expect(page.locator('form[data-modificato=false]')).toHaveCount(1);
  // il form riparte dai dati salvati, che il server ordina per istante
  expect(await righeForm(page)).toEqual([VALIDO[2], VALIDO[0], VALIDO[1]]);
  const salvate = (await leggiEpisodio(api, e.id)).associazioni.map((a) => [a.videogame_id, a.istante]);
  expect(salvate.sort()).toEqual(
    [
      [990001, '00:12:30'],
      [990002, '01:02:03'],
      [990003, '00:10:11'],
    ].sort(),
  );
});

test('10. nuovo episodio: errore con la durata iniziale 0:30:00, import e CREA con 1:30:00 (P3, P4)', async ({ page }) => {
  const titolo = `[E2E] import nuovo ${uniq()}`;
  await entra(page);
  await page.goto('/bo/episodi/nuovo');
  await expect(page.getByLabel('Durata')).toHaveValue('0:30:00');
  await importa(page, fixture('istante-lungo.xlsx'));
  expect((await errori(page)).voci).toEqual([
    'Riga 2: istante 0:45:00 oltre la durata nel form (0:30:00): correggi la durata o il file',
  ]);

  await page.getByLabel('Durata').fill('1:30:00');
  await importa(page, fixture('istante-lungo.xlsx'));
  await expect(toast(page)).toContainText('1 riga importata');
  await page.getByLabel('Titolo').fill(titolo);
  await page.getByLabel('Data uscita').fill('2001-05-06');
  await page.getByRole('button', { name: 'Crea' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi\/\d+$/);
  const id = Number(page.url().split('/').pop());
  expect((await leggiEpisodio(api, id)).associazioni).toMatchObject([
    { videogame_id: 990002, istante: '00:45:00', tipologia: 'RECE', speaker: 'TUTT' },
  ]);
});

test('11. durata vuota (P4): errore unico, form invariato', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  await page.getByLabel('Durata').fill('');
  await importa(page, fixture('valido.xlsx'));
  expect(await errori(page)).toEqual({
    titolo: 'Il file non si può importare',
    voci: ["Compila prima la durata dell'episodio"],
  });
  expect(await righeForm(page)).toEqual([]);
});

test('12. il template vuoto scaricato da /bo/template e reimportato (P6, I10): errore unico', async ({ page }) => {
  await page.goto('/bo/template');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Scarica il template' }).click();
  const scaricato = path.join(test.info().outputDir, 'template-vuoto.xlsx');
  await (await download).saveAs(scaricato);
  expect(fs.statSync(scaricato).size).toBeGreaterThan(0);

  const e = await episodio();
  await apri(page, e.id);
  await importa(page, scaricato);
  expect(await errori(page)).toEqual({
    titolo: 'Il file non si può importare',
    voci: ['Il file non contiene nessuna riga compilata'],
  });
  expect(await righeForm(page)).toEqual([]);
});

// --- andata e ritorno nei tre programmi (Fase 5, T7) ---------------------------------------------

test('T7 LibreOffice: valido-slug.xlsx risalvato da LibreOffice si importa come l\'originale', async ({ page }) => {
  senzaGioco('e2e-import-nuovo');
  const e = await episodio();
  await apri(page, e.id);
  await importa(page, fixture('libreoffice.xlsx'));
  await expect(toast(page)).toContainText('3 righe importate, 1 videogame creato da RAWG');
  expect(await righeForm(page)).toEqual([
    ['E2E Game e2e-import-nuovo', '0:05:00', 'Consiglio', 'Tutti'],
    ['E2E Fixture 1', '0:06:00', 'Chiacchiera libera', 'Tutti'],
    ['E2E Game e2e-import-nuovo', '0:07:00', 'Chiacchiera libera', 'Francesco Fossetti (salta!)'],
  ]);
});

// excel.xlsx e sheets.xlsx li ha compilati Paolo a mano, partendo dal template scaricato da
// /bo/template con il DB di sviluppo (istruzioni in TEST.md, «Fixture manuali dell'import Excel»).
// VALGONO SOLO PER IL DB DI SVILUPPO: la riga 2 cita il videogame 542 «Death Stranding 2» scelto
// dal menu. Se quel gioco cambia, le fixture vanno rifatte.
const GIOCO_MANUALE = { id: 542, titolo: 'Death Stranding 2' };

// Tutti e due hanno lo slug e2e-excel-manuale: ogni test toglie prima il gioco che crea.
for (const [file, programma] of [
  ['excel.xlsx', 'Excel (online)'],
  ['sheets.xlsx', 'Google Sheets'],
]) {
  const slug = 'e2e-excel-manuale';
  test(`T7 ${programma}: ${file}, compilato a mano, si importa`, async ({ page }) => {
    if (!fs.existsSync(fixture(file)))
      throw new Error(`manca fixture/import-excel/${file}: va compilato in ${programma} (TEST.md, «Fixture manuali dell'import Excel»)`);
    const titolo = sql(`SELECT titolo FROM backoffice_videogame WHERE id = :'id'::int`, { id: GIOCO_MANUALE.id });
    if (titolo !== GIOCO_MANUALE.titolo)
      throw new Error(
        `${file} cita il videogame ${GIOCO_MANUALE.id} «${GIOCO_MANUALE.titolo}», che nel DB di sviluppo ` +
          `${titolo ? `ora si chiama «${titolo}»` : 'non c\'è più'}: rifai le fixture manuali (TEST.md).`,
      );
    senzaGioco(slug);
    const e = await episodio();
    await apri(page, e.id);
    await importa(page, fixture(file));
    await expect(toast(page)).toContainText('2 righe importate, 1 videogame creato da RAWG');
    expect(await righeForm(page)).toEqual([
      [GIOCO_MANUALE.titolo, '0:12:30', 'Recensione', 'Matteo Bordone (corri!)'],
      [`E2E Game ${slug}`, '1:02:03', 'Consiglio', 'Tutti'],
    ]);
  });
}

test('un file che non è un .xlsx: errore leggibile', async ({ page }) => {
  const e = await episodio();
  await apri(page, e.id);
  await importa(page, { name: 'finto.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('non un foglio') });
  expect((await errori(page)).voci).toEqual(['Il file non è un .xlsx leggibile']);
});
