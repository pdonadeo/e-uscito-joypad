// Test e2e degli episodi di /new-bo (Fase 3.6c.2): F-EP-01 … F-EP-11, F-AS-01 … F-AS-03.
// Girano con playwright.api.config.js, come new-bo-e2e.spec.js. Le fixture (videogame ed
// episodi «[E2E] …») si creano via REST con un token unico per test e si cercano con la
// ricerca dell'elenco, così i test non dipendono dagli episodi del DB di sviluppo.
// Elenco e modifica si provano a 390, 1180 e 1440.
const { test, expect } = require('@playwright/test');
const { API_URL, USERS } = require('./env');
const { loggedIn, uniq, PNG_1x1, JPEG } = require('./helpers');

// Il browser manda la sua Origin vera; le chiamate di page.request la mettono a mano (V-01).
test.use({ extraHTTPHeaders: {} });
const ORIGIN = { Origin: API_URL };

const VIEWPORT = {
  390: { width: 390, height: 844 },
  1180: { width: 1180, height: 820 },
  1440: { width: 1440, height: 900 },
};

let api; // sessione REST dello staff per fixture e verifiche
const giochi = [];

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
  for (let i = 0; i < 3; i++) {
    const res = await api.post('/api/bo/videogame', { data: { rawg_slug: `e2e-nbep-${i}-${uniq()}` } });
    expect(res.status(), await res.text()).toBe(201);
    giochi.push(await res.json());
  }
});

test.afterAll(async () => {
  await api.dispose();
});

// --- aiuti ------------------------------------------------------------------------------------

async function entra(page, user = USERS.staff) {
  await page.goto('/new-bo/login');
  await page.getByLabel('Nome utente').fill(user.username);
  await page.getByLabel("Parola d'ordine").fill(user.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/new-bo\/episodi$/);
}

