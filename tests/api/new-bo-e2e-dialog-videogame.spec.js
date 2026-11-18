// Test e2e del Dialog «Nuovo videogame» aperto dal form dell'episodio (Fase 3.6c.4a):
// «+ CREALO QUI» nel Combobox della scelta videogame, slug ricavato dal testo cercato, creazione
// con il finto RAWG della suite, riga dell'associazione aggiornata senza salvare l'episodio,
// errori nel Toast sopra il Dialog, chiusura senza creare. Girano con playwright.api.config.js.
// I testi cercati iniziano con «E2E dlg», così gli slug iniziano con «e2e-» e il teardown della
// suite cancella i videogame creati.
const { randomInt } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { USERS } = require('./env');
const { listQuery, loggedIn, uniq } = require('./helpers');

test.use({ extraHTTPHeaders: {} });

const VIEWPORT = {
  390: { width: 390, height: 844 },
  1180: { width: 1180, height: 820 },
  1440: { width: 1440, height: 900 },
};

let api;
let gioco; // un videogame già esistente, per le righe che ne hanno già uno

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
  const res = await api.post('/api/bo/videogame', { data: { rawg_slug: `e2e-dlg-esistente-${uniq()}` } });
  expect(res.status(), await res.text()).toBe(201);
  gioco = await res.json();
});

test.afterAll(async () => {
  await api.dispose();
});

// --- aiuti ------------------------------------------------------------------------------------

