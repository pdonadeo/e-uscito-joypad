// Test e2e dei videogame di /bo (Fase 3.6c.3a): F-VG-01 … F-VG-08 e F-AS-01 («Episodi in
// cui è citato»), SALVA E CONTINUA. Girano con playwright.api.config.js, come le altre spec
// new-bo-e2e*. I videogame si creano via GraphQL con il finto RAWG della suite
// (tests/api/mock-rawg.js: titolo «E2E Game <slug>», cover https://media.example.com/<slug>.jpg;
// gli slug «e2e-missing…» danno 404, «e2e-broken…» un JSON non valido) e si cercano con un token
// unico per test. Elenco e modifica si provano a 390, 1180 e 1440.
const zlib = require('node:zlib');
const { test, expect } = require('@playwright/test');
const { API_URL, USERS, django } = require('./env');
const { loggedIn, uniq, rawgCalls } = require('./helpers');
const {
  parseRawg,
  creaVideogame,
  aggiornaVideogame,
  leggiVideogame,
  creaEpisodio,
  leggiEpisodio,
} = require('./gql-helpers');

// Il browser manda la sua Origin vera; le chiamate di page.request la mettono a mano (V-01).
test.use({ extraHTTPHeaders: {} });
const ORIGIN = { Origin: API_URL };

const VIEWPORT = {
  390: { width: 390, height: 844 },
  1180: { width: 1180, height: 820 },
  1440: { width: 1440, height: 900 },
};

let api; // sessione dello staff per fixture e verifiche (GraphQL)

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
});

test.afterAll(async () => {
  await api.dispose();
});

// Le cover del finto RAWG puntano a media.example.com: il browser riceve un PNG pieno, così le
// miniature e le fotografie mostrano un'immagine vera.
function pngPieno(r, g, b) {
  const chunk = (tipo, dati) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(dati.length);
    const corpo = Buffer.concat([Buffer.from(tipo), dati]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(corpo));
    return Buffer.concat([len, corpo, crc]);
  };
  const [w, h] = [16, 9];
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const riga = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  const idat = zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => riga)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const COLORI = [
  [0xff, 0xd8, 0x4d],
  [0xff, 0x7a, 0xb6],
  [0x8f, 0xcb, 0xff],
  [0x6c, 0xc9, 0x7e],
  [0xd6, 0x3a, 0x5a],
];

test.beforeEach(async ({ page }) => {
  await page.route('https://media.example.com/**', (route) => {
    const n = [...route.request().url()].reduce((s, c) => s + c.charCodeAt(0), 0);
    return route.fulfill({ contentType: 'image/png', body: pngPieno(...COLORI[n % COLORI.length]) });
  });
});

// --- aiuti ------------------------------------------------------------------------------------

async function entra(page, user = USERS.staff) {
  await page.goto('/bo/login');
  await page.getByLabel('Nome utente').fill(user.username);
  await page.getByLabel("Parola d'ordine").fill(user.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page).toHaveURL(/\/bo\/episodi$/);
}

// Un videogame creato via GraphQL dal finto RAWG; `modifiche` (titolo, cover, …) con
// aggiornaVideogame dopo. rawg_json torna oggetto (in GraphQL è JSON serializzato).
async function nuovoVideogame(slug, modifiche) {
  const v = await creaVideogame(api, { rawg_slug: slug });
  if (!modifiche) return parseRawg(v);
  return parseRawg(await aggiornaVideogame(api, v.id, { ...v, ...modifiche }));
}

// { status: 200, body } se il videogame c'è, { status: 404, body: null } se non c'è.
async function leggi(id) {
  const v = await leggiVideogame(api, id);
  return v ? { status: 200, body: parseRawg(v) } : { status: 404, body: null };
}

const nuovoEpisodio = (extra = {}) =>
  creaEpisodio(api, { titolo: `[E2E] vg ${uniq()}`, data_uscita: '2001-01-01', durata: '1:00:00', ...extra });

async function gqlSessione(page, query, variables) {
  const res = await page.request.post('/api/graphql', { data: { query, variables }, headers: ORIGIN });
  expect(res.status()).toBe(200);
  return res.json();
}

const token = () => `nbvg${uniq().replace(/-/g, '')}`;
const elenco = (page, t, extra = '') => page.goto(`/bo/videogame?ricerca=${encodeURIComponent(t)}${extra}`);
const righe = (page) => page.locator('tbody tr[data-cliccabile]');
const schede = (page) => page.locator('main section[data-slot=card]');
// il Toast visibile: quello sostituito resta nel DOM durante l'uscita, con data-removed
const toast = (page) => page.locator('[data-sonner-toast]:not([data-removed=true]) [data-slot=toast]');
const barra = (page) => page.getByTestId('barra-azioni');
const salvaEContinua = (page) => page.getByRole('button', { name: 'Salva e continua' });
const aggiornato = (page) =>
  page.waitForResponse((r) => r.url().endsWith('/api/graphql') && (r.request().postData() ?? '').includes('AggiornaVideogame'));
const dialogo = (page) => page.getByRole('alertdialog');

