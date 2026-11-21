// Test e2e degli utenti di /bo (Fase 3.6c.3b): F-UT-01 … F-UT-06, le regole su sé stessi
// (niente casella sulla propria riga, ELIMINA disattivato nel proprio account), SALVA E CONTINUA
// e la rivalidazione della sessione (F-AU-05). Girano con playwright.api.config.js, come le altre
// spec new-bo-e2e*. Gli utenti si creano via GraphQL dal superuser di test con lo username
// «e2e_…» (il teardown li cancella) e un token unico per test.
const { randomInt } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { USERS } = require('./env');
const { loggedIn } = require('./helpers');
const { creaUtente, aggiornaUtente, leggiUtente, puoEntrare, me } = require('./gql-helpers');

// Il browser manda la sua Origin vera (V-01).
test.use({ extraHTTPHeaders: {} });

const VIEWPORT = {
  390: { width: 390, height: 844 },
  1180: { width: 1180, height: 820 },
  1440: { width: 1440, height: 900 },
};

let su; // sessione del superuser di test (GraphQL)
let io; // il superuser di test, cioè «me» nel browser

test.beforeAll(async ({ playwright }) => {
  su = await loggedIn(playwright, USERS.superuser);
  io = await me(su);
});

test.afterAll(async () => {
  await su.dispose();
});

// --- aiuti ------------------------------------------------------------------------------------

