// Test di accettazione del nuovo admin react-admin su /bo (Fase 3 della
// rimozione di Django). Gira con playwright.api.config.js: Dream locale con la
// build del frontend, finto RAWG, DB del compose di sviluppo.
//
//   cd frontend && yarn build && cd .. && opam exec -- dune build @install
//   npx playwright test -c playwright.api.config.js
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { ROOT, MEDIA_ROOT, USERS } = require('./api/env');
const { listQuery, loggedIn, uniq, PNG_1x1, JPEG } = require('./api/helpers');

// Il browser deve mandare la sua Origin vera, non quella forzata dalla config
// per i test dell'API.
test.use({ extraHTTPHeaders: {} });
test.describe.configure({ mode: 'serial' });

async function login(page, user) {
  await page.goto('/bo');
  await expect(page).toHaveURL(/\/bo#\/login/);
  await page.locator('input[name=username]').fill(user.username);
  await page.locator('input[name=password]').fill(user.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByRole('menuitem', { name: 'Episodi' })).toBeVisible();
}

async function logout(page) {
  await page.getByRole('button', { name: 'Profilo' }).click();
  await page.getByRole('menuitem', { name: 'Esci' }).click();
  await expect(page).toHaveURL(/#\/login/);
}

// Voce del menu laterale, attendendo che la lista sia davvero aperta.
async function openMenu(page, name, resource) {
  await page.getByRole('menuitem', { name }).click();
  await expect(page).toHaveURL(new RegExp(`#/${resource}$`));
}

async function openCreate(page, resource) {
  await page.getByRole('link', { name: 'Crea' }).click();
  await expect(page).toHaveURL(new RegExp(`#/${resource}/create$`));
}

const field = (page, name) => page.locator(`input[name="${name}"]`);

// Sceglie un videogame nell'AutocompleteInput n-esimo delle associazioni.
async function pickGame(page, index, titolo) {
  const input = page.getByLabel('Videogame').nth(index);
  await input.fill(titolo);
  await page.getByRole('option', { name: titolo }).click();
  await expect(input).toHaveValue(titolo);
}

test('titolo, login e menu di uno staff non superuser', async ({ page }) => {
  await page.goto('/bo');
  await expect(page).toHaveTitle('Retrobottega di «È uscito Joypad?»');
  // credenziali sbagliate: messaggio del server, in italiano
  await page.locator('input[name=username]').fill(USERS.staff.username);
  await page.locator('input[name=password]').fill('password-sbagliata');
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Credenziali non valide o utente non abilitato')).toBeVisible();

  await login(page, USERS.staff);
  await expect(page.getByRole('menuitem', { name: 'Videogame' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Utenti' })).toHaveCount(0);
  await logout(page);
});

test('il superuser vede e apre Utenti', async ({ page }) => {
  await login(page, USERS.superuser);
  await openMenu(page, 'Utenti', 'utenti');
  await page.getByPlaceholder('Cerca', { exact: true }).fill(USERS.staff.username);
  await expect(page.getByRole('cell', { name: USERS.staff.username, exact: true })).toBeVisible();
});

test('crea un videogame da RAWG, un episodio con 2 associazioni e cover, lo pubblica', async ({ page, playwright }) => {
  const id = uniq();
  const slugA = `e2e-adm-a-${id}`;
  const slugB = `e2e-adm-b-${id}`;
  const titleA = `E2E Game ${slugA}`;
  const titleB = `E2E Game ${slugB}`;
  const titolo = `[E2E] Admin ${id}`;

  const api = await loggedIn(playwright, USERS.staff);
  // il secondo gioco via API, il primo dalla UI
  expect((await api.post('/api/bo/videogame', { data: { rawg_slug: slugB } })).status()).toBe(201);

  await login(page, USERS.staff);

  // --- Videogame: basta lo slug, il resto arriva da RAWG (finto)
  await openMenu(page, 'Videogame', 'videogame');
  await openCreate(page, 'videogame');
  await field(page, 'rawg_slug').fill(slugA);
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page).toHaveURL(/#\/videogame\/\d+$/);
  await expect(field(page, 'titolo')).toHaveValue(titleA);
  await expect(page.getByTestId('rawg-json')).toContainText(`"slug": "${slugA}"`);

  // --- Episodio con 2 associazioni e cover PNG
  await openMenu(page, 'Episodi', 'episodi');
  await openCreate(page, 'episodi');
  await field(page, 'titolo').fill(titolo);
  await field(page, 'episodio_numero').fill(`E2E-${id}`.slice(0, 32));
  await field(page, 'data_uscita').fill('2099-12-31');
  await field(page, 'durata').fill('1:02:03');
  await page.locator('input[type=file]').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: PNG_1x1 });

  const add = page.getByRole('button', { name: 'Aggiungi' });
  await add.click();
  await pickGame(page, 0, titleA);
  await field(page, 'associazioni.0.istante').fill('0:10:00');
  await add.click();
  await pickGame(page, 1, titleB);
  await field(page, 'associazioni.1.istante').fill('0:42:00');
  await page.getByLabel('Speaker').nth(1).click();
  await page.getByRole('option', { name: 'Francesco Fossetti (salta!)' }).click();
  await page.getByLabel('Tipologia').nth(1).click();
  await page.getByRole('option', { name: 'Recensione' }).click();

  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page).toHaveURL(/#\/episodi\/\d+$/);
  const episodioId = page.url().match(/episodi\/(\d+)$/)[1];

  // salvato davvero: 2 associazioni, cover nel MEDIA_ROOT
  const saved = await (await api.get(`/api/bo/episodi/${episodioId}`)).json();
  expect(saved.titolo).toBe(titolo);
  expect(saved.durata).toBe('01:02:03');
  expect(saved.pubblicato).toBe(false);
  expect(saved.associazioni.map((a) => [a.videogame_titolo, a.istante, a.speaker, a.tipologia])).toEqual([
    [titleA, '00:10:00', 'TUTT', 'FREE'],
    [titleB, '00:42:00', 'FOSS', 'RECE'],
  ]);
  expect(saved.cover).toMatch(/^covers\/episodi-.+\.png$/);
  expect(fs.readFileSync(path.join(MEDIA_ROOT, saved.cover))).toEqual(PNG_1x1);
  await expect(page.locator(`img[src="${saved.cover_url}"]`)).toBeVisible();

  // --- Ricerca in lista per titolo
  await openMenu(page, 'Episodi', 'episodi');
  await page.getByPlaceholder('Cerca per numero o titolo').fill(titolo);
  const row = page.getByRole('row').filter({ hasText: titolo });
  await expect(row).toHaveCount(1);
  await expect(page.getByRole('row')).toHaveCount(2); // intestazione + risultato

  // --- Pubblicazione
  const notYet = await (await api.get('/api/last-episodes/5/0')).text();
  expect(notYet).not.toContain(titolo);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`#/episodi/${episodioId}$`));
  await expect(field(page, 'titolo')).toHaveValue(titolo);
  await page.getByLabel('Pubblicato').check();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Elemento aggiornato')).toBeVisible();
  await expect(page).toHaveURL(/#\/episodi(\?.*)?$/);

  const published = await (await api.get(`/api/bo/episodi/${episodioId}`)).json();
  expect(published.pubblicato).toBe(true);
  expect(published.associazioni).toHaveLength(2);
  // le righe esistenti vengono aggiornate, non ricreate
  expect(published.associazioni.map((a) => a.id)).toEqual(saved.associazioni.map((a) => a.id));
  expect(published.cover).toBe(saved.cover);
  const last = await (await api.get('/api/last-episodes/5/0')).text();
  expect(last).toContain(titolo);

  // --- Il videogame mostra in sola lettura gli episodi che lo citano
  const [vg] = await (
    await api.get(`/api/bo/videogame${listQuery({ filter: { q: slugA }, range: [0, 0] })}`)
  ).json();
  await page.goto(`/bo#/videogame/${vg.id}`);
  await expect(page.getByRole('cell', { name: titolo })).toBeVisible();

  // --- Rimozione della cover (DELETE /cover), poi cancellazione dell'episodio
  await page.goto(`/bo#/episodi/${episodioId}`);
  await expect(field(page, 'titolo')).toHaveValue(titolo);
  await page.locator('.RaFileInputPreview-removeButton').click();
  // la notifica del salvataggio precedente può essere ancora a schermo:
  // si attende la DELETE della cover
  const coverDeleted = page.waitForResponse(
    (r) => r.url().endsWith(`/api/bo/episodi/${episodioId}/cover`) && r.request().method() === 'DELETE',
  );
  await page.getByRole('button', { name: 'Salva' }).click();
  expect((await coverDeleted).status()).toBe(200);
  await expect(page).toHaveURL(/#\/episodi$/); // redirect alla lista dopo il salvataggio
  await expect(page.locator(`img[src="${saved.cover_url}"]`)).toHaveCount(0);
  const noCover = await (await api.get(`/api/bo/episodi/${episodioId}`)).json();
  expect(noCover.cover).toBeNull();
  expect(noCover.associazioni).toHaveLength(2);

  // dopo «Salva» react-admin torna alla lista (che conserva la ricerca): si
  // riapre l'episodio dalla sua riga
  await page.getByRole('row').filter({ hasText: titolo }).click();
  await expect(page).toHaveURL(new RegExp(`#/episodi/${episodioId}$`));
  await expect(field(page, 'titolo')).toHaveValue(titolo);
  await page.getByRole('button', { name: 'Elimina' }).click();
  await page.getByRole('button', { name: 'Conferma' }).click();
  await expect(page).toHaveURL(/#\/episodi$/);
  expect((await api.get(`/api/bo/episodi/${episodioId}`)).status()).toBe(404);
  expect(await (await api.get('/api/last-episodes/5/0')).text()).not.toContain(titolo);

  await api.dispose();
});

test('il superuser crea e modifica un utente dalla UI', async ({ page, playwright }) => {
  const user = { username: `e2e_ui_${uniq()}`.slice(0, 30), password: 'e2e-password-ui' };
  await login(page, USERS.superuser);
  await openMenu(page, 'Utenti', 'utenti');
  await openCreate(page, 'utenti');
  await field(page, 'username').fill(user.username);
  await field(page, 'password').fill('corta');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Almeno 8 caratteri').first()).toBeVisible();
  await field(page, 'password').fill(user.password);
  await field(page, 'last_name').fill('Prova');
  await page.getByRole('button', { name: 'Salva' }).click();
  // dopo la creazione react-admin apre la modifica del nuovo utente
  await expect(page).toHaveURL(/#\/utenti\/\d+$/);

  // la password non viene mai mostrata; salvare senza toccarla la lascia invariata
  await expect(field(page, 'username')).toHaveValue(user.username);
  await expect(field(page, 'password')).toHaveValue('');
  await field(page, 'first_name').fill('Utente');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page).toHaveURL(/#\/utenti$/);
  await page.getByPlaceholder('Cerca', { exact: true }).fill(user.username);
  await expect(page.getByRole('row').filter({ hasText: user.username })).toContainText('Utente');

  const ctx = await loggedIn(playwright, user);
  const me = await (await ctx.get('/api/bo/me')).json();
  expect(me.fullName).toBe('Utente Prova');
  await ctx.dispose();
});

test('authProvider: 403 lascia la sessione, 401 riporta al login, 429 al login mostra il messaggio', async ({
  page,
}) => {
  await login(page, USERS.staff);
  await page.route('**/api/bo/videogame?*', (route) =>
    route.fulfill({ status: 403, contentType: 'application/json', body: '{"message":"Vietato per prova"}' }),
  );
  await openMenu(page, 'Videogame', 'videogame');
  await expect(page.getByText('Vietato per prova')).toBeVisible();
  await page.unroute('**/api/bo/videogame?*');
  // ancora loggato: la lista episodi si carica davvero (attenderla evita che
  // il clic successivo arrivi prima che la lista dei videogame sia smontata,
  // nel qual caso react-query non rifarebbe la richiesta)
  const episodi = page.waitForResponse((r) => r.url().includes('/api/bo/episodi?') && r.status() === 200);
  await openMenu(page, 'Episodi', 'episodi');
  await episodi;

  await page.route('**/api/bo/videogame?*', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"message":"Sessione scaduta"}' }),
  );
  await page.getByRole('menuitem', { name: 'Videogame' }).click();
  await expect(page).toHaveURL(/#\/login/);
  await page.unroute('**/api/bo/videogame?*');

  await page.route('**/api/bo/login', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: '{"message":"Troppe richieste di login, riprova tra poco"}',
    }),
  );
  await page.locator('input[name=username]').fill(USERS.staff.username);
  await page.locator('input[name=password]').fill(USERS.staff.password);
  await page.getByRole('button', { name: 'Accedi' }).click();
  await expect(page.getByText('Troppe richieste di login, riprova tra poco')).toBeVisible();
});

test('un errore del server compare come notifica', async ({ page }) => {
  await login(page, USERS.staff);
  await openMenu(page, 'Videogame', 'videogame');
  await openCreate(page, 'videogame');
  const slug = `e2e-missing-${uniq()}`;
  await field(page, 'rawg_slug').fill(slug);
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText(`Gioco «${slug}» non trovato su RAWG`)).toBeVisible();
  await expect(page).toHaveURL(/#\/videogame\/create$/);
});

test('se la cover viene rifiutata il create dell\'episodio è annullato', async ({ page, playwright }) => {
  const titolo = `[E2E] Cover rifiutata ${uniq()}`;
  await login(page, USERS.staff);
  await openMenu(page, 'Episodi', 'episodi');
  await openCreate(page, 'episodi');
  await field(page, 'titolo').fill(titolo);
  await field(page, 'data_uscita').fill('2001-01-01');
  // un JPEG chiamato .png passa la dropzone ma non il controllo del server
  await page.locator('input[type=file]').setInputFiles({ name: 'falso.png', mimeType: 'image/png', buffer: JPEG });
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText("Il file deve essere un'immagine PNG")).toBeVisible();
  await expect(page).toHaveURL(/#\/episodi\/create$/);

  const api = await loggedIn(playwright, USERS.staff);
  await expect
    .poll(async () => (await (await api.get(`/api/bo/episodi${listQuery({ filter: { q: titolo } })}`)).json()).length)
    .toBe(0);
  await api.dispose();
});

test("l'Edit non parte dal record parziale della lista", async ({ page, playwright }) => {
  const id = uniq();
  const titolo = `[E2E] Dettaglio ${id}`;
  const api = await loggedIn(playwright, USERS.staff);
  const vg = await (await api.post('/api/bo/videogame', { data: { rawg_slug: `e2e-det-${id}` } })).json();
  const ep = await (
    await api.post('/api/bo/episodi', {
      data: { titolo, data_uscita: '2001-01-01', durata: '0:30:00', associazioni: [{ videogame_id: vg.id }] },
    })
  ).json();

  await login(page, USERS.staff);
  // il dettaglio arriva in ritardo: nel frattempo il form non deve comparire
  // con i dati della lista (senza associazioni), altrimenti un Salva le perderebbe
  await page.route(`**/api/bo/episodi/${ep.id}`, async (route) => {
    await new Promise((r) => setTimeout(r, 2000));
    await route.continue();
  });
  await page.getByPlaceholder('Cerca per numero o titolo').fill(titolo);
  await page.getByRole('row').filter({ hasText: titolo }).click();
  await expect(page).toHaveURL(new RegExp(`#/episodi/${ep.id}$`));
  await page.waitForTimeout(1000);
  await expect(field(page, 'titolo')).toHaveCount(0);
  await expect(field(page, 'titolo')).toHaveValue(titolo);
  await expect(page.getByLabel('Videogame')).toHaveValue(vg.titolo);
  await api.dispose();
});

test('/bo non può essere incorniciato da altri siti', async ({ request }) => {
  const res = await request.get('/bo');
  expect(res.headers()['x-frame-options']).toBe('DENY');
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});

// Il sito pubblico non deve caricare codice dell'admin: si seguono script,
// modulepreload e import dei chunk raggiungibili da build/index.html.
test('il bundle pubblico non contiene react-admin né MUI', () => {
  const build = path.join(ROOT, 'frontend', 'build');
  // riferimenti "assets/x.js" (html, __vite__mapDeps) e import relativi "./x.js" tra chunk
  const refs = (text) => [
    ...[...text.matchAll(/assets\/[\w.-]+\.js/g)].map((m) => m[0]),
    ...[...text.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g)].map((m) => `assets/${m[1]}`),
  ];
  const reach = (start) => {
    const seen = new Set();
    const todo = refs(fs.readFileSync(path.join(build, start), 'utf8'));
    while (todo.length) {
      const f = todo.pop();
      if (seen.has(f)) continue;
      seen.add(f);
      todo.push(...refs(fs.readFileSync(path.join(build, f), 'utf8')));
    }
    return [...seen];
  };
  // marcatori che sopravvivono alla minificazione: classi MUI e react-admin
  const markers = /MuiButtonBase|RaLayout|react-admin|@mui\//;
  const hasAdmin = (f) => markers.test(fs.readFileSync(path.join(build, f), 'utf8'));

  const pub = reach('index.html');
  expect(pub.length).toBeGreaterThan(0);
  expect(pub.filter(hasAdmin)).toEqual([]);
  // controllo positivo: i marcatori ci sono nei chunk dell'admin
  expect(reach('bo/index.html').some(hasAdmin)).toBe(true);
});
