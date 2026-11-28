// Test e2e di /bo (Fase 3.6c). Girano con playwright.api.config.js: Dream locale
// con il bundle di frontend nel crunch, DB del compose di sviluppo.
//
//   bun run --cwd frontend build && opam exec -- dune build @install
//   npx playwright test -c playwright.api.config.js new-bo-e2e
//
// Prima metà di 3.6c: login (F-AU-01), logout (F-AU-02), utente corrente nella shell
// (F-AU-03), menu secondo i permessi (F-AU-04), shell nei tre formati 390/1180/1440.
const { test, expect } = require('@playwright/test');
const { API_URL, USERS } = require('./env');

// Il browser deve mandare la sua Origin vera, non quella forzata dalla config per l'API.
test.use({ extraHTTPHeaders: {} });

// query me con la sessione del browser (page.request); l'Origin va messa a mano
async function meDellaPagina(page) {
  const res = await page.request.post('/api/graphql', {
    data: { query: '{ me { username } }' },
    headers: { Origin: API_URL },
  });
  return res.json();
}

const VIEWPORT = {
  390: { width: 390, height: 844 },
  1180: { width: 1180, height: 820 },
  1440: { width: 1440, height: 900 },
};

async function entra(page, user) {
  await page.goto('/bo/login');
  await page.getByLabel('Nome utente').fill(user.username);
  await page.getByLabel("Parola d'ordine").fill(user.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
  await expect(page.getByRole('heading', { name: 'Episodi' })).toBeVisible();
}

test.describe('login', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('senza sessione ogni pagina porta al login, con il titolo della Retrobottega', async ({ page }) => {
    await page.goto('/bo/episodi');
    await expect(page).toHaveURL(/\/bo\/login$/);
    await expect(page).toHaveTitle('Retrobottega di «È uscito Joypad?»');
    await expect(page.getByRole('heading', { name: 'RETROBOTTEGA' })).toBeVisible();
    await expect(page.getByText('Un JOYPAD selvatico appare!')).toBeVisible();
    await expect(page.getByText('Premi INVIO per continuare')).toBeVisible();
    await page.goto('/bo');
    await expect(page).toHaveURL(/\/bo\/login$/);
  });

  test('credenziali sbagliate: messaggio del server nell\'Alert e un cuore in meno', async ({ page }) => {
    await page.goto('/bo/login');
    await page.getByLabel('Nome utente').fill(USERS.staff.username);
    await page.getByLabel("Parola d'ordine").fill('password-sbagliata');
    await page.getByRole('button', { name: 'Entra' }).click();
    await expect(page.getByRole('alert')).toHaveText(/Credenziali non valide o utente non abilitato/);
    await expect(page.getByText('Ouch! Il JOYPAD ha resistito.')).toBeVisible();
    await expect(page.getByText('2 su 3')).toBeAttached();
    await expect(page).toHaveURL(/\/bo\/login$/);
  });

  test('un utente non staff o non attivo non entra, con lo stesso messaggio', async ({ page }) => {
    for (const user of [USERS.nonstaff, USERS.inactive]) {
      await page.goto('/bo/login');
      await page.getByLabel('Nome utente').fill(user.username);
      await page.getByLabel("Parola d'ordine").fill(user.password);
      await page.keyboard.press('Enter');
      await expect(page.getByRole('alert')).toHaveText(/Credenziali non valide o utente non abilitato/);
    }
  });

  test('la richiesta GraphQL ha Content-Type application/json esatto', async ({ page }) => {
    await page.goto('/bo/login');
    const richiesta = page.waitForRequest((r) => r.url().endsWith('/api/graphql') && r.method() === 'POST');
    await page.getByLabel('Nome utente').fill(USERS.staff.username);
    await page.getByLabel("Parola d'ordine").fill(USERS.staff.password);
    await page.getByRole('button', { name: 'Entra' }).click();
    const r = await richiesta;
    expect(r.headers()['content-type']).toBe('application/json');
  });

  test('la sessione è quella della query me, e con la sessione il login porta agli episodi', async ({ page }) => {
    await entra(page, USERS.staff);
    const me = await meDellaPagina(page);
    expect(me.errors).toBeUndefined();
    expect(me.data.me.username).toBe(USERS.staff.username);
    await page.goto('/bo/login');
    await expect(page).toHaveURL(/\/bo\/episodi$/);
  });
});