const token = () => `nbu${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;
const PASSWORD = 'e2e-password-utente';

async function entra(page, user = USERS.superuser) {
  await page.goto('/bo/login');
  await page.getByLabel('Nome utente').fill(user.username);
  await page.getByLabel("Parola d'ordine").fill(user.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
}

// Un utente creato via GraphQL; di default staff e attivo, password PASSWORD.
const nuovoUtente = (username, extra = {}) =>
  creaUtente(su, { username, password: PASSWORD, is_staff: true, is_active: true, is_superuser: false, ...extra });

// { status: 200, body } se l'utente c'è, { status: 404, body: null } se non c'è.
async function leggi(id) {
  const u = await leggiUtente(su, id);
  return u ? { status: 200, body: u } : { status: 404, body: null };
}

const elenco = (page, t) => page.goto(`/bo/utenti?ricerca=${encodeURIComponent(t)}`);
const righe = (page) => page.locator('tbody tr[data-cliccabile]');
const schede = (page) => page.locator('main section[data-slot=card]');
// il Toast visibile: quello sostituito resta nel DOM durante l'uscita, con data-removed
const toast = (page) => page.locator('[data-sonner-toast]:not([data-removed=true]) [data-slot=toast]');
const barra = (page) => page.getByTestId('barra-azioni');
const salvaEContinua = (page) => page.getByRole('button', { name: 'Salva e continua' });
const aggiornato = (page) =>
  page.waitForResponse((r) => r.url().endsWith('/api/graphql') && (r.request().postData() ?? '').includes('AggiornaUtente'));
const dialogo = (page) => page.getByRole('alertdialog');

// Fotografie per il gate, in test-results/…: su desktop la pagina intera dall'alto; a 390 lo
// schermo in cima e in fondo (la barra delle azioni è fissa); con un dialogo aperto, lo schermo.
async function foto(page, nome) {
  const percorso = (n) => test.info().outputPath(`${n}.png`);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  if ((await dialogo(page).count()) > 0) return page.screenshot({ path: percorso(nome) });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (page.viewportSize().width > 390) return page.screenshot({ path: percorso(nome), fullPage: true });
  await page.screenshot({ path: percorso(`${nome}-alto`) });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: percorso(`${nome}-basso`) });
}

// --- Elenco (F-UT-01, F-UT-02, F-UT-06 in blocco) -------------------------------------------

test.describe('elenco a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-UT-01: colonne, «—» e «mai», 10 righe di default; clic sulla riga → modifica', async ({ page }) => {
    const t = token();
    const a = await nuovoUtente(`e2e_${t}_a`, { first_name: 'Giulia', last_name: 'Bianchi', email: `${t}@example.org` });
    const b = await nuovoUtente(`e2e_${t}_b`, { is_staff: false, is_superuser: true });
    await entra(page);
    await elenco(page, t);
    await expect(righe(page)).toHaveCount(2);
    await expect(page.getByRole('combobox', { name: 'Righe per pagina' })).toHaveText(/10/);
    await expect(page.getByRole('columnheader')).toHaveText([
      '',
      'Username',
      'Nome',
      'Cognome',
      'Email',
      'Staff',
      'Attivo',
      'Superuser',
      'Ultimo accesso',
    ]);
    await expect(righe(page).nth(0).locator('td')).toHaveText([
      '',
      a.username,
      'Giulia',
      'Bianchi',
      `${t}@example.org`,
      'Staff',
      'Attivo',
      '·non superuser', // «·» visibile, «non superuser» per i lettori di schermo
      'mai',
    ]);
    await expect(righe(page).nth(1).locator('td')).toHaveText(['', b.username, '—', '—', '—', '·non staff', 'Attivo', 'Superuser', 'mai']);
    await righe(page).nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/bo/utenti/${b.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(b.username);
  });

  test('F-UT-01: default username crescente, tutte le colonne si ordinano nei due versi', async ({ page }) => {
    const t = token();
    await nuovoUtente(`e2e_${t}_a`, { email: `z${t}@example.org`, first_name: 'Zeno', is_superuser: true });
    await nuovoUtente(`e2e_${t}_b`, { email: `a${t}@example.org`, first_name: 'Anna' });
    await entra(page);
    await elenco(page, t);
    const nomi = () => righe(page).locator('td:nth-child(2)');
    await expect(nomi()).toHaveText([`e2e_${t}_a`, `e2e_${t}_b`]);
    await expect(page.getByRole('columnheader', { name: /Username/ })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Username' }).click();
    await expect(nomi()).toHaveText([`e2e_${t}_b`, `e2e_${t}_a`]);
    await page.getByRole('button', { name: 'Email' }).click();
    await expect(nomi()).toHaveText([`e2e_${t}_b`, `e2e_${t}_a`]);
    await page.getByRole('button', { name: 'Nome', exact: true }).click();
    await expect(nomi()).toHaveText([`e2e_${t}_b`, `e2e_${t}_a`]);
    await page.getByRole('button', { name: 'Nome', exact: true }).click();
    await expect(nomi()).toHaveText([`e2e_${t}_a`, `e2e_${t}_b`]);
    await page.getByRole('button', { name: 'Superuser' }).click();
    await expect(nomi()).toHaveText([`e2e_${t}_b`, `e2e_${t}_a`]); // prima i no
    for (const c of ['Cognome', 'Staff', 'Attivo', 'Ultimo accesso']) {
      await page.getByRole('button', { name: c }).click();
      await expect(page.getByRole('columnheader', { name: new RegExp(c) })).toHaveAttribute('aria-sort', 'ascending');
    }
    await expect(page).toHaveURL(/ordina=accesso/);
  });

  test('F-UT-02: la ricerca è «contiene», senza maiuscole, su username, email, nome e cognome', async ({ page }) => {
    const t = token();
    const a = await nuovoUtente(`e2e_${t}_a`, { email: `posta-${t}@example.org` });
    const b = await nuovoUtente(`e2e_${t}_b`, { first_name: `Nome${t}`, last_name: `Cognome${t}` });
    await entra(page);
    await page.goto('/bo/utenti');
    const cerca = page.getByRole('searchbox', { name: 'Cerca per username, email, nome o cognome' });
    await cerca.fill(`POSTA-${t}`.toUpperCase());
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(a.username);
    await cerca.fill(`nome${t}`);
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(b.username);
    await cerca.fill(`cognome${t}`);
    await expect(righe(page)).toHaveCount(1);
    await cerca.fill(`${t}_`);
    await expect(righe(page)).toHaveCount(2);
    await expect(page).toHaveURL(new RegExp(`ricerca=${t}_`));
  });

  test('F-UT-06: la propria riga non ha la casella; «seleziona tutti» la salta', async ({ page }) => {
    await entra(page);
    await elenco(page, USERS.superuser.username);
    await expect(righe(page)).toHaveCount(1);
    const mia = righe(page).filter({ hasText: USERS.superuser.username });
    await expect(mia).toHaveCount(1);
    await expect(mia.getByRole('checkbox')).toHaveCount(0);
    await expect(mia.getByTestId('senza-casella')).toHaveCount(1);
    // con la sola propria riga «seleziona tutti» è disattivato
    await expect(page.getByRole('checkbox', { name: 'Seleziona tutti' })).toBeDisabled();
  });

  test('F-UT-06: eliminazione in blocco con conferma; la propria riga resta fuori', async ({ page }) => {
    const t = token();
    const a = await nuovoUtente(`e2e_${t}_a`);
    const b = await nuovoUtente(`e2e_${t}_b`);
    await entra(page);
    await elenco(page, t);
    await page.getByRole('checkbox', { name: 'Seleziona tutti' }).click();
    await expect(page.getByText('2 utenti selezionati')).toBeVisible();
    await page.getByRole('button', { name: 'Elimina selezionati' }).click();
    await expect(dialogo(page)).toContainText('Eliminare 2 utenti?');
    await expect(dialogo(page)).toContainText(
      'Stai per eliminare 2 utenti e tutti i loro collegamenti a registro, gruppi e permessi. Episodi e videogame restano come sono.',
    );
    await foto(page, 'elenco-utenti-conferma-blocco-1440');
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(righe(page)).toHaveCount(0);
    expect((await leggi(a.id)).status).toBe(404);
    expect((await leggi(b.id)).status).toBe(404);
    expect((await leggi(io.id)).status).toBe(200);
  });

  test('F-UT-06: se il server rifiuta una riga in blocco, il Toast mostra il messaggio e le altre si cancellano', async ({ page }) => {
    // rete di sicurezza: la propria riga non è selezionabile, quindi il 400 si simula sulla
    // mutation di un'altra riga
    const t = token();
    const a = await nuovoUtente(`e2e_${t}_a`);
    const b = await nuovoUtente(`e2e_${t}_b`);
    await entra(page);
    await page.route('**/api/graphql', async (route) => {
      const corpo = JSON.parse(route.request().postData() ?? '{}');
      if ((corpo.query ?? '').includes('EliminaUtente') && corpo.variables?.id === b.id)
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ data: null, errors: [{ message: 'Non puoi cancellare te stesso', extensions: { code: 'BAD_USER_INPUT' } }] }),
        });
      return route.fallback();
    });
    await elenco(page, t);
    await page.getByRole('checkbox', { name: 'Seleziona tutti' }).click();
    await page.getByRole('button', { name: 'Elimina selezionati' }).click();
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(toast(page)).toContainText('Non puoi cancellare te stesso');
    await expect(righe(page)).toHaveCount(1);
    expect((await leggi(a.id)).status).toBe(404);
    expect((await leggi(b.id)).status).toBe(200);
  });
});

test.describe('elenco a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('F-UT-01, F-UT-02: tabella con la ricerca e la Sidebar a rotaia', async ({ page }) => {
    const t = token();
    const a = await nuovoUtente(`e2e_${t}_a`, { email: `${t}@example.org` });
    await entra(page);
    await page.getByRole('link', { name: 'Utenti' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Utenti');
    await expect(page.getByText('Livello segreto · solo superuser')).toBeVisible();
    await page.getByRole('searchbox').fill(t);
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(a.username);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1180);
  });
});

test.describe('elenco a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('F-UT-01: schede con nome · email, badge e ultimo accesso; ORDINA; la propria scheda senza casella', async ({ page }) => {
    const t = token();
    await nuovoUtente(`e2e_${t}_a`, { first_name: 'Sara', last_name: 'Neri', email: `${t}@example.org`, is_superuser: true });
    await nuovoUtente(`e2e_${t}_b`, { is_staff: false, is_active: false });
    await entra(page);
    await elenco(page, t);
    await expect(page.locator('table')).toHaveCount(0);
    await expect(schede(page)).toHaveCount(2);
    await expect(schede(page).nth(0)).toContainText(`e2e_${t}_a`);
    await expect(schede(page).nth(0)).toContainText('Superuser');
    await expect(schede(page).nth(0)).toContainText(`Sara Neri · ${t}@example.org`);
    await expect(schede(page).nth(0)).toContainText('mai entrato');
    await expect(schede(page).nth(1)).toContainText('nessun nome · nessuna email');
    await expect(schede(page).nth(1)).toContainText('· Non staff');
    await expect(schede(page).nth(1)).toContainText('· Non attivo');
    await page.getByRole('combobox', { name: /Ordina/ }).click();
    await page.getByRole('option', { name: 'Username, Z → A' }).click();
    await expect(schede(page).nth(0)).toContainText(`e2e_${t}_b`);
    // la propria scheda: ultimo accesso con la data breve, niente casella
    await elenco(page, USERS.superuser.username);
    await expect(schede(page)).toHaveCount(1);
    await expect(schede(page).first().getByRole('checkbox')).toHaveCount(0);
    await expect(schede(page).first()).toContainText(/\d\d\/\d\d \d\d:\d\d/);
  });

  test('F-UT-06: in blocco a 390, con il singolare', async ({ page }) => {
    const t = token();
    const a = await nuovoUtente(`e2e_${t}_a`);
    await nuovoUtente(`e2e_${t}_b`);
    await entra(page);
    await elenco(page, t);
    await page.getByRole('checkbox', { name: `Seleziona l'utente ${a.username}` }).check();
    await expect(page.getByText('1 selezionato')).toBeVisible();
    await page.getByRole('button', { name: 'Elimina', exact: true }).click();
    await expect(dialogo(page)).toContainText('Eliminare 1 utente?');
    await expect(dialogo(page)).toContainText(
      'Stai per eliminare 1 utente e tutti i suoi collegamenti a registro, gruppi e permessi. Episodi e videogame restano come sono.',
    );
    await foto(page, 'elenco-utenti-conferma-blocco-390');
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(schede(page)).toHaveCount(1);
    expect((await leggi(a.id)).status).toBe(404);
  });
});