// Fotografie per il gate, in test-results/…: su desktop la pagina intera dall'alto; a 390, dove
// la barra delle azioni è fissa in basso, lo schermo in cima e in fondo (con un dialogo aperto,
// solo lo schermo).
async function foto(page, nome) {
  const percorso = (n) => test.info().outputPath(`${n}.png`);
  // a animazioni finite (dialogo e Toast entrano in dissolvenza)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  if ((await dialogo(page).count()) > 0) return page.screenshot({ path: percorso(nome) });
  await page.evaluate(() => window.scrollTo(0, 0));
  if (page.viewportSize().width > 390) return page.screenshot({ path: percorso(nome), fullPage: true });
  await page.screenshot({ path: percorso(`${nome}-alto`) });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: percorso(`${nome}-basso`) });
}

// fotografia a entrata finita (sonner anima l'opacità)
async function attendiToast(page) {
  await expect(page.locator('[data-sonner-toast]:not([data-removed=true])')).toHaveCSS('opacity', '1');
}

// --- Elenco (F-VG-01 … F-VG-03, F-VG-07 in blocco) ------------------------------------------

test.describe('elenco a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-VG-01: miniatura della cover, titolo e slug; 10 righe di default; clic sulla riga → modifica', async ({ page }) => {
    const t = token();
    const a = await nuovoVideogame(`e2e-${t}-a`);
    const b = await nuovoVideogame(`e2e-${t}-b`, { cover: null });
    await entra(page);
    await elenco(page, t);
    await expect(righe(page)).toHaveCount(2);
    await expect(page.getByRole('combobox', { name: 'Righe per pagina' })).toHaveText(/10/);
    const prima = righe(page).nth(0);
    await expect(prima).toContainText(a.titolo);
    await expect(prima).toContainText(a.rawg_slug);
    await expect(prima.locator('img')).toHaveAttribute('src', a.cover);
    await expect(righe(page).nth(1).getByTestId('miniatura-vuota')).toBeVisible();
    await expect(righe(page).nth(1)).toContainText(b.rawg_slug);
    await expect(page.getByRole('columnheader', { name: 'Cover' })).toBeVisible();
    await expect(page.getByText('1–2 di 2')).toBeVisible();
    await righe(page).nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/bo/videogame/${b.id}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(b.titolo);
  });

  test('F-VG-01: righe per pagina e pagine', async ({ page }) => {
    const t = token();
    for (let i = 0; i < 11; i++) await nuovoVideogame(`e2e-${t}-${String(i).padStart(2, '0')}`);
    await entra(page);
    await elenco(page, t);
    await expect(righe(page)).toHaveCount(10);
    await expect(page.getByText('1–10 di 11')).toBeVisible();
    await page.getByRole('button', { name: 'Pagina 2' }).click();
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(`e2e-${t}-10`);
    await page.getByRole('combobox', { name: 'Righe per pagina' }).click();
    await page.getByRole('option', { name: '20', exact: true }).click();
    await expect(righe(page)).toHaveCount(11);
    await expect(page).toHaveURL(/righe=20/);
  });

  test('F-VG-02: default titolo crescente; titolo e slug ordinano nei due versi, la cover no', async ({ page }) => {
    const t = token();
    // titoli in ordine opposto agli slug
    await nuovoVideogame(`e2e-${t}-a`, { titolo: `Zeta ${t}` });
    await nuovoVideogame(`e2e-${t}-b`, { titolo: `Alfa ${t}` });
    await entra(page);
    await elenco(page, t);
    const titoli = () => righe(page).locator('td:nth-child(3)');
    await expect(titoli()).toHaveText([`Alfa ${t}`, `Zeta ${t}`]);
    await expect(page.getByRole('columnheader', { name: /Titolo/ })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'Titolo' }).click();
    await expect(titoli()).toHaveText([`Zeta ${t}`, `Alfa ${t}`]);
    await page.getByRole('button', { name: 'RAWG slug' }).click();
    await expect(titoli()).toHaveText([`Zeta ${t}`, `Alfa ${t}`]);
    await expect(page.getByRole('columnheader', { name: /RAWG slug/ })).toHaveAttribute('aria-sort', 'ascending');
    await page.getByRole('button', { name: 'RAWG slug' }).click();
    await expect(titoli()).toHaveText([`Alfa ${t}`, `Zeta ${t}`]);
    await expect(page.getByRole('columnheader', { name: 'Cover' }).getByRole('button')).toHaveCount(0);
  });

  test('F-VG-03: la ricerca è «contiene», senza maiuscole, su titolo, descrizione e slug', async ({ page }) => {
    const t = token();
    const a = await nuovoVideogame(`e2e-${t}-a`, { titolo: `Gioco Titolato ${t}`, descrizione_raw: 'niente' });
    const b = await nuovoVideogame(`e2e-${t}-b`, { titolo: `Altro ${t}`, descrizione_raw: `parola${t}magica` });
    await entra(page);
    await page.goto('/bo/videogame');
    const cerca = page.getByRole('searchbox', { name: 'Cerca per titolo, descrizione o slug' });
    await cerca.fill(`titolato ${t}`.toUpperCase());
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(a.titolo);
    await cerca.fill(`${t}MAGICA`);
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(b.titolo);
    await cerca.fill(`${t}-b`);
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(b.rawg_slug);
    await expect(page).toHaveURL(new RegExp(`ricerca=${t}-b`));
  });

  test('F-VG-01: una riga pari selezionata è viola-100 e non crema; l\'hover vince sulla zebra', async ({ page }) => {
    const t = token();
    await nuovoVideogame(`e2e-${t}-a`);
    const b = await nuovoVideogame(`e2e-${t}-b`);
    await nuovoVideogame(`e2e-${t}-c`);
    await nuovoVideogame(`e2e-${t}-d`);
    await entra(page);
    await elenco(page, t);
    await expect(righe(page)).toHaveCount(4);
    const pari = righe(page).nth(1); // seconda riga: pari, a zebra crema
    await page.mouse.move(0, 0);
    await expect(pari).toHaveCSS('background-color', 'rgb(255, 248, 231)'); // crema
    await page.getByRole('checkbox', { name: `Seleziona il videogame ${b.titolo}` }).check();
    await page.mouse.move(0, 0);
    await expect(pari).toHaveCSS('background-color', 'rgb(233, 230, 255)'); // viola-100
    // hover su una riga pari non selezionata (la quarta)
    await righe(page).nth(3).hover();
    await expect(righe(page).nth(3)).toHaveCSS('background-color', 'rgb(243, 241, 255)'); // viola-50
  });

  test('F-VG-07: eliminazione in blocco con conferma e il testo dei «collegamenti»', async ({ page }) => {
    const t = token();
    const a = await nuovoVideogame(`e2e-${t}-a`);
    const b = await nuovoVideogame(`e2e-${t}-b`);
    const c = await nuovoVideogame(`e2e-${t}-c`);
    const e = await nuovoEpisodio({ associazioni: [{ videogame_id: a.id }] });
    await entra(page);
    await elenco(page, t);
    await page.getByRole('checkbox', { name: `Seleziona il videogame ${a.titolo}` }).check();
    await page.getByRole('checkbox', { name: `Seleziona il videogame ${b.titolo}` }).check();
    await expect(page.getByText('2 videogame selezionati')).toBeVisible();
    await page.getByRole('button', { name: 'Elimina selezionati' }).click();
    await expect(dialogo(page)).toContainText('Eliminare 2 videogame?');
    await expect(dialogo(page)).toContainText(
      "Stai per eliminare 2 videogame e tutti i loro collegamenti agli episodi in cui sono citati. Gli episodi restano nell'archivio.",
    );
    await expect(dialogo(page).getByRole('button', { name: 'Annulla' })).toBeFocused();
    await foto(page, 'elenco-videogame-conferma-blocco-1440');
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(c.titolo);
    expect((await leggi(a.id)).status).toBe(404);
    expect((await leggi(b.id)).status).toBe(404);
    // l'episodio resta, senza l'associazione
    const ep = await leggiEpisodio(api, e.id);
    expect(ep.associazioni).toEqual([]);
  });
});