test.describe('shell a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('staff: Sidebar espansa senza UTENTI, nome utente ed ESCI nella barra', async ({ page }) => {
    await entra(page, USERS.staff);
    const menu = page.getByRole('navigation', { name: 'Menu' });
    await expect(menu.getByText('Seleziona livello')).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Episodi' })).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByRole('link', { name: 'Utenti' })).toHaveCount(0);
    await expect(page.getByTestId('nome-utente')).toHaveText(USERS.staff.username);
    await expect(page.getByRole('button', { name: 'Apri il menu' })).toBeHidden();

    await menu.getByRole('link', { name: 'Videogame' }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
    await expect(page.getByRole('heading', { name: 'Videogame' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Videogame' })).toHaveAttribute('aria-current', 'page');

    // l'indirizzo degli utenti, scritto a mano, riporta agli episodi
    await page.goto('/bo/utenti');
    await expect(page).toHaveURL(/\/bo\/episodi$/);
  });

  test('ESCI chiude la sessione, anche per la query me', async ({ page }) => {
    await entra(page, USERS.staff);
    await page.getByRole('button', { name: 'Esci' }).click();
    await expect(page).toHaveURL(/\/bo\/login$/);
    expect((await meDellaPagina(page)).errors[0].extensions.code).toBe('UNAUTHENTICATED');
    await page.goto('/bo/videogame');
    await expect(page).toHaveURL(/\/bo\/login$/);
  });
});

test.describe('shell a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('superuser: Sidebar a rotaia con UTENTI', async ({ page }) => {
    await entra(page, USERS.superuser);
    const menu = page.getByRole('navigation', { name: 'Menu' });
    await expect(menu).toBeVisible();
    expect((await menu.boundingBox()).width).toBe(88);
    await expect(menu.getByText('Seleziona livello')).toBeHidden();
    await menu.getByRole('link', { name: 'Utenti' }).click();
    await expect(page).toHaveURL(/\/bo\/utenti$/);
    await expect(page.getByRole('heading', { name: 'Utenti' })).toBeVisible();
    await expect(page.getByText('Livello segreto · solo superuser')).toBeVisible();
  });
});

test.describe('shell a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('il login dice di toccare ENTRA', async ({ page }) => {
    await page.goto('/bo/login');
    await expect(page.getByText('Tocca ENTRA per continuare')).toBeVisible();
    await expect(page.getByText('Premi INVIO per continuare')).toBeHidden();
  });

  test('superuser: Barra app mobile e Sheet con utente, voci ed ESCI', async ({ page }) => {
    await entra(page, USERS.superuser);
    await expect(page.getByRole('navigation', { name: 'Menu' })).toBeHidden();
    await expect(page.getByTestId('nome-utente')).toBeHidden();

    await page.getByRole('button', { name: 'Apri il menu' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(USERS.superuser.username)).toBeVisible();
    await expect(sheet.getByText('superuser', { exact: false })).toBeVisible();
    await expect(sheet.getByRole('link', { name: 'Utenti' })).toBeVisible();

    await sheet.getByRole('link', { name: 'Videogame' }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/\/bo\/videogame$/);

    await page.getByRole('button', { name: 'Apri il menu' }).click();
    await page.getByRole('button', { name: 'Chiudi il menu' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await page.getByRole('button', { name: 'Apri il menu' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Esci' }).click();
    await expect(page).toHaveURL(/\/bo\/login$/);
  });

  test('staff: nello Sheet non c\'è UTENTI né «superuser»', async ({ page }) => {
    await entra(page, USERS.staff);
    await page.getByRole('button', { name: 'Apri il menu' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByRole('link', { name: 'Episodi' })).toHaveAttribute('aria-current', 'page');
    await expect(sheet.getByRole('link', { name: 'Utenti' })).toHaveCount(0);
    await expect(sheet.getByText('superuser')).toHaveCount(0);
  });
});