async function nuovoEpisodio(extra = {}) {
  const res = await api.post('/api/bo/episodi', {
    data: {
      titolo: `[E2E] new-bo ${uniq()}`,
      episodio_numero: 'E2E',
      data_uscita: '2001-01-01',
      durata: '1:02:03',
      ...extra,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

async function leggi(id) {
  const res = await api.get(`/api/bo/episodi/${id}`);
  return { status: res.status(), body: res.status() === 200 ? await res.json() : null };
}

async function conCover(id) {
  const res = await api.post(`/api/bo/episodi/${id}/cover`, {
    multipart: { file: { name: 'cover.png', mimeType: 'image/png', buffer: PNG_1x1 } },
  });
  expect(res.status(), await res.text()).toBe(200);
}

const elenco = (page, token, extra = '') =>
  page.goto(`/new-bo/episodi?ricerca=${encodeURIComponent(token)}${extra}`);

// Righe della tabella (desktop) o schede (390) dell'elenco.
const righe = (page) => page.locator('tbody tr[data-cliccabile]');
const schede = (page) => page.locator('main section[data-slot=card]');

// Sceglie un videogame nel Combobox della riga indicata (F-EP-09 con la ricerca di F-VG-03).
async function scegliGioco(page, riga, gioco) {
  const campo = page.getByRole('combobox', { name: `Videogame, riga ${riga}` });
  await campo.click();
  await campo.fill(gioco.rawg_slug);
  await page.getByRole('option', { name: new RegExp(gioco.rawg_slug) }).click();
  await expect(campo).toHaveValue(gioco.titolo);
}

async function scegli(page, nome, opzione) {
  await page.getByRole('combobox', { name: nome }).click();
  await page.getByRole('option', { name: opzione, exact: true }).click();
}

const toast = (page) => page.locator('[data-slot=toast]');

// --- Elenco (F-EP-01 … F-EP-04, F-EP-08 in blocco) ------------------------------------------

test.describe('elenco a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-EP-01: righe con numero, titolo, data, durata, presenze e pubblicato; 20 righe di default; clic → modifica', async ({ page }) => {
    const token = uniq();
    const e = await nuovoEpisodio({
      titolo: `[E2E] new-bo ${token} completo`,
      episodio_numero: '901',
      data_uscita: '2001-02-03',
      durata: '0:30:00',
      url: 'https://example.com/a.mp3',
      url_video: 'https://example.com/v',
      pubblicato: true,
    });
    await conCover(e.id);
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} vuoto`, pubblicato: false });
    await entra(page);
    await elenco(page, token);
    await expect(righe(page)).toHaveCount(2);
    const r = righe(page).filter({ hasText: 'completo' });
    await expect(r).toContainText('901');
    await expect(r).toContainText('2001-02-03');
    await expect(r).toContainText('0:30:00');
    await expect(r.getByText('Cover presente')).toBeAttached();
    await expect(r.getByText('Audio presente')).toBeAttached();
    await expect(r.getByText('Post assente')).toBeAttached();
    await expect(r.getByText('Video presente')).toBeAttached();
    await expect(r.locator('[data-slot=badge]')).toHaveText('Sì');
    await expect(righe(page).filter({ hasText: 'vuoto' }).locator('[data-slot=badge]')).toHaveText('No');
    await expect(page.getByRole('combobox', { name: 'Righe per pagina' })).toHaveText(/20/);
    await expect(page.getByText('1–2 di 2')).toBeVisible();
    await r.click();
    await expect(page).toHaveURL(new RegExp(`/new-bo/episodi/${e.id}$`));
  });

  test('F-EP-01: righe per pagina e pagine', async ({ page }) => {
    const token = uniq();
    for (let i = 0; i < 6; i++) await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} ${i}` });
    await entra(page);
    await elenco(page, token);
    await scegli(page, 'Righe per pagina', '5');
    await expect(righe(page)).toHaveCount(5);
    await expect(page.getByText('1–5 di 6')).toBeVisible();
    await page.getByRole('button', { name: 'Pagina 2' }).click();
    await expect(righe(page)).toHaveCount(1);
    await expect(page.getByText('6–6 di 6')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pagina successiva' })).toBeDisabled();
    await page.getByRole('button', { name: 'Pagina precedente' }).click();
    await expect(righe(page)).toHaveCount(5);
  });

  test('F-EP-02: default data decrescente, clic sulle intestazioni ordina nei due versi', async ({ page }) => {
    const token = uniq();
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} B`, data_uscita: '2001-01-01' });
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} A`, data_uscita: '2001-01-03' });
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} C`, data_uscita: '2001-01-02' });
    await entra(page);
    await elenco(page, token);
    const titoli = () => righe(page).locator('td:nth-child(3)').allInnerTexts();
    await expect(page.getByRole('columnheader', { name: /Data uscita/ })).toHaveAttribute('aria-sort', 'descending');
    expect((await titoli()).map((t) => t.slice(-1))).toEqual(['A', 'C', 'B']);
    await page.getByRole('button', { name: 'Titolo' }).click();
    await expect(page.getByRole('columnheader', { name: /Titolo/ })).toHaveAttribute('aria-sort', 'ascending');
    await expect.poll(async () => (await titoli()).map((t) => t.slice(-1))).toEqual(['A', 'B', 'C']);
    await page.getByRole('button', { name: 'Titolo' }).click();
    await expect(page.getByRole('columnheader', { name: /Titolo/ })).toHaveAttribute('aria-sort', 'descending');
    await expect.poll(async () => (await titoli()).map((t) => t.slice(-1))).toEqual(['C', 'B', 'A']);
  });

  test('F-EP-03: la ricerca è «contiene», senza maiuscole, sugli spazi esterni e su numero e titolo', async ({ page }) => {
    const token = uniq();
    await nuovoEpisodio({ titolo: `[E2E] new-bo Ricerca ${token}`, episodio_numero: `N${token}` });
    await entra(page);
    const campo = page.getByRole('searchbox', { name: 'Cerca per numero o titolo' });
    await campo.fill(`  ricerca ${token}  `);
    await expect(righe(page)).toHaveCount(1);
    await expect(page).toHaveURL(/ricerca=/);
    await campo.fill(`n${token}`);
    await expect(righe(page)).toHaveCount(1);
    await campo.fill(`${token}%`);
    await expect(page.getByText('Nessun episodio trovato.')).toBeVisible();
  });

  test('F-EP-04: «+ Aggiungi filtro» aggiunge «Pubblicato», che filtra e si toglie con ✕', async ({ page }) => {
    const token = uniq();
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} si`, pubblicato: true });
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} no`, pubblicato: false });
    await entra(page);
    await elenco(page, token);
    await expect(page.getByRole('combobox', { name: 'Pubblicato' })).toHaveCount(0);
    await page.getByRole('button', { name: '+ Aggiungi filtro' }).click();
    await expect(page.getByRole('combobox', { name: 'Pubblicato' })).toHaveText(/Tutti/);
    await expect(righe(page)).toHaveCount(2);
    await scegli(page, 'Pubblicato', 'Sì');
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page)).toContainText(`${token} si`);
    await scegli(page, 'Pubblicato', 'No');
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page)).toContainText(`${token} no`);
    await page.getByRole('button', { name: 'Togli il filtro Pubblicato' }).click();
    await expect(righe(page)).toHaveCount(2);
  });

  test('F-EP-08: eliminazione in blocco con conferma, testo dei «collegamenti»', async ({ page }) => {
    const token = uniq();
    const a = await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} 1`, associazioni: [{ videogame_id: giochi[0].id }] });
    const b = await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} 2` });
    const c = await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} 3` });
    await entra(page);
    await elenco(page, token);
    await page.getByRole('checkbox', { name: `Seleziona l'episodio ${a.titolo}` }).check();
    await page.getByRole('checkbox', { name: `Seleziona l'episodio ${b.titolo}` }).check();
    await expect(page.getByText('2 episodi selezionati')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Seleziona tutti' })).toHaveAttribute('data-state', 'indeterminate');
    await page.getByRole('button', { name: 'Elimina selezionati' }).click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo.getByRole('heading')).toHaveText('Eliminare 2 episodi?');
    await expect(dialogo).toContainText('tutti i loro collegamenti ai videogiochi citati');
    await expect(dialogo).toContainText('I videogiochi restano nel catalogo e i file delle cover restano sul server.');
    await expect(dialogo.getByRole('button', { name: 'Annulla' })).toBeFocused();
    await dialogo.getByRole('button', { name: 'Elimina' }).click();
    await expect(dialogo).toBeHidden();
    await expect(righe(page)).toHaveCount(1);
    expect((await leggi(a.id)).status).toBe(404);
    expect((await leggi(b.id)).status).toBe(404);
    expect((await leggi(c.id)).status).toBe(200);
    // i videogame restano
    expect((await api.get(`/api/bo/videogame/${giochi[0].id}`)).status()).toBe(200);
  });
});