// --- Permessi (F-AU-04) e sessione (F-AU-05) ------------------------------------------------

test.describe('permessi e sessione', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-AU-04: uno staff non vede UTENTI e l\'indirizzo lo riporta agli episodi', async ({ page }) => {
    await entra(page, USERS.staff);
    await expect(page.getByRole('link', { name: 'Utenti' })).toHaveCount(0);
    await page.goto('/bo/utenti');
    await expect(page).toHaveURL(/\/bo\/episodi$/);
    await page.goto(`/bo/utenti/${io.id}`);
    await expect(page).toHaveURL(/\/bo\/episodi$/);
  });

  test('F-AU-05: se l\'utente viene disattivato da un\'altra sessione, la richiesta dopo porta al login', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_dis`);
    await entra(page, { username: u.username, password: PASSWORD });
    await aggiornaUtente(su, u.id, { ...u, is_active: false });
    await page.getByRole('link', { name: 'Videogame' }).click();
    await expect(page).toHaveURL(/\/bo\/login$/);
  });

  test('F-AU-05: se un\'altra sessione gli cambia la password, la richiesta dopo porta al login', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_pwd`);
    await entra(page, { username: u.username, password: PASSWORD });
    await aggiornaUtente(su, u.id, { ...u, password: 'e2e-password-cambiata' });
    await page.getByRole('link', { name: 'Videogame' }).click();
    await expect(page).toHaveURL(/\/bo\/login$/);
  });

  test('F-UT-05: dopo SALVA E CONTINUA sul proprio account la barra app mostra il nome nuovo', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_nome`, { is_superuser: true });
    await entra(page, { username: u.username, password: PASSWORD });
    await expect(page.locator('header.bg-inchiostro:visible')).toContainText(u.username);
    await page.goto(`/bo/utenti/${u.id}`);
    await page.getByLabel('Nome', { exact: true }).fill('Ada');
    await page.getByLabel('Cognome').fill('Lovelace');
    const risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await risposta;
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page.locator('header.bg-inchiostro:visible')).toContainText('Ada Lovelace');
    await expect(page).toHaveURL(new RegExp(`/bo/utenti/${u.id}$`));
  });

  test('F-AU-05, F-UT-05: chi cambia la propria password resta dentro', async ({ page, playwright }) => {
    const u = await nuovoUtente(`e2e_${token()}_mio`, { is_superuser: true });
    await entra(page, { username: u.username, password: PASSWORD });
    await page.goto(`/bo/utenti/${u.id}`);
    await page.getByLabel('Nuova password').fill('e2e-password-nuova-mia');
    const risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await risposta;
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page.getByLabel('Nuova password')).toHaveValue('');
    await page.getByRole('link', { name: 'Videogame' }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Videogame');
    expect(await puoEntrare(playwright, u.username, 'e2e-password-nuova-mia')).toBe(true);
    expect(await puoEntrare(playwright, u.username, PASSWORD)).toBe(false);
  });
});

// --- Nuovo utente (F-UT-04) -----------------------------------------------------------------

test.describe('nuovo utente a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-UT-04: password obbligatoria, permessi iniziali; CREA apre la modifica', async ({ page, playwright }) => {
    const username = `e2e_${token()}_nuovo`;
    await entra(page);
    await page.goto('/bo/utenti');
    await page.getByRole('link', { name: '+ Nuovo utente' }).click();
    await expect(page).toHaveURL(/\/bo\/utenti\/nuovo$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nuovo utente');
    await expect(page.getByText('Password *', { exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('Lascia vuoto per non cambiarla')).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /Staff/ })).toBeChecked();
    await expect(page.getByRole('switch', { name: /Attivo/ })).toBeChecked();
    await expect(page.getByRole('switch', { name: /Superuser/ })).not.toBeChecked();
    await expect(page.getByTestId('registro')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Elimina utente' })).toHaveCount(0);
    await expect(salvaEContinua(page)).toHaveCount(0);
    await page.getByLabel('Username').fill(username);
    // senza password il server rifiuta
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(toast(page)).toContainText('password');
    await expect(page).toHaveURL(/\/utenti\/nuovo$/);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByLabel('Nome', { exact: true }).fill('Luca');
    await page.getByLabel('Cognome').fill('Verdi');
    await page.getByLabel('Email').fill('luca.verdi@example.org');
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(page).toHaveURL(/\/bo\/utenti\/\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(username);
    const id = Number(page.url().split('/').pop());
    expect((await leggi(id)).body).toMatchObject({
      username,
      first_name: 'Luca',
      last_name: 'Verdi',
      email: 'luca.verdi@example.org',
      is_staff: true,
      is_active: true,
      is_superuser: false,
      last_login: null,
    });
    expect(await puoEntrare(playwright, username, PASSWORD)).toBe(true);
  });

  test('F-UT-04: uno username già usato va nel Toast', async ({ page }) => {
    const esistente = await nuovoUtente(`e2e_${token()}_dup`);
    await entra(page);
    await page.goto('/bo/utenti/nuovo');
    await page.getByLabel('Username').fill(esistente.username);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Crea' }).click();
    await expect(toast(page)).toContainText('Esiste già un utente con questo username');
    await expect(page).toHaveURL(/\/utenti\/nuovo$/);
  });
});

// --- Modifica utente (F-UT-03, F-UT-05, F-UT-06) --------------------------------------------

test.describe('modifica a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-UT-03: il form parte dal dettaglio, senza password; registro con «mai» e la data d\'iscrizione', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_dett`, {
      first_name: 'Giulia',
      last_name: 'Bianchi',
      email: 'giulia@example.org',
      is_superuser: true,
    });
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(u.username);
    await expect(page.getByLabel('Username')).toHaveValue(u.username);
    await expect(page.getByLabel('Nuova password')).toHaveValue('');
    await expect(page.getByLabel('Nuova password')).toHaveAttribute('placeholder', 'Lascia vuoto per non cambiarla');
    await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Giulia');
    await expect(page.getByLabel('Cognome')).toHaveValue('Bianchi');
    await expect(page.getByLabel('Email')).toHaveValue('giulia@example.org');
    await expect(page.getByRole('switch', { name: /Superuser/ })).toBeChecked();
    await expect(page.getByText('Regole del gioco')).toBeVisible();
    const registro = page.getByTestId('registro');
    await expect(registro).toContainText('Ultimo accessomai');
    await expect(registro).toContainText(/Iscritto dal\d{4}-\d\d-\d\d \d\d:\d\d/);
  });

  test('F-UT-05: salva i campi; senza password la password resta, con una nuova cambia', async ({ page, playwright }) => {
    const u = await nuovoUtente(`e2e_${token()}_mod`);
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    await page.getByLabel('Nome', { exact: true }).fill('Nuovo nome');
    await page.getByRole('switch', { name: /Superuser/ }).click();
    await page.getByRole('switch', { name: /Attivo/ }).click();
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/bo\/utenti$/);
    expect((await leggi(u.id)).body).toMatchObject({ first_name: 'Nuovo nome', is_superuser: true, is_active: false, is_staff: true });
    // la password non è cambiata: riattivo e provo
    await aggiornaUtente(su, u.id, { ...(await leggi(u.id)).body, is_active: true });
    expect(await puoEntrare(playwright, u.username, PASSWORD)).toBe(true);
    await page.goto(`/bo/utenti/${u.id}`);
    await page.getByLabel('Nuova password').fill('e2e-password-seconda');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/bo\/utenti$/);
    expect(await puoEntrare(playwright, u.username, 'e2e-password-seconda')).toBe(true);
    expect(await puoEntrare(playwright, u.username, PASSWORD)).toBe(false);
  });

  test('F-UT-05: un superuser non può togliersi i privilegi: Toast e si resta sulla pagina', async ({ page }) => {
    await entra(page);
    await page.goto(`/bo/utenti/${io.id}`);
    await page.getByRole('switch', { name: /Superuser/ }).click();
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(toast(page)).toContainText('Non puoi togliere a te stesso i privilegi di staff, attivo o superuser');
    await expect(page).toHaveURL(new RegExp(`/utenti/${io.id}$`));
    expect((await leggi(io.id)).body.is_superuser).toBe(true);
  });

  test('F-UT-06: elimina dalla modifica, con ANNULLA che non cancella', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_del`);
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    await barra(page).getByRole('button', { name: 'Elimina utente' }).click();
    await expect(dialogo(page)).toContainText("Eliminare l'utente?");
    await expect(dialogo(page)).toContainText(
      `Stai per eliminare l'utente «${u.username}» e i suoi collegamenti a registro, gruppi e permessi. Episodi e videogame restano come sono.`,
    );
    await foto(page, 'modifica-utente-conferma-1440');
    await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
    expect((await leggi(u.id)).status).toBe(200);
    await barra(page).getByRole('button', { name: 'Elimina utente' }).click();
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(page).toHaveURL(/\/bo\/utenti$/);
    expect((await leggi(u.id)).status).toBe(404);
  });

  test('F-UT-06: nel proprio account ELIMINA è disattivato con «Non puoi cancellare te stesso»', async ({ page }) => {
    await entra(page);
    await page.goto(`/bo/utenti/${io.id}`);
    const elimina = barra(page).getByRole('button', { name: 'Elimina utente' });
    await expect(elimina).toBeDisabled();
    await expect(elimina).toHaveAccessibleDescription('Non puoi cancellare te stesso');
    await expect(barra(page).getByText('Non puoi cancellare te stesso')).toBeVisible();
    await elimina.click({ force: true });
    await expect(dialogo(page)).toHaveCount(0);
  });

  test('SALVA E CONTINUA: resta sulla modifica, Toast, form reimpostato e password di nuovo vuota', async ({ page, playwright }) => {
    const u = await nuovoUtente(`e2e_${token()}_sec`);
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    const form = page.locator('form');
    await page.getByLabel('Cognome').fill('Rossi');
    await page.getByLabel('Nuova password').fill('e2e-password-sec');
    await expect(form).toHaveAttribute('data-modificato', 'true');
    let risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await risposta;
    await expect(toast(page)).toHaveAttribute('data-variant', 'success');
    await expect(toast(page)).toContainText('Checkpoint');
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page).toHaveURL(new RegExp(`/bo/utenti/${u.id}$`));
    await expect(form).toHaveAttribute('data-modificato', 'false');
    await expect(page.getByLabel('Nuova password')).toHaveValue('');
    await expect(page.getByLabel('Cognome')).toHaveValue('Rossi');
    expect((await leggi(u.id)).body.last_name).toBe('Rossi');
    expect(await puoEntrare(playwright, u.username, 'e2e-password-sec')).toBe(true);
    // un secondo invio senza modifiche non rimanda la password
    await toast(page).getByRole('button', { name: "Chiudi l'avviso" }).click();
    risposta = aggiornato(page);
    await salvaEContinua(page).click();
    expect((await risposta).request().postDataJSON().variables.dati.password).toBeNull();
    await expect(toast(page)).toContainText('Modifiche salvate');
    expect(await puoEntrare(playwright, u.username, 'e2e-password-sec')).toBe(true);
  });

  test('SALVA E CONTINUA: le modifiche fatte durante l\'invio restano; un errore si comporta come SALVA', async ({ page }) => {
    const altro = await nuovoUtente(`e2e_${token()}_occ`);
    const u = await nuovoUtente(`e2e_${token()}_dur`);
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    let rilascia;
    const trattenuta = new Promise((ok) => (rilascia = ok));
    await page.route('**/api/graphql', async (route) => {
      if ((route.request().postData() ?? '').includes('AggiornaUtente')) {
        const res = await route.fetch();
        await trattenuta;
        await route.fulfill({ response: res });
      } else await route.fallback();
    });
    await page.getByLabel('Nome', { exact: true }).fill('Primo');
    await page.getByLabel('Nuova password').fill('e2e-password-durante');
    const risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await expect(salvaEContinua(page)).toHaveCount(0); // mostra «Attendi…»
    await page.getByLabel('Email').fill('durante@example.org');
    rilascia();
    await risposta;
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page.getByLabel('Email')).toHaveValue('durante@example.org');
    // la password inviata si svuota comunque
    await expect(page.getByLabel('Nuova password')).toHaveValue('');
    await expect(page.locator('form')).toHaveAttribute('data-modificato', 'true');
    expect((await leggi(u.id)).body).toMatchObject({ first_name: 'Primo', email: '' });
    await page.unroute('**/api/graphql');
    // errore: username già usato
    await page.getByLabel('Username').fill(altro.username);
    await salvaEContinua(page).click();
    await expect(toast(page)).toHaveAttribute('data-variant', 'destructive');
    await expect(toast(page)).toContainText('Esiste già un utente con questo username');
    await expect(page.getByLabel('Username')).toHaveValue(altro.username);
  });
});