test.describe('elenco a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('F-VG-01, F-VG-03: tabella con la ricerca e la Sidebar a rotaia', async ({ page }) => {
    const t = token();
    const a = await nuovoVideogame(`e2e-${t}-a`);
    await entra(page);
    await page.getByRole('link', { name: 'Videogame' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Videogame');
    await page.getByRole('searchbox').fill(t);
    await expect(righe(page)).toHaveCount(1);
    await expect(righe(page).first()).toContainText(a.rawg_slug);
    await expect(page.getByRole('link', { name: '+ Nuovo videogame' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1180);
  });
});

test.describe('elenco a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('F-VG-01, F-VG-02: schede con miniatura, ORDINA e paginazione mobile', async ({ page }) => {
    const t = token();
    await nuovoVideogame(`e2e-${t}-a`, { titolo: `Zeta ${t}` });
    const b = await nuovoVideogame(`e2e-${t}-b`, { titolo: `Alfa ${t}`, cover: null });
    await entra(page);
    await elenco(page, t);
    await expect(page.locator('table')).toHaveCount(0);
    await expect(schede(page)).toHaveCount(2);
    await expect(schede(page).first()).toContainText(`Alfa ${t}`);
    await expect(schede(page).first()).toContainText(`${b.rawg_slug} · senza cover`);
    await expect(page.getByText('Pagina 1 di 1')).toBeVisible();
    await page.getByRole('combobox', { name: /Ordina/ }).click();
    await page.getByRole('option', { name: 'Slug, A → Z' }).click();
    await expect(schede(page).first()).toContainText(`Zeta ${t}`);
    await expect(page.getByRole('link', { name: '+ Nuovo' })).toBeVisible();
    await schede(page).nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/bo/videogame/${b.id}$`));
  });

  test('F-VG-07: in blocco a 390, con il singolare', async ({ page }) => {
    const t = token();
    const a = await nuovoVideogame(`e2e-${t}-a`);
    await nuovoVideogame(`e2e-${t}-b`);
    await entra(page);
    await elenco(page, t);
    await page.getByRole('checkbox', { name: `Seleziona il videogame ${a.titolo}` }).check();
    await expect(page.getByText('1 selezionato')).toBeVisible();
    await page.getByRole('button', { name: 'Elimina', exact: true }).click();
    await expect(dialogo(page)).toContainText('Eliminare 1 videogame?');
    await expect(dialogo(page)).toContainText(
      "Stai per eliminare 1 videogame e tutti i suoi collegamenti agli episodi in cui è citato. Gli episodi restano nell'archivio.",
    );
    await foto(page, 'elenco-videogame-conferma-blocco-390');
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(schede(page)).toHaveCount(1);
    expect((await leggi(a.id)).status).toBe(404);
  });
});

// --- Nuovo videogame (F-VG-05) --------------------------------------------------------------

test.describe('nuovo videogame a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-VG-05: solo lo slug; CREA DA RAWG prende i dati da RAWG e apre la modifica', async ({ page }) => {
    const slug = `e2e-${token()}-nuovo`;
    await entra(page);
    await page.goto('/bo/videogame');
    await page.getByRole('link', { name: '+ Nuovo videogame' }).click();
    await expect(page).toHaveURL(/\/bo\/videogame\/nuovo$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nuovo videogame');
    for (const nome of ['Titolo', 'Descrizione (TXT)', 'Descrizione (HTML)', 'Cover (URL)']) {
      await expect(page.getByLabel(nome)).toBeDisabled();
      await expect(page.getByLabel(nome)).toHaveAttribute('placeholder', 'arriva da RAWG');
    }
    await expect(page.getByRole('note')).toHaveText('Non compilare manualmente: viene preso da RAWG');
    await expect(page.getByText('Quest log')).toBeVisible();
    await expect(page.getByText('rawg.io/games/')).toBeVisible();
    await expect(salvaEContinua(page)).toHaveCount(0);
    await page.getByLabel('RAWG slug').fill(slug);
    const prima = await rawgCalls(page.request);
    await page.getByRole('button', { name: 'Crea da RAWG' }).click();
    await expect(page).toHaveURL(/\/bo\/videogame\/\d+$/);
    expect(await rawgCalls(page.request)).toBe(prima + 1);
    const id = Number(page.url().split('/').pop());
    const { body } = await leggi(id);
    expect(body).toMatchObject({
      rawg_slug: slug,
      titolo: `E2E Game ${slug}`,
      descrizione_raw: `Descrizione di ${slug}`,
      cover: `https://media.example.com/${slug}.jpg`,
    });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`E2E Game ${slug}`);
    await expect(page.getByLabel('Titolo')).toHaveValue(`E2E Game ${slug}`);
    await expect(page.getByTestId('rawg-json')).toContainText(`"slug": "${slug}"`);
  });

  test('F-VG-05: gli errori di RAWG e lo slug già usato vanno nel Toast, lo slug diventa rosso', async ({ page }) => {
    const esistente = await nuovoVideogame(`e2e-${token()}-dup`);
    await entra(page);
    await page.goto('/bo/videogame/nuovo');
    const slug = page.getByLabel('RAWG slug');
    const crea = page.getByRole('button', { name: 'Crea da RAWG' });
    const mancante = `e2e-missing-${token()}`;
    await slug.fill(mancante);
    await crea.click();
    await expect(toast(page)).toContainText('Missione fallita');
    await expect(toast(page)).toContainText(`Gioco «${mancante}» non trovato su RAWG`);
    await expect(slug).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/videogame\/nuovo$/);
    await attendiToast(page);
    await foto(page, 'nuovo-videogame-errore-1440');
    // cambiando lo slug torna normale
    await slug.fill(`e2e-broken-${token()}`);
    await expect(slug).not.toHaveAttribute('aria-invalid', 'true');
    await crea.click();
    await expect(toast(page)).toContainText('Risposta RAWG non valida');
    await expect(slug).not.toHaveAttribute('aria-invalid', 'true');
    await slug.fill(esistente.rawg_slug);
    await crea.click();
    await expect(toast(page)).toContainText('Esiste già un videogame con questo slug RAWG');
    await expect(slug).toHaveAttribute('aria-invalid', 'true');
    // ANNULLA torna all'elenco
    await barra(page).getByRole('button', { name: 'Annulla' }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
  });
});