test.describe('elenco a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('F-EP-01, F-EP-03: tabella con la ricerca e la Sidebar a rotaia', async ({ page }) => {
    const token = uniq();
    await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} rotaia` });
    await entra(page);
    await page.getByRole('searchbox', { name: 'Cerca per numero o titolo' }).fill(token);
    await expect(righe(page)).toHaveCount(1);
    await expect(page.getByRole('columnheader', { name: 'Pubblicato' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Aggiungi filtro' })).toBeVisible();
    await righe(page).first().click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(`${token} rotaia`);
  });
});

test.describe('elenco a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('F-EP-01, F-EP-02, F-EP-04: schede, ORDINA, filtro e paginazione mobile', async ({ page }) => {
    const token = uniq();
    for (let i = 0; i < 6; i++)
      await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} ${i}`, data_uscita: `2001-01-0${i + 1}`, pubblicato: i < 2 });
    await entra(page);
    await elenco(page, token, '&righe=5');
    await expect(page.locator('table')).toHaveCount(0);
    await expect(schede(page)).toHaveCount(5);
    await expect(schede(page).first()).toContainText(`${token} 5`);
    await expect(page.getByText('Pagina 1 di 2')).toBeVisible();
    await page.getByRole('button', { name: 'Pagina successiva' }).click();
    await expect(page.getByText('Pagina 2 di 2')).toBeVisible();
    await expect(schede(page)).toHaveCount(1);
    await scegli(page, 'Ordina', 'Data uscita, meno recenti');
    await expect(page.getByText('Pagina 1 di 2')).toBeVisible();
    await expect(schede(page).first()).toContainText(`${token} 0`);
    await page.getByRole('button', { name: '+ Filtro' }).click();
    await scegli(page, 'Pubblicato', 'Sì');
    await expect(schede(page)).toHaveCount(2);
    await expect(schede(page).first().locator('[data-slot=badge]').first()).toHaveText(/Pubblicato/);
    await schede(page).first().click();
    await expect(page).toHaveURL(/\/new-bo\/episodi\/\d+$/);
  });

  test('F-EP-08: in blocco a 390, con il singolare', async ({ page }) => {
    const token = uniq();
    const a = await nuovoEpisodio({ titolo: `[E2E] new-bo ${token} solo` });
    await entra(page);
    await elenco(page, token);
    await page.getByRole('checkbox', { name: `Seleziona l'episodio ${a.titolo}` }).check();
    await expect(page.getByText('1 selezionato')).toBeVisible();
    await page.getByRole('button', { name: 'Elimina' }).click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo.getByRole('heading')).toHaveText('Eliminare 1 episodio?');
    await expect(dialogo).toContainText('Stai per eliminare 1 episodio e tutti i suoi collegamenti');
    await dialogo.getByRole('button', { name: 'Elimina' }).click();
    await expect(page.getByText('Nessun episodio trovato.')).toBeVisible();
    expect((await leggi(a.id)).status).toBe(404);
  });
});

