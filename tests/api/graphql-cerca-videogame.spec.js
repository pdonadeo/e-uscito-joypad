// GraphQL: cercaVideogame (Fase 3.6c.4b), la scelta del videogame di un'associazione (F-EP-09).
// Stesse regole della ricerca del sito pubblico (search_episodes_by_game_title in
// src/db/django__episodio.ml), applicate ai videogame e solo al titolo:
// - testo vuoto → i primi `limite` per titolo;
// - meno di 6 caratteri → parole unite da % fra %, unaccent(titolo) ILIKE unaccent(…), per titolo;
// - 6 caratteri o più → word_similarity(unaccent(testo), unaccent(titolo)) > 0.25, per similarità
//   decrescente e poi per titolo.
// Il DB è quello di sviluppo, con i dati veri: le fixture hanno titoli con parole che lì non ci sono
// («qzj», «vortiglax», «quondramix», «mnemorplith») e un numero unico per ogni esecuzione.
// Gli slug iniziano con «e2e-», così il teardown della suite cancella i videogame creati.
const { randomInt } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { USERS } = require('./env');
const { loggedIn, newContext } = require('./helpers');
const { F, gql, expectOk, expectCode, creaVideogame, aggiornaVideogame } = require('./gql-helpers');

const CERCA = `query($t: String!, $l: Int) { cercaVideogame(testo: $t, limite: $l) { ${F.videogameInElenco} } }`;
const CERCA_SENZA_LIMITE = `query($t: String!) { cercaVideogame(testo: $t) { ${F.videogameInElenco} } }`;
const ELENCO = `query($r: String, $l: Int) {
  elencoVideogame(ricerca: $r, limit: $l, ordinamento: TITOLO, direzione: ASC) { totale elementi { ${F.videogameInElenco} } } }`;

// solo cifre: nei titoli è una parola a parte che le ricerche dei test non contengono
const N = `${Date.now()}${randomInt(1e6)}`;

let api;
const g = {}; // fixture per nome

// Crea un videogame (titolo dal finto RAWG), poi gli dà titolo e descrizione voluti: con rawg_json
// già presente l'aggiornamento non richiama RAWG e tiene i campi del body.
async function nuovoVideogame(nome, titolo, extra = {}) {
  const rawg_slug = extra.rawg_slug ?? `e2e-cvg-${nome}-${N}`;
  const { id } = await creaVideogame(api, { rawg_slug });
  g[nome] = await aggiornaVideogame(api, id, {
    rawg_slug,
    titolo,
    descrizione_raw: extra.descrizione_raw ?? 'Descrizione qualsiasi',
  });
}

const cerca = async (testo, limite) => expectOk(await gql(api, CERCA, { t: testo, l: limite })).cercaVideogame;
const ids = (righe) => righe.map((r) => r.id);
// gli id delle fixture indicate, nell'ordine in cui compaiono nei risultati
const fixtureIn = (righe, nomi) => ids(righe).filter((id) => nomi.some((n) => g[n].id === id));
const idDi = (...nomi) => nomi.map((n) => g[n].id);
const senzaAccenti = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
  // meno di 6 caratteri
  await nuovoVideogame('qzj-alfa', `Alfa Qzjè ${N}`);
  await nuovoVideogame('qzj-beta', `Beta QZJ ${N}`);
  await nuovoVideogame('qzj-gamma', `Gamma qzj ${N}`);
  // 6 caratteri o più
  await nuovoVideogame('vort-zeta', `Zeta Vortiglax ${N}`); // similarità 1
  await nuovoVideogame('vort-beta', `Beta Vortiglax ${N}`); // similarità 1, titolo prima di Zeta
  await nuovoVideogame('vort-alfa', `Alfa Vortiglaxeron ${N}`); // similarità 0.9
  await nuovoVideogame('quondramix', `Zelvirtha Quondramix ${N}`);
  await nuovoVideogame('mne', `Mne ${N}`); // word_similarity('Mnemorplith', …) = 0.25: fuori
  await nuovoVideogame('mnem', `Mnem ${N}`); // 0.33: dentro
  // testo solo nella descrizione o nello slug
  await nuovoVideogame('descr', `Titolo normale ${N}`, { descrizione_raw: `Parla di Wombifrax e di Kvp ${N}` });
  await nuovoVideogame('slug', `Altro titolo ${N}`, { rawg_slug: `e2e-cvg-wxyslugkq-pqv-${N}` });
});

