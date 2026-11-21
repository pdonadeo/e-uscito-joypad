// Test e2e di /bo sotto 390 px (Fase 3.6c.4c): a 306 (OnePlus Nord2 con Firefox Android) e a
// 320 nessuna schermata scorre in orizzontale (document.documentElement.scrollWidth ≤
// window.innerWidth), e nel login il titolo RETROBOTTEGA sta dentro il riquadro.
// Le fixture hanno testi lunghi (titolo, slug, username, email) come i casi peggiori dei dati veri.
// A 1440, uno username lunghissimo: il wrap di titoli e conferme vale a tutte le larghezze.
// Girano con playwright.api.config.js; il teardown della suite cancella episodi «[E2E]…»,
// videogame «e2e-…» e utenti «e2e_…».
const { test, expect } = require('@playwright/test');
const { USERS } = require('./env');
const { loggedIn, uniq } = require('./helpers');
const { creaVideogame, aggiornaVideogame, creaEpisodio, creaUtente } = require('./gql-helpers');

test.use({ extraHTTPHeaders: {} });

let api;
const f = {};

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.superuser);
  const u = uniq();
  const slug = `e2e-stretto-un-gioco-con-uno-slug-davvero-molto-lungo-${u}`;
  const { id } = await creaVideogame(api, { rawg_slug: slug });
  f.gioco = await aggiornaVideogame(api, id, {
    rawg_slug: slug,
    titolo: `The Legend of Zelda: Tears of the Kingdom ${u}`,
    descrizione_raw: 'Descrizione',
  });
  f.episodio = await creaEpisodio(api, {
    titolo: `[E2E] Stretto: un episodio con un titolo lungo come quelli veri ${u}`,
    episodio_numero: '999',
    data_uscita: '2001-01-01',
    durata: '1:23:45',
    url: 'https://www.example.com/un/indirizzo/molto/lungo/per/vedere/se/esce/dal/riquadro.mp3',
    associazioni: [
      { videogame_id: f.gioco.id, istante: '0:01:00', speaker: 'FOSS', tipologia: 'RECE' },
      { videogame_id: f.gioco.id, istante: '1:02:03', speaker: 'ZAMP', tipologia: 'STAR' },
    ],
  });
  f.utente = await creaUtente(api, {
    username: `e2e_stretto_${u.replace('-', '_')}_con_un_nome_molto_lungo`,
    password: 'e2e-password-lunga',
    first_name: 'Massimiliano',
    last_name: 'Bartolomei-Castelfranchi',
    email: `massimiliano.bartolomei-castelfranchi.${u}@example.com`,
    is_staff: true,
    is_active: true,
    is_superuser: false,
  });
});

test.afterAll(async () => {
  await api.dispose();
});

// --- aiuti ------------------------------------------------------------------------------------