// --- Modifica (F-EP-05, F-EP-07, F-EP-09 … F-EP-11, F-AS-03) --------------------------------

test.describe('modifica a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-EP-05: il form parte dal dettaglio completo, associazioni per istante', async ({ page }) => {
    const e = await nuovoEpisodio({
      episodio_numero: '777',
      durata: '1:12:45',
      data_uscita: '2001-11-12',
      url: 'https://example.com/a.mp3',
      url_post: 'https://example.com/p',
      descrizione_txt: 'Testo',
      descrizione_html: '<p>Html</p>',
      note: 'Nota',
      pubblicato: true,
      associazioni: [
        { videogame_id: giochi[1].id, istante: '0:34:05', speaker: 'FOSS', tipologia: 'CONS' },
        { videogame_id: giochi[0].id, istante: '0:12:30', speaker: 'BORD', tipologia: 'RECE' },
      ],
    });
    await conCover(e.id);
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Ep. 777 · ${e.titolo}`);
    await expect(page.locator('[data-slot=badge]').first()).toHaveText(/Pubblicato/);
    await expect(page.getByLabel('Titolo')).toHaveValue(e.titolo);
    await expect(page.getByLabel('Numero')).toHaveValue('777');
    await expect(page.getByLabel('Durata')).toHaveValue('1:12:45');
    await expect(page.getByLabel('Data uscita')).toHaveValue('2001-11-12');
    await expect(page.getByRole('switch', { name: 'Pubblicato' })).toBeChecked();
    await expect(page.getByLabel('URL audio')).toHaveValue('https://example.com/a.mp3');
    await expect(page.getByLabel('URL post')).toHaveValue('https://example.com/p');
    await expect(page.getByLabel('URL video')).toHaveValue('');
    await expect(page.getByLabel('Descrizione (TXT)')).toHaveValue('Testo');
    await expect(page.getByLabel('Descrizione (HTML)')).toHaveValue('<p>Html</p>');
    await expect(page.getByLabel('Note libere')).toHaveValue('Nota');
    await expect(page.getByTestId('nome-cover')).toHaveText(/^episodi-777-.*\.png$/);
    await expect(page.getByText('Videogiochi citati · 2')).toBeVisible();
    // ordinate per istante
    await expect(page.getByRole('combobox', { name: 'Videogame, riga 1' })).toHaveValue(giochi[0].titolo);
    await expect(page.getByRole('textbox', { name: 'Istante, riga 1' })).toHaveValue('0:12:30');
    await expect(page.getByRole('combobox', { name: 'Speaker, riga 2' })).toHaveText(/Francesco Fossetti \(salta!\)/);
  });

  test('F-EP-07: salva i campi e torna all\'elenco; un errore del server va nel Toast', async ({ page }) => {
    const e = await nuovoEpisodio({ url: 'https://example.com/a.mp3' });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByLabel('Titolo').fill('');
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(toast(page)).toContainText('titolo');
    await expect(page).toHaveURL(new RegExp(`/episodi/${e.id}$`));
    await page.getByLabel('Titolo').fill(`${e.titolo} bis`);
    await page.getByLabel('Durata').fill('2:00:00');
    await page.getByLabel('URL audio').fill('');
    await page.getByRole('switch', { name: 'Pubblicato' }).click();
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    await expect(toast(page)).toHaveCount(0);
    const { body } = await leggi(e.id);
    expect(body).toMatchObject({ titolo: `${e.titolo} bis`, durata: '02:00:00', url: null, pubblicato: true });
  });

  test('F-EP-08: elimina dalla modifica, con ANNULLA che non cancella', async ({ page }) => {
    const e = await nuovoEpisodio({
      episodio_numero: '312',
      associazioni: [{ videogame_id: giochi[0].id }, { videogame_id: giochi[1].id }, { videogame_id: giochi[2].id }],
    });
    await conCover(e.id);
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByRole('button', { name: 'Elimina episodio' }).click();
    const dialogo = page.getByRole('alertdialog');
    await expect(dialogo).toContainText('Game over?');
    await expect(dialogo.getByRole('heading')).toHaveText("Eliminare l'episodio?");
    await expect(dialogo).toContainText(
      `Stai per eliminare «Ep. 312 · ${e.titolo}» e i suoi 3 collegamenti ai videogiochi citati. I videogiochi restano nel catalogo e il file della cover resta sul server.`,
    );
    await expect(dialogo).toContainText('Non si può annullare');
    await dialogo.getByRole('button', { name: 'Annulla' }).click();
    await expect(dialogo).toBeHidden();
    expect((await leggi(e.id)).status).toBe(200);
    await page.getByRole('button', { name: 'Elimina episodio' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    expect((await leggi(e.id)).status).toBe(404);
    for (const g of giochi) expect((await api.get(`/api/bo/videogame/${g.id}`)).status()).toBe(200);
  });

  test('F-EP-09, F-AS-03: aggiunge, modifica e toglie righe; etichette e non codici', async ({ page }) => {
    const e = await nuovoEpisodio({
      associazioni: [
        { videogame_id: giochi[0].id, istante: '0:01:00' },
        { videogame_id: giochi[1].id, istante: '0:02:00' },
      ],
    });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    // F-AS-03: le scelte hanno solo le etichette
    await page.getByRole('combobox', { name: 'Speaker, riga 1' }).click();
    await expect(page.getByRole('option')).toHaveText([
      'Tutti',
      'Matteo Bordone (corri!)',
      'Francesco Fossetti (salta!)',
      'Alessandro Zampini (spara!)',
    ]);
    await page.getByRole('option', { name: 'Alessandro Zampini (spara!)' }).click();
    await page.getByRole('combobox', { name: 'Tipologia, riga 1' }).click();
    await expect(page.getByRole('option')).toHaveText(['Chiacchiera libera', 'Recensione', 'Consiglio', 'Osservatorio Start Citizen']);
    await page.getByRole('option', { name: 'Osservatorio Start Citizen' }).click();
    await expect(page.locator('main')).not.toContainText(/\b(TUTT|BORD|FOSS|ZAMP|FREE|RECE|CONS|STAR)\b/);
    // riga nuova: default 0:00:00, Tutti, Chiacchiera libera; senza videogame non si salva
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await expect(page.getByText('Videogiochi citati · 3')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Istante, riga 3' })).toHaveValue('0:00:00');
    await expect(page.getByRole('combobox', { name: 'Speaker, riga 3' })).toHaveText(/Tutti/);
    await expect(page.getByRole('combobox', { name: 'Tipologia, riga 3' })).toHaveText(/Chiacchiera libera/);
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(toast(page)).toContainText('videogame');
    await scegliGioco(page, 3, giochi[2]);
    await page.getByRole('textbox', { name: 'Istante, riga 3' }).fill('');
    // toglie la seconda riga
    await page.getByRole('button', { name: `Rimuovi ${giochi[1].titolo}` }).click();
    await expect(page.getByText('Videogiochi citati · 2')).toBeVisible();
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    const { body } = await leggi(e.id);
    expect(body.associazioni.map((a) => [a.videogame_id, a.istante, a.speaker, a.tipologia])).toEqual([
      [giochi[0].id, '00:01:00', 'ZAMP', 'STAR'],
      [giochi[2].id, null, 'TUTT', 'FREE'],
    ]);
  });

  test('F-EP-09: nel Combobox INVIO prima dei risultati della ricerca non sceglie il gioco sbagliato', async ({ page }) => {
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: giochi[0].id, istante: '0:01:00' }] });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    const campo = page.getByRole('combobox', { name: 'Videogame, riga 1' });
    // una prima ricerca lascia a schermo i suoi risultati (keepPreviousData)
    await campo.click();
    await campo.fill(giochi[1].rawg_slug);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText(giochi[1].rawg_slug);
    // si scrive un'altra ricerca e si preme subito INVIO: nessuna voce è scelta
    await campo.fill(giochi[2].rawg_slug);
    await campo.press('Enter');
    await expect(campo).toHaveValue(giochi[2].rawg_slug);
    await expect(page).toHaveURL(new RegExp(`/new-bo/episodi/${e.id}$`));
    // arrivano i risultati giusti: la voce è evidenziata e INVIO la sceglie
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText(giochi[2].rawg_slug);
    await expect(page.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('status').filter({ hasText: 'Cerco' })).toHaveCount(0);
    await expect(campo).toHaveValue(giochi[2].rawg_slug);
    await campo.press('Enter');
    await expect(campo).toHaveValue(giochi[2].titolo);
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    const { body } = await leggi(e.id);
    expect(body.associazioni.map((a) => a.videogame_id)).toEqual([giochi[2].id]);
  });

  test('F-EP-10: SOSTITUISCI carica il PNG dopo il salvataggio; un file non PNG si rifiuta subito', async ({ page }) => {
    const e = await nuovoEpisodio({ episodio_numero: '555' });
    await conCover(e.id);
    const prima = (await leggi(e.id)).body.cover;
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByTestId('file-cover').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('x') });
    await expect(toast(page)).toContainText("Il file deve essere un'immagine PNG");
    await page.getByTestId('file-cover').setInputFiles({ name: 'nuova.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await expect(page.getByTestId('nome-cover')).toHaveText('nuova.png');
    expect((await leggi(e.id)).body.cover).toBe(prima);
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    const dopo = (await leggi(e.id)).body.cover;
    expect(dopo).not.toBe(prima);
    expect(dopo).toMatch(/^covers\/episodi-555-nuova.*\.png$/);
  });

  test('F-EP-11: RIMUOVI toglie la cover al salvataggio', async ({ page }) => {
    const e = await nuovoEpisodio();
    await conCover(e.id);
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByRole('button', { name: 'Rimuovi', exact: true }).click();
    await expect(page.getByTestId('nome-cover')).toHaveText('Nessuna cover');
    expect((await leggi(e.id)).body.cover).not.toBeNull();
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    expect((await leggi(e.id)).body.cover).toBeNull();
  });
});

test.describe('modifica a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('F-EP-07, F-EP-09: tabella delle associazioni e salvataggio', async ({ page }) => {
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: giochi[0].id, istante: '0:10:00' }] });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await expect(page.getByRole('columnheader', { name: /Istante/ })).toBeVisible();
    await page.getByLabel('Numero').fill('118');
    await page.getByRole('combobox', { name: 'Videogame, riga 1' }).click();
    await page.getByRole('combobox', { name: 'Videogame, riga 1' }).fill(giochi[1].rawg_slug);
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option')).toContainText(giochi[1].rawg_slug);
    await page.getByRole('combobox', { name: 'Videogame, riga 1' }).press('Enter');
    await expect(page.getByRole('combobox', { name: 'Videogame, riga 1' })).toHaveValue(giochi[1].titolo);
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    const { body } = await leggi(e.id);
    expect(body.episodio_numero).toBe('118');
    expect(body.associazioni.map((a) => a.videogame_id)).toEqual([giochi[1].id]);
  });
});

test.describe('modifica a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('F-EP-05, F-EP-07, F-EP-09: schede delle associazioni, barra fissa ed ELIMINA in fondo', async ({ page }) => {
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: giochi[0].id, istante: '0:05:00', speaker: 'BORD' }] });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.getByTestId('scheda-associazione')).toHaveCount(1);
    await expect(page.getByRole('combobox', { name: 'Speaker' })).toHaveText(/Matteo Bordone/);
    await expect(page.getByRole('button', { name: 'Elimina episodio' })).toBeVisible();
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await expect(page.getByTestId('scheda-associazione')).toHaveCount(2);
    await scegliGioco(page, 2, giochi[1]);
    await page.getByTestId('scheda-associazione').nth(1).getByLabel('Istante').fill('0:06:00');
    await page.getByLabel('Durata').fill('45:00');
    // la barra delle azioni resta visibile in fondo allo schermo
    await expect(page.getByRole('button', { name: 'Salva' })).toBeInViewport();
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    const { body } = await leggi(e.id);
    expect(body.durata).toBe('00:45:00');
    expect(body.associazioni.map((a) => [a.videogame_id, a.istante])).toEqual([
      [giochi[0].id, '00:05:00'],
      [giochi[1].id, '00:06:00'],
    ]);
  });
});

// --- Nuovo episodio (F-EP-06, F-EP-10 in creazione) -----------------------------------------

test.describe('nuovo episodio a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-EP-06: valori iniziali, CREA con associazione e cover, poi la modifica', async ({ page }) => {
    const titolo = `[E2E] new-bo nuovo ${uniq()}`;
    await entra(page);
    await page.getByRole('link', { name: '+ Nuovo episodio' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nuovo episodio');
    await expect(page.getByLabel('Durata')).toHaveValue('0:30:00');
    await expect(page.getByRole('switch', { name: 'Pubblicato' })).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Elimina episodio' })).toHaveCount(0);
    await expect(page.getByText('Videogiochi citati · 0')).toBeVisible();
    await page.getByLabel('Titolo').fill(titolo);
    await page.getByLabel('Numero').fill('E2E-N');
    await page.getByLabel('Data uscita').fill('2001-05-06');
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await scegliGioco(page, 1, giochi[0]);
    await page.getByTestId('file-cover').setInputFiles({ name: 'nuovo.png', mimeType: 'image/png', buffer: PNG_1x1 });
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Ep. E2E-N · ${titolo}`);
    const id = Number(page.url().split('/').pop());
    const { body } = await leggi(id);
    expect(body).toMatchObject({ titolo, durata: '00:30:00', data_uscita: '2001-05-06', pubblicato: false });
    expect(body.cover).toMatch(/^covers\/episodi-e2e-n-nuovo.*\.png$/i);
    expect(body.associazioni).toMatchObject([{ videogame_id: giochi[0].id, istante: '00:00:00', speaker: 'TUTT', tipologia: 'FREE' }]);
  });

  test('F-EP-10: se in creazione l\'upload fallisce, l\'episodio appena creato si cancella', async ({ page }) => {
    const titolo = `[E2E] new-bo upload ${uniq()}`;
    await entra(page);
    await page.goto('/new-bo/episodi/nuovo');
    await page.getByLabel('Titolo').fill(titolo);
    await page.getByLabel('Data uscita').fill('2001-05-06');
    // nome .png ma contenuto JPEG: passa il controllo del browser, il server lo rifiuta
    await page.getByTestId('file-cover').setInputFiles({ name: 'finto.png', mimeType: 'image/png', buffer: JPEG });
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(toast(page)).toContainText("Il file deve essere un'immagine PNG");
    await expect(page).toHaveURL(/\/new-bo\/episodi\/nuovo$/);
    const res = await api.get(`/api/bo/episodi?filter=${encodeURIComponent(JSON.stringify({ q: titolo }))}`);
    expect(await res.json()).toEqual([]);
  });
});

