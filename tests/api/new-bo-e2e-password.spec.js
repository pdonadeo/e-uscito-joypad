// Test e2e del cambio della propria password in /bo (F-AU-06, Fase 3.6c.4d), a 306, 390,
// 1180 e 1440: percorso completo da utente staff non superuser, conferma diversa (nessuna
// richiesta), password attuale sbagliata (errore nel campo, si resta loggati), accesso dalla Barra
// app desktop e dallo Sheet. A 1440: nuova corta, anche «àààà» (errore nel campo, nessuna
// richiesta), e un errore del server simulato con page.route (nel Toast). Girano con playwright.api.config.js, come le altre spec new-bo-e2e*.
// Ogni test crea il suo utente «e2e_…» via GraphQL (il teardown lo cancella).
const { randomInt } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { USERS } = require('./env');
const { loggedIn, newContext } = require('./helpers');
const { gql, creaUtente } = require('./gql-helpers');

// Il browser manda la sua Origin vera (V-01).
test.use({ extraHTTPHeaders: {} });

const VIEWPORT = {
  306: { width: 306, height: 680 },
  390: { width: 390, height: 844 },
  1180: { width: 1180, height: 820 },
  1440: { width: 1440, height: 900 },
};

const VECCHIA = 'e2e-password-vecchia';
const NUOVA = 'e2e-password-nuova!';

let su;

test.beforeAll(async ({ playwright }) => {
  su = await loggedIn(playwright, USERS.superuser);
});

test.afterAll(async () => {
  await su.dispose();
});

// --- aiuti ------------------------------------------------------------------------------------