const token = () => `${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;

async function entra(page) {
  await page.goto('/new-bo/login');
  await page.getByLabel('Nome utente').fill(USERS.staff.username);
  await page.getByLabel("Parola d'ordine").fill(USERS.staff.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/new-bo\/episodi$/);
}

async function nuovoEpisodio(extra = {}) {
  const res = await api.post('/api/bo/episodi', {
    data: { titolo: `[E2E] dlg ${uniq()}`, data_uscita: '2001-01-01', durata: '1:00:00', ...extra },
  });
  expect(res.status(), await res.text()).toBe(201);
  return res.json();
}

const leggiEpisodio = async (id) => (await api.get(`/api/bo/episodi/${id}`)).json();

// Videogame con questo slug, se c'è.
async function videogameConSlug(slug) {
  const righe = await (await api.get(`/api/bo/videogame${listQuery({ filter: { q: slug } })}`)).json();
  return righe.find((v) => v.rawg_slug === slug) ?? null;
}

const campo = (page, riga) => page.getByRole('combobox', { name: `Videogame, riga ${riga}` });
const dialogo = (page) => page.getByRole('dialog', { name: 'Nuovo videogame', exact: true });
const toast = (page) => page.locator('[data-sonner-toast]:not([data-removed=true]) [data-slot=toast]');
const formModificato = (page) => page.locator('main form');
// «+ CREALO QUI» nel piede del Combobox
const creaQui = (page) => page.locator('[data-slot=command-footer]').getByRole('button', { name: '+ Crealo qui' });

// Scrive nel campo videogame della riga un testo che non c'è e aspetta «Nessun videogame trovato.».
async function cercaInesistente(page, riga, testo) {
  await campo(page, riga).click();
  await campo(page, riga).fill(testo);
  await expect(page.getByText('Nessun videogame trovato.')).toBeVisible();
}

// Fotografia dello schermo, a animazioni finite.
async function foto(page, nome) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.screenshot({ path: test.info().outputPath(`${nome}.png`) });
}

// --- Flussi a 1440 --------------------------------------------------------------------------

test.describe('dialog a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('da «Modifica episodio»: CREALO QUI, slug dal testo cercato, CREA DA RAWG → riga col nuovo gioco, episodio non salvato; poi SALVA', async ({ page }) => {
    const t = token();
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: gioco.id, istante: '0:01:00' }] });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    // modifiche fatte prima di aprire il Dialog
    await page.getByLabel('Titolo').fill(`${e.titolo} modificato`);
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    const cercato = `E2E dlg Zèlda: Ünica ${t}`;
    const slug = `e2e-dlg-zelda-unica-${t}`;
    await cercaInesistente(page, 2, cercato);
    // il bottone c'è solo nel piede, anche con «Nessun videogame trovato.»
    await expect(page.getByText("Il gioco non c'è?")).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Crealo qui' })).toHaveCount(1);
    await creaQui(page).click();
    await expect(dialogo(page)).toBeVisible();
    await expect(dialogo(page).getByLabel('RAWG slug')).toHaveValue(slug);
    await expect(dialogo(page).getByText('Quest log')).toBeVisible();
    await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(campo(page, 2)).toHaveValue(`E2E Game ${slug}`);
    await expect(campo(page, 2)).toBeFocused();
    await expect(toast(page)).toHaveAttribute('data-variant', 'success');
    await expect(toast(page)).toContainText('Checkpoint');
    await expect(toast(page)).toContainText(`Videogame creato: E2E Game ${slug}`);
    // l'episodio non è stato salvato e le modifiche di prima ci sono ancora
    await expect(page).toHaveURL(new RegExp(`/episodi/${e.id}$`));
    await expect(formModificato(page)).toHaveAttribute('data-modificato', 'true');
    await expect(page.getByLabel('Titolo')).toHaveValue(`${e.titolo} modificato`);
    await expect(campo(page, 1)).toHaveValue(gioco.titolo);
    expect((await leggiEpisodio(e.id)).associazioni).toHaveLength(1);
    const creato = await videogameConSlug(slug);
    expect(creato).toMatchObject({ titolo: `E2E Game ${slug}` });
    // SALVA: ora l'associazione c'è
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi$/);
    const salvato = await leggiEpisodio(e.id);
    expect(salvato.titolo).toBe(`${e.titolo} modificato`);
    expect(salvato.associazioni.map((a) => a.videogame_id)).toEqual(expect.arrayContaining([gioco.id, creato.id]));
  });

  test('da «Nuovo episodio»: stesso flusso fino al salvataggio dell\'episodio', async ({ page }) => {
    const t = token();
    const titolo = `[E2E] dlg nuovo ${t}`;
    await entra(page);
    await page.goto('/new-bo/episodi/nuovo');
    await page.getByLabel('Titolo').fill(titolo);
    await page.getByLabel('Data uscita').fill('2001-02-03');
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    const slug = `e2e-dlg-nuovo-${t}`;
    await cercaInesistente(page, 1, `E2E DLG nuovo ${t}`);
    await creaQui(page).click();
    await expect(dialogo(page).getByLabel('RAWG slug')).toHaveValue(slug);
    await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(campo(page, 1)).toHaveValue(`E2E Game ${slug}`);
    await expect(page.getByLabel('Titolo')).toHaveValue(titolo);
    await expect(page).toHaveURL(/\/episodi\/nuovo$/);
    await page.getByRole('button', { name: 'Crea', exact: true }).click();
    await expect(page).toHaveURL(/\/new-bo\/episodi\/\d+$/);
    const id = Number(page.url().split('/').pop());
    const creato = await videogameConSlug(slug);
    expect((await leggiEpisodio(id)).associazioni).toMatchObject([{ videogame_id: creato.id }]);
  });

  test('errore di RAWG: Toast sopra il Dialog, Dialog aperto, slug rosso, nessun videogame creato', async ({ page }) => {
    const t = token();
    const e = await nuovoEpisodio();
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    const slug = `e2e-missing-dlg-${t}`;
    await cercaInesistente(page, 1, `E2E missing dlg ${t}`);
    await creaQui(page).click();
    await expect(dialogo(page).getByLabel('RAWG slug')).toHaveValue(slug);
    await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(toast(page)).toContainText(`Gioco «${slug}» non trovato su RAWG`);
    await expect(dialogo(page)).toBeVisible();
    await expect(dialogo(page).getByLabel('RAWG slug')).toHaveAttribute('aria-invalid', 'true');
    // il Toast è sopra il Dialog: nel suo centro l'elemento in cima è il Toast
    await expect(toast(page)).toBeInViewport();
    const sopra = await toast(page).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    });
    expect(sopra).toBe(true);
    // il Toast si chiude con «✕» senza chiudere il Dialog
    await toast(page).getByRole('button', { name: "Chiudi l'avviso" }).click();
    await expect(toast(page)).toHaveCount(0);
    await expect(dialogo(page)).toBeVisible();
    expect(await videogameConSlug(slug)).toBeNull();
    // slug già usato
    await dialogo(page).getByLabel('RAWG slug').fill(gioco.rawg_slug);
    await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(toast(page)).toContainText('Esiste già un videogame con questo slug RAWG');
    await expect(dialogo(page)).toBeVisible();
    // ANNULLA chiude il Dialog e toglie il Toast d'errore; la riga è ancora senza videogame
    await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(toast(page)).toHaveCount(0);
    await expect(campo(page, 1)).toHaveValue('');
  });

  test('il solo gioco creato rende il form «modificato»', async ({ page }) => {
    const t = token();
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: gioco.id }] });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await expect(formModificato(page)).toHaveAttribute('data-modificato', 'false');
    await cercaInesistente(page, 1, `E2E dlg solo ${t}`);
    await creaQui(page).click();
    await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(campo(page, 1)).toHaveValue(`E2E Game e2e-dlg-solo-${t}`);
    await expect(formModificato(page)).toHaveAttribute('data-modificato', 'true');
  });

  test('mentre CREA DA RAWG è in corso il Dialog non si chiude; poi la riga riceve il gioco', async ({ page }) => {
    const t = token();
    const e = await nuovoEpisodio();
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    let rilascia;
    const trattenuta = new Promise((ok) => (rilascia = ok));
    await page.route('**/api/graphql', async (route) => {
      if ((route.request().postData() ?? '').includes('CreaVideogame')) {
        const res = await route.fetch();
        await trattenuta;
        await route.fulfill({ response: res });
      } else await route.fallback();
    });
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await cercaInesistente(page, 1, `E2E dlg attesa ${t}`);
    await creaQui(page).click();
    await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(dialogo(page).getByRole('button', { name: 'Attendi…' })).toBeVisible();
    await page.keyboard.press('Escape');
    await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
    await expect(dialogo(page)).toBeVisible();
    rilascia();
    await expect(dialogo(page)).toHaveCount(0);
    await expect(campo(page, 1)).toHaveValue(`E2E Game e2e-dlg-attesa-${t}`);
  });

  test('da tastiera: TAB porta a «+ CREALO QUI», INVIO apre il Dialog con il focus sullo slug', async ({ page }) => {
    const t = token();
    const e = await nuovoEpisodio();
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await cercaInesistente(page, 1, `E2E dlg tastiera ${t}`);
    await page.keyboard.press('Tab');
    await expect(creaQui(page)).toBeFocused();
    // ESC torna al campo, con l'elenco chiuso
    await page.keyboard.press('Escape');
    await expect(campo(page, 1)).toBeFocused();
    await expect(page.getByText('Nessun videogame trovato.')).toHaveCount(0);
    await campo(page, 1).fill(`E2E dlg tastiera ${t}`);
    await expect(page.getByText('Nessun videogame trovato.')).toBeVisible();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(dialogo(page)).toBeVisible();
    await expect(dialogo(page).getByLabel('RAWG slug')).toBeFocused();
    await expect(dialogo(page).getByLabel('RAWG slug')).toHaveValue(`e2e-dlg-tastiera-${t}`);
    await expect(dialogo(page)).toContainText("Il videogame finisce nella riga dell'episodio, che resta da salvare.");
  });

  test('ANNULLA, ESC, «✕» e il velo chiudono senza creare nulla; la riga resta com\'era e riprende il focus', async ({ page }) => {
    const t = token();
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: gioco.id }] });
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    const prova = async (n, chiudi) => {
      const cercato = `E2E dlg chiudi ${n} ${t}`;
      await cercaInesistente(page, 1, cercato);
      await creaQui(page).click();
      await expect(dialogo(page)).toBeVisible();
      // il Dialog ha finito di aprirsi (focus sullo slug) prima di chiuderlo
      await expect(dialogo(page).getByLabel('RAWG slug')).toBeFocused();
      await chiudi();
      await expect(dialogo(page)).toHaveCount(0);
      await expect(campo(page, 1)).toHaveValue(gioco.titolo);
      await expect(campo(page, 1)).toBeFocused();
      expect(await videogameConSlug(`e2e-dlg-chiudi-${n}-${t}`)).toBeNull();
    };
    await prova(1, () => dialogo(page).getByRole('button', { name: 'Annulla' }).click());
    await prova(2, () => page.keyboard.press('Escape'));
    await prova(3, () => dialogo(page).getByRole('button', { name: 'Chiudi', exact: true }).click());
    await prova(4, () => page.mouse.click(10, 10)); // sul velo, nel margine di 32 px
    await expect(formModificato(page)).toHaveAttribute('data-modificato', 'false');
    expect((await leggiEpisodio(e.id)).associazioni.map((a) => a.videogame_id)).toEqual([gioco.id]);
  });

  test('il Dialog occupa la viewport meno 32 px per lato e il contenuto scorre dentro', async ({ page }) => {
    const e = await nuovoEpisodio();
    await entra(page);
    await page.goto(`/new-bo/episodi/${e.id}`);
    await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
    await cercaInesistente(page, 1, `E2E dlg misure ${token()}`);
    await creaQui(page).click();
    const r = await dialogo(page).boundingBox();
    expect(r).toMatchObject({ x: 32, y: 32, width: 1440 - 64, height: 900 - 64 });
    const corpo = dialogo(page).locator('[data-slot=dialog-body]');
    expect(await corpo.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto');
  });
});

// --- Nei tre formati, con le fotografie per il gate ------------------------------------------

for (const formato of [390, 1180, 1440]) {
  test.describe(`dialog a ${formato}`, () => {
    test.use({ viewport: VIEWPORT[formato] });

    test('apertura dal Combobox, errore di RAWG e creazione', async ({ page }) => {
      const t = token();
      const e = await nuovoEpisodio({ associazioni: [{ videogame_id: gioco.id, istante: '0:01:00' }] });
      await entra(page);
      await page.goto(`/new-bo/episodi/${e.id}`);
      await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
      const slug = `e2e-dlg-${formato}-${t}`;
      await cercaInesistente(page, 2, `E2E dlg ${formato} ${t}`);
      await expect(creaQui(page)).toBeVisible();
      await foto(page, `combobox-crealo-qui-${formato}`);
      await creaQui(page).click();
      await expect(dialogo(page)).toBeVisible();
      const r = await dialogo(page).boundingBox();
      if (formato === 390) expect(r).toMatchObject({ x: 0, y: 0, width: 390, height: 844 });
      else expect(r).toMatchObject({ x: 32, y: 32, width: formato - 64 });
      await expect(dialogo(page).getByLabel('RAWG slug')).toHaveValue(slug);
      await foto(page, `dialog-aperto-${formato}`);
      // errore di RAWG
      const mancante = `e2e-missing-dlg-${formato}-${t}`;
      await dialogo(page).getByLabel('RAWG slug').fill(mancante);
      await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
      await expect(toast(page)).toContainText(`Gioco «${mancante}» non trovato su RAWG`);
      await expect(dialogo(page)).toBeVisible();
      await foto(page, `dialog-errore-${formato}`);
      // il Toast non copre lo slug né i bottoni: si corregge con un clic sul campo
      const campoSlug = dialogo(page).getByLabel('RAWG slug');
      await campoSlug.scrollIntoViewIfNeeded();
      const [rt, rs, rb] = await Promise.all([
        toast(page).boundingBox(),
        campoSlug.boundingBox(),
        dialogo(page).getByTestId('barra-azioni').boundingBox(),
      ]);
      const sovrapposti = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(sovrapposti(rt, rs)).toBe(false);
      expect(sovrapposti(rt, rb)).toBe(false);
      // creazione
      await campoSlug.click();
      await campoSlug.fill(slug);
      await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
      await expect(dialogo(page)).toHaveCount(0);
      await expect(campo(page, 2)).toHaveValue(`E2E Game ${slug}`);
      await expect(campo(page, 2)).toBeFocused();
      await expect(toast(page)).toContainText(`Videogame creato: E2E Game ${slug}`);
      await page.mouse.move(0, 0);
      await foto(page, `riga-con-gioco-creato-${formato}`);
      expect(await videogameConSlug(slug)).not.toBeNull();
      expect(await videogameConSlug(mancante)).toBeNull();
    });
  });
}

for (const formato of [390, 1180]) {
  test.describe(`nuovo episodio a ${formato}`, () => {
    test.use({ viewport: VIEWPORT[formato] });

    test('dal Combobox di «Nuovo episodio» al salvataggio dell\'episodio', async ({ page }) => {
      const t = token();
      const titolo = `[E2E] dlg nuovo ${formato} ${t}`;
      await entra(page);
      await page.goto('/new-bo/episodi/nuovo');
      await page.getByLabel('Titolo').fill(titolo);
      await page.getByLabel('Data uscita').fill('2001-02-03');
      await page.getByRole('button', { name: '+ Aggiungi videogame' }).click();
      const slug = `e2e-dlg-nuovo-${formato}-${t}`;
      await cercaInesistente(page, 1, `E2E dlg nuovo ${formato} ${t}`);
      await creaQui(page).click();
      await expect(dialogo(page).getByLabel('RAWG slug')).toHaveValue(slug);
      await dialogo(page).getByRole('button', { name: 'Crea da RAWG' }).click();
      await expect(dialogo(page)).toHaveCount(0);
      await expect(campo(page, 1)).toHaveValue(`E2E Game ${slug}`);
      await expect(page.getByLabel('Titolo')).toHaveValue(titolo);
      await page.getByRole('button', { name: 'Crea', exact: true }).click();
      await expect(page).toHaveURL(/\/new-bo\/episodi\/\d+$/);
      const id = Number(page.url().split('/').pop());
      const creato = await videogameConSlug(slug);
      expect((await leggiEpisodio(id)).associazioni).toMatchObject([{ videogame_id: creato.id }]);
    });
  });
}