test.describe('modifica a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('F-UT-03, F-UT-05: due colonne e salvataggio', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_1180`);
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    await expect(page.getByTestId('registro')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1180);
    await page.getByLabel('Email').fill('mille@example.org');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/bo\/utenti$/);
    expect((await leggi(u.id)).body.email).toBe('mille@example.org');
  });
});

test.describe('modifica a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('F-UT-03, F-UT-06: ordine dei pannelli, ELIMINA in fondo; nel proprio account disattivato col suggerimento', async ({ page }) => {
    const u = await nuovoUtente(`e2e_${token()}_390`);
    await entra(page);
    await page.goto(`/bo/utenti/${u.id}`);
    const titoli = page.locator('main [data-slot=card-title]');
    await expect(titoli).toHaveText(['Account', 'Permessi', 'Regole del gioco', 'Registro']);
    await expect(page.getByRole('button', { name: 'Elimina utente' })).toBeEnabled();
    await expect(barra(page).getByRole('button', { name: 'Elimina utente' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole('button', { name: 'Salva', exact: true })).toBeInViewport();
    await page.goto(`/bo/utenti/${io.id}`);
    await expect(page.getByRole('button', { name: 'Elimina utente' })).toBeDisabled();
    await expect(page.getByText('Non puoi cancellare te stesso')).toBeVisible();
  });
});