test.afterAll(async () => {
  await api.dispose();
});

// --- Testo vuoto ------------------------------------------------------------------------------

test('testo vuoto o di soli spazi → i primi `limite` videogame per titolo crescente', async () => {
  const elenco = expectOk(await gql(api, ELENCO, { r: null, l: 20 })).elencoVideogame;
  const attesi = ids(elenco.elementi);
  expect(attesi.length).toBe(Math.min(20, elenco.totale));
  expect(ids(await cerca(''))).toEqual(attesi);
  expect(ids(await cerca('   '))).toEqual(attesi);
  // gli stessi campi di elencoVideogame
  expect(await cerca('')).toEqual(elenco.elementi);
});

// --- Meno di 6 caratteri ----------------------------------------------------------------------

test('meno di 6 caratteri: «contiene» sul titolo, senza maiuscole e accenti, per titolo crescente', async () => {
  // «qzj» è in tutti e tre, con maiuscole diverse e con l'accento dopo; ordine per titolo
  const tre = await cerca('qzj', 50);
  expect(fixtureIn(tre, ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual(idDi('qzj-alfa', 'qzj-beta', 'qzj-gamma'));
  for (const r of tre) expect(senzaAccenti(r.titolo)).toContain('qzj');
  // accento e maiuscole nel testo cercato: «QZJÈ» trova «Alfa Qzjè» (e non «Beta QZJ»)
  expect(fixtureIn(await cerca('QZJÈ', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual(idDi('qzj-alfa'));
  // accento nel titolo, non nel testo: «qzje» trova «Alfa Qzjè»
  expect(fixtureIn(await cerca('qzje', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual(idDi('qzj-alfa'));
});

test('meno di 6 caratteri: più parole unite da %, nell\'ordine scritto', async () => {
  // «be zj» → «%be%zj%»: «Beta QZJ», non gli altri; «zj be» no, le parole vanno nell'ordine
  expect(fixtureIn(await cerca('be zj', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual(idDi('qzj-beta'));
  expect(fixtureIn(await cerca('zj be', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual([]);
  // «ga qz» → «%ga%qz%»: «Gamma qzj»; «qz ga» no
  expect(fixtureIn(await cerca('ga qz', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual(idDi('qzj-gamma'));
  expect(fixtureIn(await cerca('qz ga', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual([]);
  // spazi ai bordi tolti prima di contare: «  be zj  » ha 5 caratteri
  expect(fixtureIn(await cerca('  be zj  ', 50), ['qzj-alfa', 'qzj-beta', 'qzj-gamma'])).toEqual(idDi('qzj-beta'));
});

test('meno di 6 caratteri: niente errori di battitura, e si contano i caratteri, non i byte', async () => {
  // «qzjex» non è contenuto in nessun titolo; con la similarità troverebbe «Alfa Qzjè»
  expect(fixtureIn(await cerca('qzjex', 50), ['qzj-alfa'])).toEqual([]);
  // «qzjèx»: 5 caratteri ma 6 byte in UTF-8, vale ancora la regola del «contiene»
  expect(fixtureIn(await cerca('qzjèx', 50), ['qzj-alfa'])).toEqual([]);
});

// --- 6 caratteri o più ------------------------------------------------------------------------

test('6 caratteri o più: un titolo scritto con un errore di battitura si trova', async () => {
  const righe = await cerca('Quondramx');
  expect(righe[0]).toEqual({
    id: g.quondramix.id,
    titolo: g.quondramix.titolo,
    rawg_slug: g.quondramix.rawg_slug,
    cover: g.quondramix.cover,
    ts: g.quondramix.ts,
  });
  // anche senza accenti e con le maiuscole sbagliate
  expect(ids(await cerca('zelvirta quondramix'))[0]).toBe(g.quondramix.id);
});

test('6 caratteri o più: ordine per similarità decrescente, poi per titolo', async () => {
  const righe = await cerca('Vortiglax');
  // similarità 1: «Beta Vortiglax» e «Zeta Vortiglax», per titolo; poi «Alfa Vortiglaxeron» (0.9)
  expect(ids(righe).slice(0, 3)).toEqual(idDi('vort-beta', 'vort-zeta', 'vort-alfa'));
});

test('6 caratteri o più: soglia di similarità 0.25, esclusa', async () => {
  const nomi = ['mne', 'mnem'];
  // word_similarity('Mnemorplith', 'Mnem …') = 0.33 → dentro; 'Mne …' = 0.25 → fuori
  expect(fixtureIn(await cerca('Mnemorplith', 50), nomi)).toEqual(idDi('mnem'));
});

// --- Descrizione e slug -----------------------------------------------------------------------

test('il testo che sta solo nella descrizione o nello slug non trova nulla', async () => {
  // elencoVideogame (F-VG-03) cerca anche lì: le fixture ci sono
  const vecchia = async (r) => ids(expectOk(await gql(api, ELENCO, { r, l: 50 })).elencoVideogame.elementi);
  expect(await vecchia('Wombifrax')).toContain(g.descr.id);
  expect(await vecchia('wxyslugkq')).toContain(g.slug.id);
  // descrizione: 6 o più caratteri e meno di 6
  expect(ids(await cerca('Wombifrax', 50))).not.toContain(g.descr.id);
  expect(ids(await cerca('Kvp', 50))).not.toContain(g.descr.id);
  // slug: 6 o più caratteri, meno di 6, slug intero
  expect(ids(await cerca('wxyslugkq', 50))).not.toContain(g.slug.id);
  expect(ids(await cerca('pqv', 50))).not.toContain(g.slug.id);
  expect(ids(await cerca('e2e-cvg-wxyslugkq-pqv', 50))).not.toContain(g.slug.id);
});

// --- limite -----------------------------------------------------------------------------------

test('limite: 20 se manca, altrimenti quello indicato, da 1 a 50', async () => {
  const { totale } = expectOk(await gql(api, ELENCO, { r: null, l: 1 })).elencoVideogame;
  expect(expectOk(await gql(api, CERCA_SENZA_LIMITE, { t: '' })).cercaVideogame).toHaveLength(Math.min(20, totale));
  expect(await cerca('', null)).toHaveLength(Math.min(20, totale));
  expect(await cerca('', 1)).toHaveLength(1);
  expect(await cerca('', 50)).toHaveLength(Math.min(50, totale));
  // il limite vale anche nelle ricerche: il primo per similarità e titolo
  expect(ids(await cerca('Vortiglax', 1))).toEqual(idDi('vort-beta'));
  expect(ids(await cerca('qzj', 1))).toHaveLength(1);
});

for (const limite of [0, -1, 51, 1000]) {
  test(`limite ${limite} → BAD_USER_INPUT`, async () => {
    const r = await gql(api, CERCA, { t: 'qzj', l: limite });
    expect(r.data).toBeNull();
    expectCode(r, 'BAD_USER_INPUT', 'Parametro «limite»: deve essere tra 1 e 50');
  });
}

// --- Accesso ----------------------------------------------------------------------------------

test('anonimo → UNAUTHENTICATED', async ({ playwright }) => {
  const ctx = await newContext(playwright);
  for (const t of ['', 'qzj', 'Vortiglax']) {
    const r = await gql(ctx, CERCA, { t, l: 5 });
    expect(r.data).toBeNull();
    expectCode(r, 'UNAUTHENTICATED', 'Autenticazione richiesta');
  }
  await ctx.dispose();
});