test.describe('nuovo videogame nei tre formati', () => {
  for (const formato of [390, 1180, 1440]) {
    test(`F-VG-05 a ${formato}: prima dell'invio e Toast d'errore di RAWG`, async ({ page }) => {
      await page.setViewportSize(VIEWPORT[formato]);
      await entra(page);
      await page.goto('/bo/videogame/nuovo');
      const mancante = `e2e-missing-${formato}`;
      await page.getByLabel('RAWG slug').fill(mancante);
      if (formato === 390) await expect(page.getByText('rawg.io/games/')).toHaveCount(0);
      await foto(page, `nuovo-videogame-prima-${formato}`);
      await page.getByRole('button', { name: 'Crea da RAWG' }).click();
      await expect(toast(page)).toContainText(`Gioco «${mancante}» non trovato su RAWG`);
      await attendiToast(page);
      await foto(page, `nuovo-videogame-errore-${formato}`);
    });
  }
});

// --- Modifica videogame (F-VG-04, F-VG-06, F-VG-07, F-VG-08, F-AS-01) ----------------------

test.describe('modifica a 1440', () => {
  test.use({ viewport: VIEWPORT[1440] });

  test('F-VG-04: il form parte dal dettaglio; rawg_json in sola lettura, al massimo 400 px, senza allargare la pagina', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-dett`, { descrizione_html: '<p>Html</p>' });
    // rawg_json lungo, con una stringa senza spazi, scritto direttamente nel DB
    const lungo = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`campo_${i}`, `valore ${i}`]));
    lungo.senza_spazi = 'x'.repeat(600);
    django(
      `import json\nfrom backoffice.models import Videogame\nVideogame.objects.filter(id=${v.id}).update(rawg_json=json.loads(${JSON.stringify(JSON.stringify(lungo))}))\n`,
    );
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(v.titolo);
    await expect(page.getByLabel('RAWG slug')).toHaveValue(v.rawg_slug);
    await expect(page.getByLabel('Titolo')).toHaveValue(v.titolo);
    await expect(page.getByLabel('Descrizione (TXT)')).toHaveValue(v.descrizione_raw);
    await expect(page.getByLabel('Descrizione (HTML)')).toHaveValue('<p>Html</p>');
    await expect(page.getByLabel('Cover (URL)')).toHaveValue(v.cover);
    await expect(page.getByTestId('anteprima-cover').locator('img')).toHaveAttribute('src', v.cover);
    await expect(page.getByTestId('stato-rawg')).toContainText('Dati RAWG già presenti');
    const json = page.getByTestId('rawg-json');
    await expect(json).toContainText('"campo_59": "valore 59"');
    expect(await json.evaluate((el) => [el.tagName, el.isContentEditable])).toEqual(['PRE', false]);
    const misure = await json.evaluate((el) => ({ h: el.clientHeight, sh: el.scrollHeight, sw: el.scrollWidth, cw: el.clientWidth }));
    expect(misure.h).toBeLessThanOrEqual(400);
    expect(misure.sh).toBeGreaterThan(misure.h); // scorre
    expect(misure.sw).toBeLessThanOrEqual(misure.cw); // va a capo
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  });

  test('F-VG-06: con rawg_json presente salva i campi senza interrogare RAWG, poi torna all\'elenco', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-mod`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    const nuovoSlug = `${v.rawg_slug}-bis`;
    await page.getByLabel('RAWG slug').fill(nuovoSlug);
    await page.getByLabel('Titolo').fill('Titolo scritto a mano');
    await page.getByLabel('Descrizione (TXT)').fill('');
    await page.getByLabel('Cover (URL)').fill('https://media.example.com/altra.png');
    const prima = await rawgCalls(page.request);
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
    expect(await rawgCalls(page.request)).toBe(prima);
    const { body } = await leggi(v.id);
    expect(body).toMatchObject({
      rawg_slug: nuovoSlug,
      titolo: 'Titolo scritto a mano',
      descrizione_raw: null,
      cover: 'https://media.example.com/altra.png',
    });
    expect(body.rawg_json).toEqual(v.rawg_json);
  });

  test('F-VG-06: senza rawg_json il salvataggio interroga RAWG, che sovrascrive titolo, descrizioni e cover', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-senza`);
    django(`from backoffice.models import Videogame\nVideogame.objects.filter(id=${v.id}).update(rawg_json=None)\n`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByTestId('stato-rawg')).toContainText('Dati RAWG assenti');
    await expect(page.getByTestId('rawg-json')).toHaveCount(0);
    await page.getByLabel('Titolo').fill('Verrà sovrascritto');
    const prima = await rawgCalls(page.request);
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
    expect(await rawgCalls(page.request)).toBe(prima + 1);
    const { body } = await leggi(v.id);
    expect(body.titolo).toBe(`E2E Game ${v.rawg_slug}`);
    expect(body.rawg_json).toMatchObject({ slug: v.rawg_slug });
  });

  test('F-VG-06: un errore del server va nel Toast e si resta sulla pagina', async ({ page }) => {
    const altro = await nuovoVideogame(`e2e-${token()}-occupato`);
    const v = await nuovoVideogame(`e2e-${token()}-err`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await page.getByLabel('RAWG slug').fill(altro.rawg_slug);
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(toast(page)).toContainText('Esiste già un videogame con questo slug RAWG');
    await expect(page).toHaveURL(new RegExp(`/videogame/${v.id}$`));
    expect((await leggi(v.id)).body.rawg_slug).toBe(v.rawg_slug);
  });

  test('F-VG-07: elimina dalla modifica, con il numero dei collegamenti; ANNULLA non cancella', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-del`);
    const e1 = await nuovoEpisodio({ associazioni: [{ videogame_id: v.id }] });
    await nuovoEpisodio({ associazioni: [{ videogame_id: v.id }] });
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByText('Episodi in cui è citato · 2')).toBeVisible();
    await barra(page).getByRole('button', { name: 'Elimina videogame' }).click();
    await expect(dialogo(page)).toContainText('Eliminare il videogame?');
    await expect(dialogo(page)).toContainText(
      `Stai per eliminare «${v.titolo}» e i suoi 2 collegamenti agli episodi in cui è citato. Gli episodi restano nell'archivio.`,
    );
    await expect(dialogo(page)).toContainText('Non si può annullare');
    await foto(page, 'modifica-videogame-conferma-1440');
    await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
    await expect(dialogo(page)).toHaveCount(0);
    expect((await leggi(v.id)).status).toBe(200);
    await barra(page).getByRole('button', { name: 'Elimina videogame' }).click();
    await dialogo(page).getByRole('button', { name: 'Elimina' }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
    expect((await leggi(v.id)).status).toBe(404);
    const ep = await leggiEpisodio(api, e1.id);
    expect(ep.associazioni).toEqual([]);
  });

  test('F-VG-07: con 0 collegamenti la frase finisce dopo il titolo', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-zero`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByText('Episodi in cui è citato · 0')).toBeVisible();
    await expect(page.getByText('Nessun episodio cita questo videogame.')).toBeVisible();
    await barra(page).getByRole('button', { name: 'Elimina videogame' }).click();
    await expect(dialogo(page).getByText(`Stai per eliminare «${v.titolo}».`, { exact: true })).toBeVisible();
  });

  test('F-VG-08: episodi citati per data decrescente, sola lettura, clic sulla riga → modifica dell\'episodio', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-cit`);
    const vecchio = await nuovoEpisodio({ episodio_numero: '198', data_uscita: '2024-09-05', associazioni: [{ videogame_id: v.id, istante: '0:08:45', tipologia: 'CONS' }] });
    const nuovo = await nuovoEpisodio({ episodio_numero: '312', data_uscita: '2026-11-12', associazioni: [{ videogame_id: v.id, istante: '0:12:30', tipologia: 'RECE' }] });
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    const tabella = page.getByTestId('episodi-citati');
    await expect(tabella).toContainText('Episodi in cui è citato · 2');
    await expect(tabella).toContainText("Sola lettura: i collegamenti si modificano dall'episodio");
    await expect(tabella.getByRole('columnheader')).toHaveText(['N°', 'Episodio', 'Data uscita', 'Istante', 'Tipologia', 'Apri']);
    await expect(tabella.getByRole('columnheader', { name: 'Data uscita' })).toHaveAttribute('aria-sort', 'descending');
    const r = tabella.locator('tbody tr');
    await expect(r).toHaveCount(2);
    await expect(r.nth(0)).toContainText(['312', nuovo.titolo, '2026-11-12', '0:12:30', 'Recensione'].join(''));
    await expect(r.nth(1)).toContainText(['198', vecchio.titolo, '2024-09-05', '0:08:45', 'Consiglio'].join(''));
    await expect(tabella.locator('input, select, textarea')).toHaveCount(0);
    await expect(tabella).toContainText('1–2 di 2 · 25 per pagina');
    await r.nth(1).click();
    await expect(page).toHaveURL(new RegExp(`/bo/episodi/${vecchio.id}$`));
  });

  test('F-VG-08: 25 righe per pagina', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-pag`);
    // un episodio con 26 associazioni allo stesso videogame
    await nuovoEpisodio({
      associazioni: Array.from({ length: 26 }, (_, i) => ({ videogame_id: v.id, istante: `0:${String(i).padStart(2, '0')}:00` })),
    });
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    const tabella = page.getByTestId('episodi-citati');
    await expect(tabella.locator('tbody tr')).toHaveCount(25);
    await expect(tabella).toContainText('1–25 di 26 · 25 per pagina');
    // a parità di data, istante decrescente
    await expect(tabella.locator('tbody tr').first()).toContainText('0:25:00');
    await tabella.getByRole('button', { name: 'Pagina successiva' }).click();
    await expect(tabella.locator('tbody tr')).toHaveCount(1);
    await expect(tabella).toContainText('26–26 di 26');
    await expect(tabella.locator('tbody tr').first()).toContainText('0:00:00');
  });

  test('F-AS-01: la tabella è l\'elenco delle associazioni filtrato per videogame', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-as`);
    const altro = await nuovoVideogame(`e2e-${token()}-as-altro`);
    await nuovoEpisodio({ data_uscita: '2020-01-01', associazioni: [{ videogame_id: v.id, istante: '0:01:00', tipologia: 'STAR' }, { videogame_id: altro.id }] });
    await nuovoEpisodio({ data_uscita: '2021-01-01', associazioni: [{ videogame_id: v.id, istante: '0:02:00' }] });
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    const r = await gqlSessione(
      page,
      `query($v: Int) { elencoAssociazioni(videogame_id: $v, ordinamento: DATA_USCITA, direzione: DESC) {
        totale elementi { videogame_id episodio_titolo data_uscita istante tipologia } } }`,
      { v: v.id },
    );
    expect(r.errors).toBeUndefined();
    expect(r.data.elencoAssociazioni.totale).toBe(2);
    expect(r.data.elencoAssociazioni.elementi.every((a) => a.videogame_id === v.id)).toBe(true);
    const righeTabella = page.getByTestId('episodi-citati').locator('tbody tr');
    await expect(righeTabella).toHaveCount(2);
    const attese = r.data.elencoAssociazioni.elementi.map((a) => a.episodio_titolo);
    await expect(righeTabella.locator('td:nth-child(2)')).toHaveText(attese);
    await expect(righeTabella.nth(1)).toContainText('Osservatorio Start Citizen');
  });

  test('SALVA E CONTINUA: resta sulla modifica, mostra il Toast e il form riparte dai dati salvati', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-sec`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    const form = page.locator('form');
    await expect(form).toHaveAttribute('data-modificato', 'false');
    await page.getByLabel('Titolo').fill(`${v.titolo} bis`);
    await page.getByLabel('Descrizione (HTML)').fill('');
    await expect(form).toHaveAttribute('data-modificato', 'true');
    const prima = await rawgCalls(page.request);
    let risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await risposta;
    await expect(toast(page)).toHaveAttribute('data-variant', 'success');
    await expect(toast(page)).toContainText('Checkpoint');
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page).toHaveURL(new RegExp(`/bo/videogame/${v.id}$`));
    await expect(form).toHaveAttribute('data-modificato', 'false');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${v.titolo} bis`);
    await expect(page.getByLabel('Titolo')).toHaveValue(`${v.titolo} bis`);
    await expect(page.getByLabel('Descrizione (HTML)')).toHaveValue('');
    expect((await leggi(v.id)).body).toMatchObject({ titolo: `${v.titolo} bis`, descrizione_html: null });
    // un secondo invio senza modifiche: stesso risultato, RAWG mai interrogato
    await toast(page).getByRole('button', { name: "Chiudi l'avviso" }).click();
    await expect(toast(page)).toHaveCount(0);
    risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await risposta;
    await expect(toast(page)).toContainText('Modifiche salvate');
    expect(await rawgCalls(page.request)).toBe(prima);
    expect((await leggi(v.id)).body.titolo).toBe(`${v.titolo} bis`);
  });

  test('SALVA E CONTINUA senza rawg_json: il form mostra i dati arrivati da RAWG', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-sec-rawg`, { titolo: 'Scritto a mano' });
    django(`from backoffice.models import Videogame\nVideogame.objects.filter(id=${v.id}).update(rawg_json=None)\n`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByTestId('stato-rawg')).toContainText('Dati RAWG assenti');
    await expect(page.getByLabel('Titolo')).toHaveValue('Scritto a mano');
    const risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await risposta;
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page).toHaveURL(new RegExp(`/bo/videogame/${v.id}$`));
    await expect(page.getByLabel('Titolo')).toHaveValue(`E2E Game ${v.rawg_slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`E2E Game ${v.rawg_slug}`);
    await expect(page.getByTestId('stato-rawg')).toContainText('Dati RAWG già presenti');
    await expect(page.getByTestId('rawg-json')).toContainText(`"slug": "${v.rawg_slug}"`);
    await expect(page.locator('form')).toHaveAttribute('data-modificato', 'false');
  });

  test('SALVA E CONTINUA: le modifiche fatte durante l\'invio restano nel form', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-sec-durante`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    // trattiene la risposta di aggiornaVideogame finché il test non scrive nel campo
    let rilascia;
    const trattenuta = new Promise((ok) => (rilascia = ok));
    await page.route('**/api/graphql', async (route) => {
      if ((route.request().postData() ?? '').includes('AggiornaVideogame')) {
        const res = await route.fetch();
        await trattenuta;
        await route.fulfill({ response: res });
      } else await route.fallback();
    });
    await page.getByLabel('Titolo').fill(`${v.titolo} uno`);
    const risposta = aggiornato(page);
    await salvaEContinua(page).click();
    await expect(salvaEContinua(page)).toHaveCount(0); // mostra «Attendi…»
    await page.getByLabel('Descrizione (TXT)').fill('scritta durante il salvataggio');
    rilascia();
    await risposta;
    await expect(toast(page)).toContainText('Modifiche salvate');
    await expect(page.getByLabel('Titolo')).toHaveValue(`${v.titolo} uno`);
    await expect(page.getByLabel('Descrizione (TXT)')).toHaveValue('scritta durante il salvataggio');
    await expect(page.locator('form')).toHaveAttribute('data-modificato', 'true');
    expect((await leggi(v.id)).body).toMatchObject({ titolo: `${v.titolo} uno`, descrizione_raw: v.descrizione_raw });
  });

  test('SALVA E CONTINUA: un errore si comporta come SALVA', async ({ page }) => {
    const altro = await nuovoVideogame(`e2e-${token()}-sec-occ`);
    const v = await nuovoVideogame(`e2e-${token()}-sec-err`);
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await page.getByLabel('RAWG slug').fill(altro.rawg_slug);
    await salvaEContinua(page).click();
    await expect(toast(page)).toHaveAttribute('data-variant', 'destructive');
    await expect(toast(page)).toContainText('Esiste già un videogame con questo slug RAWG');
    await expect(page).toHaveURL(new RegExp(`/videogame/${v.id}$`));
    await expect(page.getByLabel('RAWG slug')).toHaveValue(altro.rawg_slug);
    await expect(page.locator('form')).toHaveAttribute('data-modificato', 'true');
  });
});

test.describe('modifica a 1180', () => {
  test.use({ viewport: VIEWPORT[1180] });

  test('F-VG-04, F-VG-06, F-VG-08: due colonne, tabella degli episodi citati e salvataggio', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-1180`);
    await nuovoEpisodio({ episodio_numero: '7', associazioni: [{ videogame_id: v.id, istante: '0:07:00' }] });
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByTestId('episodi-citati').locator('table')).toBeVisible();
    await expect(page.getByTestId('rawg-json')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1180);
    await page.getByLabel('Titolo').fill('Titolo 1180');
    await page.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(page).toHaveURL(/\/bo\/videogame$/);
    expect((await leggi(v.id)).body.titolo).toBe('Titolo 1180');
  });
});