// --- Associazioni dal punto di vista dell'API, con la sessione del browser (F-AS-01, F-AS-02) --

test.describe('associazioni', () => {
  test.use({ viewport: VIEWPORT[1440] });

  async function salvaDueAssociazioni(page) {
    const e = await nuovoEpisodio({ episodio_numero: 'AS' });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await scegliGioco(page, 1, giochi[1]);
    await page.getByRole('textbox', { name: 'Istante, riga 1' }).fill('0:20:00');
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await scegliGioco(page, 2, giochi[0]);
    await page.getByRole('textbox', { name: 'Istante, riga 2' }).fill('0:10:00');
    await scegli(page, 'Tipologia, riga 2', 'Recensione');
    await page.getByRole('button', { name: 'Salva' }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    return e;
  }

  const gqlPagina = async (page, query, variables) => {
    const res = await page.request.post('/api/graphql', { data: { query, variables }, headers: ORIGIN });
    expect(res.status()).toBe(200);
    return res.json();
  };

  test('F-AS-01: le associazioni salvate dall\'interfaccia sono nell\'elenco filtrato per episodio', async ({ page }) => {
    const e = await salvaDueAssociazioni(page);
    const r = await gqlPagina(
      page,
      `query($e: Int) { elencoAssociazioni(episodio_id: $e) { totale elementi {
        episodio_id videogame_id istante speaker tipologia videogame_titolo episodio_titolo episodio_numero data_uscita } } }`,
      { e: e.id },
    );
    expect(r.errors).toBeUndefined();
    expect(r.data.elencoAssociazioni.totale).toBe(2);
    // default: data di uscita e poi istante
    expect(r.data.elencoAssociazioni.elementi).toMatchObject([
      { videogame_id: giochi[0].id, istante: '00:10:00', tipologia: 'RECE', videogame_titolo: giochi[0].titolo, episodio_titolo: e.titolo, episodio_numero: 'AS' },
      { videogame_id: giochi[1].id, istante: '00:20:00', tipologia: 'FREE', videogame_titolo: giochi[1].titolo },
    ]);
  });

  test('F-AS-02: un\'associazione salvata dall\'interfaccia si legge per id; un id inesistente è NOT_FOUND', async ({ page }) => {
    const e = await salvaDueAssociazioni(page);
    const { body } = await leggi(e.id);
    const id = body.associazioni[0].id;
    const r = await gqlPagina(page, 'query($id: Int!) { associazione(id: $id) { id episodio_id videogame_titolo istante speaker tipologia } }', { id });
    expect(r.data.associazione).toMatchObject({ id, episodio_id: e.id, videogame_titolo: giochi[0].titolo, istante: '00:10:00', speaker: 'TUTT', tipologia: 'RECE' });
    const nf = await gqlPagina(page, 'query { associazione(id: 2147483000) { id } }');
    expect(nf.errors[0].extensions.code).toBe('NOT_FOUND');
  });
});