// Nessuno scorrimento orizzontale della pagina.
async function senzaScorrimento(page, schermata) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, `${schermata}: scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(innerWidth);
}

async function entra(page, user = USERS.superuser) {
  await page.goto('/bo/login');
  await page.getByLabel('Nome utente').fill(user.username);
  await page.getByLabel("Parola d'ordine").fill(user.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
}

const dialogo = (page) => page.getByRole('alertdialog');

// Il testo del titolo (non il box dell'h1, che è largo quanto il riquadro) sta dentro il riquadro
// crema del login.
async function titoloDentroIlRiquadro(page) {
  const { testo, riquadro } = await page.getByRole('heading', { name: 'RETROBOTTEGA' }).evaluate((h1) => {
    const range = document.createRange();
    range.selectNodeContents(h1);
    const t = range.getBoundingClientRect();
    const r = h1.parentElement.getBoundingClientRect();
    return { testo: { left: t.left, right: t.right }, riquadro: { left: r.left, right: r.right } };
  });
  expect(testo.left, 'il titolo esce a sinistra').toBeGreaterThanOrEqual(riquadro.left);
  expect(testo.right, 'il titolo esce a destra').toBeLessThanOrEqual(riquadro.right);
}

for (const w of [306, 320]) {
  test.describe(`a ${w} px`, () => {
    test.use({ viewport: { width: w, height: 700 } });

    test('login, normale e in errore: niente scorrimento, RETROBOTTEGA dentro il riquadro', async ({ page }) => {
      await page.goto('/bo/login');
      await expect(page.getByRole('heading', { name: 'RETROBOTTEGA' })).toBeVisible();
      await senzaScorrimento(page, 'login');
      await titoloDentroIlRiquadro(page);
      await page.getByLabel('Nome utente').fill(USERS.staff.username);
      await page.getByLabel("Parola d'ordine").fill('sbagliata');
      await page.getByRole('button', { name: 'Entra' }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      await senzaScorrimento(page, 'login in errore');
      await titoloDentroIlRiquadro(page);
    });

    test('elenchi: menu, filtro, ordina, selezione e conferma in blocco', async ({ page }) => {
      await entra(page);
      await senzaScorrimento(page, 'elenco episodi');
      await page.getByRole('button', { name: 'Apri il menu' }).click();
      await expect(page.getByRole('button', { name: 'Chiudi il menu' })).toBeVisible();
      await senzaScorrimento(page, 'menu');
      await page.getByRole('button', { name: 'Chiudi il menu' }).click();
      await page.getByRole('button', { name: '+ Filtro' }).click();
      await expect(page.getByRole('combobox', { name: 'Pubblicato' })).toBeVisible();
      await senzaScorrimento(page, 'episodi con il filtro');
      // «+ FILTRO» resta dentro la colonna del contenuto (16 px di margine a destra)
      const filtro = await page.getByRole('button', { name: '+ Filtro' }).boundingBox();
      expect(filtro.x + filtro.width).toBeLessThanOrEqual(w - 16);
      await page.getByRole('combobox', { name: 'Ordina' }).click();
      await expect(page.getByRole('listbox')).toBeVisible();
      await senzaScorrimento(page, 'ordina aperto');
      await page.keyboard.press('Escape');
      await page.getByRole('checkbox', { name: /^Seleziona l'episodio/ }).first().check();
      await senzaScorrimento(page, 'episodi con selezione');
      await page.getByRole('button', { name: /^Elimina/ }).first().click();
      await expect(dialogo(page)).toBeVisible();
      await senzaScorrimento(page, 'conferma in blocco degli episodi');
      await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
      // il selettore delle righe per pagina mostra il numero intero
      const righe = page.getByRole('combobox', { name: 'Righe per pagina' }).locator('[data-slot=select-value]');
      expect(await righe.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);

      await page.goto('/bo/videogame');
      await expect(page.getByRole('heading', { name: 'Videogame' })).toBeVisible();
      await senzaScorrimento(page, 'elenco videogame');
      await page.getByRole('checkbox', { name: /^Seleziona il videogame/ }).first().check();
      await page.getByRole('button', { name: /^Elimina/ }).first().click();
      await expect(dialogo(page)).toBeVisible();
      await senzaScorrimento(page, 'conferma in blocco dei videogame');
      await dialogo(page).getByRole('button', { name: 'Annulla' }).click();

      await page.goto(`/bo/utenti?ricerca=${encodeURIComponent('e2e_stretto_')}`);
      await expect(page.getByRole('heading', { name: 'Utenti' })).toBeVisible();
      await senzaScorrimento(page, 'elenco utenti');
      await page.getByRole('checkbox', { name: /^Seleziona l'utente/ }).first().check();
      await page.getByRole('button', { name: /^Elimina/ }).first().click();
      await expect(dialogo(page)).toBeVisible();
      await senzaScorrimento(page, 'conferma in blocco degli utenti');
      await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
    });

    test('episodio: modifica, barra su due righe, Combobox, Dialog nuovo videogame, conferma, Toast, nuovo', async ({ page }) => {
      await entra(page);
      await page.goto(`/bo/episodi/${f.episodio.id}`);
      await expect(page.getByLabel('Titolo')).toHaveValue(f.episodio.titolo);
      await expect(page.getByRole('button', { name: 'Salva e continua' })).toBeVisible();
      await senzaScorrimento(page, 'modifica episodio');
      const campo = page.getByRole('combobox', { name: 'Videogame, riga 1' });
      await campo.click();
      await campo.fill('zelda');
      await expect(page.getByRole('status').filter({ hasText: 'Cerco' })).toBeHidden();
      await expect(page.getByRole('option').first()).toBeVisible();
      await senzaScorrimento(page, 'Combobox');
      await campo.fill('E2E un gioco che non esiste');
      await expect(page.getByRole('status').filter({ hasText: 'Cerco' })).toBeHidden();
      await page.locator('[data-slot=command-footer]').getByRole('button', { name: '+ Crealo qui' }).click();
      const nuovo = page.getByRole('dialog', { name: 'Nuovo videogame' });
      await expect(nuovo).toBeVisible();
      await senzaScorrimento(page, 'Dialog nuovo videogame');
      // «CREA DA RAWG» sta dentro la barra del Dialog (16 px di margine a destra)
      const crea = await nuovo.getByRole('button', { name: 'Crea da RAWG' }).boundingBox();
      expect(crea.x + crea.width).toBeLessThanOrEqual(w - 16);
      await nuovo.getByRole('button', { name: 'Annulla' }).click();
      await page.getByRole('button', { name: 'Elimina episodio' }).click();
      await expect(dialogo(page)).toBeVisible();
      await senzaScorrimento(page, 'conferma eliminazione episodio');
      await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
      await page.getByRole('button', { name: 'Salva e continua' }).click();
      await expect(page.locator('[data-sonner-toast]')).toBeVisible();
      await senzaScorrimento(page, 'Toast');
      await page.goto('/bo/episodi/nuovo');
      await expect(page.getByLabel('Titolo')).toBeVisible();
      await senzaScorrimento(page, 'nuovo episodio');
    });

    test('videogame: modifica, conferma, nuovo ed errore di RAWG', async ({ page }) => {
      await entra(page);
      await page.goto(`/bo/videogame/${f.gioco.id}`);
      await expect(page.getByLabel('Titolo')).toHaveValue(f.gioco.titolo);
      await senzaScorrimento(page, 'modifica videogame');
      await page.getByRole('button', { name: 'Elimina videogame' }).click();
      await expect(dialogo(page)).toBeVisible();
      await senzaScorrimento(page, 'conferma eliminazione videogame');
      await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
      await page.goto('/bo/videogame/nuovo');
      await expect(page.getByLabel('RAWG slug')).toBeVisible();
      await senzaScorrimento(page, 'nuovo videogame');
      await page.getByLabel('RAWG slug').fill(`e2e-missing-un-gioco-che-rawg-non-conosce-${uniq()}`);
      await page.getByRole('button', { name: 'Crea da RAWG' }).click();
      await expect(page.locator('[data-sonner-toast]')).toBeVisible();
      await senzaScorrimento(page, 'nuovo videogame con errore');
    });

    test('utente: modifica con uno username lungo, conferma, nuovo', async ({ page }) => {
      await entra(page);
      await page.goto(`/bo/utenti/${f.utente.id}`);
      await expect(page.getByLabel('Username')).toHaveValue(f.utente.username);
      await senzaScorrimento(page, 'modifica utente');
      await page.getByRole('button', { name: 'Elimina utente' }).click();
      await expect(dialogo(page)).toBeVisible();
      await senzaScorrimento(page, 'conferma eliminazione utente');
      // il testo della conferma, con lo username, sta dentro il Dialog
      const box = await dialogo(page).boundingBox();
      const testo = await dialogo(page).getByText(/Stai per eliminare/).evaluate((el) => el.scrollWidth <= el.clientWidth);
      expect(testo).toBe(true);
      expect(box.x + box.width).toBeLessThanOrEqual(w);
      await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
      await page.goto('/bo/utenti/nuovo');
      await expect(page.getByLabel('Username')).toBeVisible();
      await senzaScorrimento(page, 'nuovo utente');
    });
  });
}

// Il wrap dei titoli di pagina e delle conferme vale a tutte le larghezze (decisione del gate 3.6c.4c).
test.describe('a 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('utente con uno username lunghissimo: titolo di Modifica utente e conferma senza scorrimento', async ({ page }) => {
    // 140 caratteri senza spazi (Django ne ammette 150): più largo dell'area principale a 1440
    const base = `e2e_stretto_1440_${uniq().replace('-', '_')}_`;
    const username = base + 'x'.repeat(140 - base.length);
    const utente = await creaUtente(api, {
      username,
      password: 'e2e-password-lunga',
      is_staff: true,
      is_active: true,
      is_superuser: false,
    });
    await entra(page);
    await page.goto(`/bo/utenti/${utente.id}`);
    await expect(page.getByLabel('Username')).toHaveValue(username);
    await expect(page.getByRole('heading', { name: username })).toBeVisible();
    await senzaScorrimento(page, 'modifica utente a 1440');
    await page.getByRole('button', { name: 'Elimina utente' }).click();
    await expect(dialogo(page)).toBeVisible();
    await senzaScorrimento(page, 'conferma eliminazione utente a 1440');
    expect(await dialogo(page).getByText(/Stai per eliminare/).evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });
});