test.describe('modifica a 390', () => {
  test.use({ viewport: VIEWPORT[390] });

  test('F-VG-04, F-VG-07, F-VG-08: ordine dei pannelli, schede degli episodi citati, ELIMINA in fondo', async ({ page }) => {
    const v = await nuovoVideogame(`e2e-${token()}-390`);
    const e = await nuovoEpisodio({ episodio_numero: '240', data_uscita: '2025-06-26', associazioni: [{ videogame_id: v.id, istante: '1:02:00' }] });
    await entra(page);
    await page.goto(`/bo/videogame/${v.id}`);
    await expect(page.getByTestId('episodi-citati')).toContainText('· 1');
    const titoli = await page.locator('main [data-slot=card-title]').allTextContents();
    expect(titoli).toEqual(['Cover', 'Dati RAWG già presenti', 'Dati del gioco', 'RAWG JSON · sola lettura', 'Episodi in cui è citato · 1']);
    await expect(page.locator('table')).toHaveCount(0);
    const scheda = page.getByTestId('scheda-citato');
    await expect(scheda).toHaveCount(1);
    await expect(scheda).toContainText(`N° 240 · 2025-06-26${e.titolo}1:02:00 · Chiacchiera libera`);
    await expect(page.getByRole('button', { name: 'Elimina videogame' })).toBeVisible();
    await expect(barra(page).getByRole('button', { name: 'Elimina videogame' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await expect(page.getByRole('button', { name: 'Salva', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Elimina videogame' }).click();
    await expect(dialogo(page)).toContainText(
      `Stai per eliminare «${v.titolo}» e il suo collegamento all'episodio in cui è citato. L'episodio resta nell'archivio.`,
    );
    await foto(page, 'modifica-videogame-conferma-390');
    await dialogo(page).getByRole('button', { name: 'Annulla' }).click();
    await scheda.click();
    await expect(page).toHaveURL(new RegExp(`/bo/episodi/${e.id}$`));
  });
});

// --- Barra delle azioni e fotografie nei tre formati ----------------------------------------

for (const formato of [390, 1180, 1440]) {
  test.describe(`schermate a ${formato}`, () => {
    test.use({ viewport: VIEWPORT[formato] });

    test('barra delle azioni della modifica: ELIMINA, ANNULLA, SALVA E CONTINUA e SALVA al loro posto', async ({ page }) => {
      const v = await nuovoVideogame(`e2e-${token()}-barra`);
      await nuovoEpisodio({ episodio_numero: '312', associazioni: [{ videogame_id: v.id, istante: '0:12:30', tipologia: 'RECE' }] });
      await entra(page);
      await page.goto(`/bo/videogame/${v.id}`);
      await expect(page.getByTestId('episodi-citati')).toContainText('· 1');
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
        expect(ra.x).toBeLessThan(rs.x);
      } else {
        const re = await b.getByRole('button', { name: 'Elimina videogame' }).boundingBox();
        for (const r of [re, ra, rc]) expect(Math.abs(centro(r) - centro(rs))).toBeLessThan(1);
        expect(re.x).toBeCloseTo(rb.x + 16, 0);
        expect(ra.x + ra.width).toBeLessThan(rc.x);
        expect(rc.x + rc.width).toBeLessThan(rs.x);
        expect(rs.x + rs.width).toBeCloseTo(rb.x + rb.width - 16, 0);
      }
      await foto(page, `modifica-videogame-${formato}`);
      await page.goto('/bo/videogame/nuovo');
      await expect(barra(page).getByRole('button', { name: 'Crea da RAWG' })).toBeVisible();
      await expect(salvaEContinua(page)).toHaveCount(0);
      await foto(page, `nuovo-videogame-vuoto-${formato}`);
    });

    test('elenco con una selezione', async ({ page }) => {
      const t = token();
      await nuovoVideogame(`e2e-${t}-a`, { titolo: `Astro ${t}` });
      const b = await nuovoVideogame(`e2e-${t}-b`, { titolo: `Balatro ${t}`, cover: null });
      await nuovoVideogame(`e2e-${t}-c`, { titolo: `Celeste ${t}` });
      await entra(page);
      await elenco(page, t);
      await page.getByRole('checkbox', { name: `Seleziona il videogame ${b.titolo}` }).check();
      await expect(page.getByText(formato === 390 ? '1 selezionato' : '1 videogame selezionato')).toBeVisible();
      await expect(page.getByTestId('miniatura-vuota')).toHaveCount(1);
      await foto(page, `elenco-videogame-${formato}`);
      if (formato === 1180) {
        await page.getByRole('button', { name: 'Elimina selezionati' }).click();
        await expect(dialogo(page)).toContainText('Eliminare 1 videogame?');
        await foto(page, 'elenco-videogame-conferma-blocco-1180');
      }
    });

    if (formato === 1180)
      test('conferma di eliminazione dalla modifica', async ({ page }) => {
        const v = await nuovoVideogame(`e2e-${token()}-conf`);
        await nuovoEpisodio({ associazioni: [{ videogame_id: v.id }] });
        await nuovoEpisodio({ associazioni: [{ videogame_id: v.id }] });
        await entra(page);
        await page.goto(`/bo/videogame/${v.id}`);
        await expect(page.getByTestId('episodi-citati')).toContainText('· 2');
        await barra(page).getByRole('button', { name: 'Elimina videogame' }).click();
        await expect(dialogo(page)).toContainText('i suoi 2 collegamenti');
        await foto(page, 'modifica-videogame-conferma-1180');
      });
  });
}

// Revisione finale (Fase 3.7): `ordina` nell'indirizzo con il nome di una proprietà ereditata da
// Object (constructor, toString) non è una colonna: l'elenco usa il default di F-VG-02.
test.describe('elenco videogame: ordina con proprietà di Object', () => {
  test.use({ viewport: VIEWPORT[1440] });

  for (const ordina of ['constructor', 'toString']) {
    test(`F-VG-02: ?ordina=${ordina} → ordinamento di default, nessun errore`, async ({ page }) => {
      const errori = [];
      page.on('pageerror', (e) => errori.push(e.message));
      const t = token();
      await nuovoVideogame(`e2e-${t}-a`, { titolo: `Zeta ${t}` });
      await nuovoVideogame(`e2e-${t}-b`, { titolo: `Alfa ${t}` });
      await entra(page);
      await elenco(page, t, `&ordina=${ordina}`);
      await expect(righe(page).locator('td:nth-child(3)')).toHaveText([`Alfa ${t}`, `Zeta ${t}`]);
      await expect(page.getByRole('columnheader', { name: /Titolo/ })).toHaveAttribute('aria-sort', 'ascending');
      await expect(page.getByText('Non è stato possibile leggere i videogame.')).toHaveCount(0);
      await expect(toast(page)).toHaveCount(0);
      expect(errori).toEqual([]);
    });
  }
});