const token = () => `nbp${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;

// Un utente staff, non superuser, con password VECCHIA.
async function nuovoUtente() {
  const u = await creaUtente(su, {
    username: `e2e_${token()}`,
    password: VECCHIA,
    is_staff: true,
    is_active: true,
    is_superuser: false,
  });
  return { ...u, password: VECCHIA };
}

async function entra(page, user) {
  await page.goto('/bo/login');
  await page.getByLabel('Nome utente').fill(user.username);
  await page.getByLabel("Parola d'ordine").fill(user.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
}

async function puoEntrare(playwright, username, password) {
  const ctx = await newContext(playwright);
  const r = await gql(ctx, 'mutation($c: CredenzialiInput!) { login(credenziali: $c) { id } }', {
    c: { username, password },
  });
  await ctx.dispose();
  return !r.errors;
}

const attuale = (page) => page.getByLabel("Parola d'ordine attuale");
const nuova = (page) => page.getByLabel("Nuova parola d'ordine");
const ripeti = (page) => page.getByLabel('Ripeti la nuova');
const salva = (page) => page.getByTestId('barra-azioni').getByRole('button', { name: 'Salva' });
// il Toast visibile: quello sostituito resta nel DOM durante l'uscita, con data-removed
const toast = (page) => page.locator('[data-sonner-toast]:not([data-removed=true]) [data-slot=toast]');
const richiesteCambio = (page) => {
  const viste = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/graphql') && (r.postData() ?? '').includes('CambiaPassword')) viste.push(r);
  });
  return viste;
};
const cambiata = (page) =>
  page.waitForResponse((r) => r.url().endsWith('/api/graphql') && (r.request().postData() ?? '').includes('CambiaPassword'));

async function compila(page, a, n, r = n) {
  await attuale(page).fill(a);
  await nuova(page).fill(n);
  await ripeti(page).fill(r);
}

// nessuna schermata scorre in orizzontale (docs/ui.md, «Sotto 390»)
async function senzaScrollOrizzontale(page) {
  const { scroll, larghezza } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    larghezza: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(larghezza);
}

// Fotografie per il gate, in test-results/…: su desktop la pagina intera; sotto lg lo schermo in
// cima e in fondo (la barra delle azioni è fissa).
async function foto(page, nome) {
  const percorso = (n) => test.info().outputPath(`${n}.png`);
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.evaluate(() => window.scrollTo(0, 0));
  if (page.viewportSize().width >= 1024) return page.screenshot({ path: percorso(nome), fullPage: true });
  await page.screenshot({ path: percorso(`${nome}-alto`) });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: percorso(`${nome}-basso`) });
}

// --- test, in ogni formato ---------------------------------------------------------------------

for (const [formato, viewport] of Object.entries(VIEWPORT)) {
  const desktop = viewport.width >= 1024;

  test.describe(`a ${formato}`, () => {
    test.use({ viewport });

    test(`F-AU-06: percorso completo da utente non superuser (${formato})`, async ({ page, playwright }) => {
      const u = await nuovoUtente();
      await entra(page, u);
      await page.goto('/bo/password');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText("Cambia parola d'ordine");
      await expect(attuale(page)).toHaveAttribute('autocomplete', 'current-password');
      await expect(nuova(page)).toHaveAttribute('autocomplete', 'new-password');
      await expect(ripeti(page)).toHaveAttribute('autocomplete', 'new-password');
      await senzaScrollOrizzontale(page);
      await foto(page, `password-${formato}`);

      await compila(page, VECCHIA, NUOVA);
      const risposta = cambiata(page);
      await salva(page).click();
      expect((await risposta).ok()).toBe(true);

      await expect(toast(page)).toHaveAttribute('data-variant', 'success');
      await expect(toast(page)).toContainText('Checkpoint');
      await expect(toast(page)).toContainText("Parola d'ordine cambiata");
      // form vuoto, si resta sulla pagina
      for (const campo of [attuale, nuova, ripeti]) await expect(campo(page)).toHaveValue('');
      await expect(page).toHaveURL(/\/bo\/password$/);
      await senzaScrollOrizzontale(page);
      await foto(page, `password-${formato}-checkpoint`);

      // la sessione corrente resta valida
      await page.goto('/bo/episodi');
      await expect(page).toHaveURL(/\/bo\/episodi$/);
      await page.reload();
      await expect(page).toHaveURL(/\/bo\/episodi$/);
      expect(await puoEntrare(playwright, u.username, NUOVA)).toBe(true);
      expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(false);
    });

    test(`F-AU-06: conferma diversa → errore nel campo, nessuna richiesta (${formato})`, async ({ page, playwright }) => {
      const u = await nuovoUtente();
      await entra(page, u);
      await page.goto('/bo/password');
      const viste = richiesteCambio(page);
      await compila(page, VECCHIA, NUOVA, `${NUOVA}x`);
      await salva(page).click();

      await expect(ripeti(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(page.getByText("Non coincide con la nuova parola d'ordine")).toBeVisible();
      await expect(ripeti(page)).toHaveAccessibleDescription("Non coincide con la nuova parola d'ordine");
      await expect(attuale(page)).not.toHaveAttribute('aria-invalid');
      await expect(toast(page)).toHaveCount(0);
      // INVIO nel campo non cambia le cose
      await ripeti(page).press('Enter');
      await page.waitForTimeout(300);
      expect(viste).toHaveLength(0);
      await senzaScrollOrizzontale(page);
      await foto(page, `password-${formato}-non-coincide`);

      // correggere il campo toglie l'errore
      await ripeti(page).fill(NUOVA);
      await expect(ripeti(page)).not.toHaveAttribute('aria-invalid');
      await expect(page.getByText("Non coincide con la nuova parola d'ordine")).toHaveCount(0);
      expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(true);
    });

    test(`F-AU-06: password attuale sbagliata → errore nel campo, si resta sulla pagina (${formato})`, async ({
      page,
      playwright,
    }) => {
      const u = await nuovoUtente();
      await entra(page, u);
      await page.goto('/bo/password');
      await compila(page, 'password-sbagliata', NUOVA);
      const risposta = cambiata(page);
      await salva(page).click();
      await risposta;

      await expect(attuale(page)).toHaveAttribute('aria-invalid', 'true');
      await expect(attuale(page)).toHaveAccessibleDescription("La parola d'ordine attuale non è corretta");
      await expect(attuale(page)).toBeFocused();
      await expect(toast(page)).toHaveCount(0);
      await expect(page).toHaveURL(/\/bo\/password$/);
      await senzaScrollOrizzontale(page);
      await foto(page, `password-${formato}-attuale-errata`);

      // si resta loggati: la pagina si ricarica senza passare dal login
      await page.reload();
      await expect(page).toHaveURL(/\/bo\/password$/);
      await expect(attuale(page)).toBeVisible();
      expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(true);
      expect(await puoEntrare(playwright, u.username, NUOVA)).toBe(false);
    });

    if (desktop) {
      test(`F-AU-06: accesso dalla barra, prima di ESCI; ANNULLA torna indietro (${formato})`, async ({ page }) => {
        const u = await nuovoUtente();
        await entra(page, u);
        await page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Videogame' }).click();
        await expect(page).toHaveURL(/\/bo\/videogame$/);
        const barra = page.getByRole('banner');
        const bottoni = barra.locator('a, button');
        await expect(bottoni).toHaveText(["Parola d'ordine", 'Esci']);
        // stessa altezza e stessa riga di ESCI
        const [a, b] = await Promise.all((await bottoni.all()).map((x) => x.boundingBox()));
        expect(a.height).toBe(b.height);
        expect(a.y).toBe(b.y);
        expect(a.x + a.width).toBeLessThan(b.x);
        await barra.getByRole('link', { name: "Parola d'ordine" }).click();
        await expect(page).toHaveURL(/\/bo\/password$/);
        await page.getByTestId('barra-azioni').getByRole('button', { name: 'Annulla' }).click();
        await expect(page).toHaveURL(/\/bo\/videogame$/);
      });
    } else {
      test(`F-AU-06: accesso dallo Sheet, voce sopra ESCI (${formato})`, async ({ page }) => {
        const u = await nuovoUtente();
        await entra(page, u);
        await expect(page.getByRole('link', { name: "Parola d'ordine" })).toHaveCount(0);
        await page.getByRole('button', { name: 'Apri il menu' }).click();
        const sheet = page.getByRole('dialog');
        const voce = sheet.getByRole('link', { name: "Parola d'ordine" });
        const esci = sheet.getByRole('button', { name: 'Esci' });
        await expect(voce).toBeVisible();
        const [v, e] = await Promise.all([voce.boundingBox(), esci.boundingBox()]);
        expect(v.y + v.height).toBeLessThanOrEqual(e.y);
        await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
        await page.screenshot({ path: test.info().outputPath(`sheet-${formato}.png`) });
        await voce.click();
        await expect(page).toHaveURL(/\/bo\/password$/);
        await expect(sheet).toHaveCount(0);
        await senzaScrollOrizzontale(page);
      });
    }
  });
}

// Lunghezza contata nel client in punti di codice, prima della coincidenza: «1234567» (7) e
// «àààà» (4 caratteri, 8 byte: il server, che conta i byte, la accetterebbe) non partono.
for (const [caso, corta] of [
  ['7 caratteri', '1234567'],
  ['«àààà», 4 caratteri e 8 byte', 'àààà'],
]) {
  test(`F-AU-06: nuova corta (${caso}) → errore nel campo, nessuna richiesta (1440)`, async ({ page, playwright }) => {
    await page.setViewportSize(VIEWPORT[1440]);
    const u = await nuovoUtente();
    await entra(page, u);
    await page.goto('/bo/password');
    const viste = richiesteCambio(page);
    // anche la ripetuta è diversa: conta prima la lunghezza
    await compila(page, VECCHIA, corta, `${corta}x`);
    await salva(page).click();

    await expect(nuova(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(nuova(page)).toHaveAccessibleDescription('Almeno 8 caratteri');
    await expect(ripeti(page)).not.toHaveAttribute('aria-invalid');
    await expect(attuale(page)).not.toHaveAttribute('aria-invalid');
    await expect(toast(page)).toHaveCount(0);
    await nuova(page).press('Enter');
    await page.waitForTimeout(300);
    expect(viste).toHaveLength(0);
    await foto(page, `password-1440-corta-${corta === 'àààà' ? 'accenti' : '7'}`);

    // modificare il campo toglie l'errore
    await nuova(page).fill(`${corta}5`);
    await expect(nuova(page)).not.toHaveAttribute('aria-invalid');
    await expect(page.getByText('Almeno 8 caratteri', { exact: true })).toHaveCount(0);
    expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(true);
  });
}

test('F-AU-06: gli altri errori del server vanno nel Toast, non nel campo (1440)', async ({ page, playwright }) => {
  await page.setViewportSize(VIEWPORT[1440]);
  const u = await nuovoUtente();
  await entra(page, u);
  await page.goto('/bo/password');
  // errore simulato: RATE_LIMITED sulla sola mutation, le altre richieste passano
  await page.route('**/api/graphql', (route) =>
    (route.request().postData() ?? '').includes('CambiaPassword')
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: null,
            errors: [{ message: 'Troppe richieste di login, riprova tra poco', extensions: { code: 'RATE_LIMITED' } }],
          }),
        })
      : route.continue(),
  );
  await compila(page, VECCHIA, NUOVA);
  const risposta = cambiata(page);
  await salva(page).click();
  await risposta;
  await expect(toast(page)).toHaveAttribute('data-variant', 'destructive');
  await expect(toast(page)).toContainText('Troppe richieste di login, riprova tra poco');
  for (const campo of [attuale, nuova, ripeti]) await expect(campo(page)).not.toHaveAttribute('aria-invalid');
  // i campi restano compilati, si resta sulla pagina e loggati
  await expect(nuova(page)).toHaveValue(NUOVA);
  await expect(page).toHaveURL(/\/bo\/password$/);
  await page.unroute('**/api/graphql');
  await page.reload();
  await expect(page).toHaveURL(/\/bo\/password$/);
  expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(true);
});

test('F-AU-06: ANNULLA su una pagina aperta direttamente porta agli episodi', async ({ page }) => {
  const u = await nuovoUtente();
  await entra(page, u);
  await page.goto('/bo/password');
  await page.getByTestId('barra-azioni').getByRole('button', { name: 'Annulla' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
});