// --- Barra delle azioni e fotografie nei tre formati ----------------------------------------

for (const formato of [390, 1180, 1440]) {
  test.describe(`schermate a ${formato}`, () => {
    test.use({ viewport: VIEWPORT[formato] });

    test('barra delle azioni della modifica, nuovo utente e proprio account', async ({ page }) => {
      const u = await nuovoUtente(`e2e_${token()}_barra`, { first_name: 'Giulia', last_name: 'Bianchi', email: 'giulia@example.org' });
      await entra(page);
      await page.goto(`/bo/utenti/${u.id}`);
      const b = barra(page);
      const annulla = b.getByRole('link', { name: 'Annulla' });
      const continua = b.getByRole('button', { name: 'Salva e continua' });
      const salva = b.getByRole('button', { name: 'Salva', exact: true });
      const [rb, ra, rc, rs] = await Promise.all([b, annulla, continua, salva].map((l) => l.boundingBox()));
      const centro = (r) => r.y + r.height / 2;
      if (formato === 390) {
        await expect(salva).toBeInViewport();
        expect(rc.width).toBeCloseTo(rb.width - 32, 0);
        expect(rc.y + rc.height).toBeLessThanOrEqual(ra.y);
        expect(Math.abs(centro(ra) - centro(rs))).toBeLessThan(1);
      } else {
        const re = await b.getByRole('button', { name: 'Elimina utente' }).boundingBox();
        for (const r of [re, ra, rc]) expect(Math.abs(centro(r) - centro(rs))).toBeLessThan(1);
        expect(re.x).toBeCloseTo(rb.x + 16, 0);
        expect(ra.x + ra.width).toBeLessThan(rc.x);
        expect(rc.x + rc.width).toBeLessThan(rs.x);
        expect(rs.x + rs.width).toBeCloseTo(rb.x + rb.width - 16, 0);
      }
      await foto(page, `modifica-utente-${formato}`);
      await page.goto(`/bo/utenti/${io.id}`);
      await expect(page.getByText('Non puoi cancellare te stesso')).toBeVisible();
      await foto(page, `modifica-utente-proprio-${formato}`);
      await page.goto('/bo/utenti/nuovo');
      await expect(barra(page).getByRole('button', { name: 'Crea' })).toBeVisible();
      await expect(salvaEContinua(page)).toHaveCount(0);
      await foto(page, `nuovo-utente-${formato}`);
    });

    test('elenco con una selezione e la propria riga', async ({ page }) => {
      const t = token();
      await nuovoUtente(`e2e_${t}_admin`, { first_name: 'Mario', last_name: 'Rossi', email: 'mario@example.org', is_superuser: true });
      const b = await nuovoUtente(`e2e_${t}_giulia`, { first_name: 'Giulia', last_name: 'Bianchi', email: 'giulia@example.org' });
      await nuovoUtente(`e2e_${t}_redazione`, { is_active: false });
      await entra(page);
      await elenco(page, t);
      await page.getByRole('checkbox', { name: `Seleziona l'utente ${b.username}` }).check();
      await expect(page.getByText(formato === 390 ? '1 selezionato' : '1 utente selezionato')).toBeVisible();
      await foto(page, `elenco-utenti-${formato}`);
      if (formato === 1180) {
        await page.getByRole('button', { name: 'Elimina selezionati' }).click();
        await expect(dialogo(page)).toContainText('Eliminare 1 utente?');
        await foto(page, 'elenco-utenti-conferma-blocco-1180');
      }
    });

    if (formato !== 1440)
      test('conferma di eliminazione dalla modifica', async ({ page }) => {
        const u = await nuovoUtente(`e2e_${token()}_conf`);
        await entra(page);
        await page.goto(`/bo/utenti/${u.id}`);
        await page.getByRole('button', { name: 'Elimina utente' }).click();
        await expect(dialogo(page)).toContainText(`«${u.username}»`);
        await foto(page, `modifica-utente-conferma-${formato}`);
      });
  });
}
