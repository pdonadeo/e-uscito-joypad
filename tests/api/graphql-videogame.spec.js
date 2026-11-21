// GraphQL: videogame con RAWG (F-VG-01 … F-VG-08) e associazioni (F-AS-01, F-AS-02).
const { test, expect } = require('@playwright/test');
const { USERS } = require('./env');
const { loggedIn, rawgCalls, uniq } = require('./helpers');
const { F, gql, expectOk, expectCode, parseRawg, creaVideogame, creaEpisodio } = require('./gql-helpers');

const CREA = `mutation($d: VideogameInput!) { creaVideogame(dati: $d) { ${F.videogame} } }`;
const AGGIORNA = `mutation($id: Int!, $d: VideogameInput!) { aggiornaVideogame(id: $id, dati: $d) { ${F.videogame} } }`;
const ELIMINA = `mutation($id: Int!) { eliminaVideogame(id: $id) { ${F.videogame} } }`;
const DETTAGLIO = `query($id: Int!) { videogame(id: $id) { ${F.videogame} } }`;
const ELENCO = `query($o: Int, $l: Int, $r: String, $ord: OrdinamentoVideogame, $dir: Direzione) {
  elencoVideogame(offset: $o, limit: $l, ricerca: $r, ordinamento: $ord, direzione: $dir) { totale elementi { ${F.videogameInElenco} } } }`;
const ASSOCIAZIONI = `query($e: Int, $v: Int, $ord: OrdinamentoAssociazioni, $dir: Direzione, $o: Int, $l: Int) {
  elencoAssociazioni(episodio_id: $e, videogame_id: $v, ordinamento: $ord, direzione: $dir, offset: $o, limit: $l) {
    totale elementi { ${F.associazione} } } }`;
const ASSOCIAZIONE = `query($id: Int!) { associazione(id: $id) { ${F.associazione} } }`;

let api;
const games = []; // fixture create all'inizio: ogni test è indipendente

// rawg_json come oggetto, per confrontarlo con parseRawg delle risposte
const nuovoVideogame = async () => parseRawg(await creaVideogame(api, { rawg_slug: `e2e-gqlvg-${uniq()}` }));

const nuovoEpisodio = (data_uscita, videogame_id, istante) =>
  creaEpisodio(api, {
    titolo: `[E2E] GraphQL citato ${uniq()}`,
    data_uscita,
    durata: '0:30:00',
    associazioni: [{ videogame_id, istante, speaker: 'FOSS', tipologia: 'CONS' }],
  });

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
  for (let i = 0; i < 2; i++) games.push(await nuovoVideogame());
});

test.afterAll(async () => {
  await api.dispose();
});

test('creaVideogame: titolo, descrizioni, cover e rawg_json arrivano da RAWG', async ({ request }) => {
  for (let i = 0; i < 2; i++) {
    const slug = `e2e-gqlvg-crea-${i}-${uniq()}`;
    const before = await rawgCalls(request);
    const g = parseRawg(
      expectOk(await gql(api, CREA, { d: { rawg_slug: slug, titolo: 'ignorato', cover: 'https://ignorata.example/x.jpg' } }))
        .creaVideogame,
    );
    expect(g).toMatchObject({
      rawg_slug: slug,
      titolo: `E2E Game ${slug}`,
      descrizione_html: `<p>Descrizione di ${slug}</p>`,
      descrizione_raw: `Descrizione di ${slug}`,
      cover: `https://media.example.com/${slug}.jpg`,
    });
    expect(g.rawg_json).toMatchObject({ id: 424242, slug, name: `E2E Game ${slug}` });
    expect(await rawgCalls(request)).toBe(before + 1);
  }
});

test('creaVideogame: errori di RAWG e di validazione, nessun salvataggio', async () => {
  const missing = `e2e-missing-${uniq()}`;
  expectCode(await gql(api, CREA, { d: { rawg_slug: missing } }), 'BAD_USER_INPUT', `Gioco «${missing}» non trovato su RAWG`);
  const broken = `e2e-broken-${uniq()}`;
  expectCode(await gql(api, CREA, { d: { rawg_slug: broken } }), 'UPSTREAM_ERROR', 'Risposta RAWG non valida');
  expectCode(await gql(api, CREA, { d: { rawg_slug: 'non valido/../x' } }), 'BAD_USER_INPUT');
  expectCode(
    await gql(api, CREA, { d: { rawg_slug: games[1].rawg_slug } }),
    'BAD_USER_INPUT',
    'Esiste già un videogame con questo slug RAWG',
  );
  for (const slug of [missing, broken]) {
    expect(expectOk(await gql(api, ELENCO, { r: slug })).elencoVideogame.totale).toBe(0);
  }
});

test('elencoVideogame: ricerca, totale, righe leggere senza rawg_json', async () => {
  const page = expectOk(await gql(api, ELENCO, { r: games[0].rawg_slug.toUpperCase(), o: 0, l: 10 })).elencoVideogame;
  expect(page.totale).toBe(1);
  expect(page.elementi).toEqual([
    { id: games[0].id, titolo: games[0].titolo, rawg_slug: games[0].rawg_slug, cover: games[0].cover, ts: games[0].ts },
  ]);
  // la ricerca guarda anche la descrizione testuale
  const byDesc = expectOk(await gql(api, ELENCO, { r: `Descrizione di ${games[1].rawg_slug}` })).elencoVideogame;
  expect(byDesc.elementi.map((g) => g.id)).toEqual([games[1].id]);
  // VideogameInElenco non ha rawg_json: chiederlo è un errore di validazione
  expectCode(await gql(api, '{ elencoVideogame(limit: 1) { elementi { rawg_json } } }'), 'GRAPHQL_VALIDATION');
});

test('elencoVideogame: default per titolo crescente, ordinamento per slug nelle due direzioni', async () => {
  // il default coincide con TITOLO ASC esplicito
  const def = expectOk(await gql(api, ELENCO, { l: 50 })).elencoVideogame.elementi.map((g) => g.id);
  const esplicito = expectOk(await gql(api, ELENCO, { l: 50, ord: 'TITOLO', dir: 'ASC' })).elencoVideogame.elementi.map((g) => g.id);
  expect(def).toEqual(esplicito);
  for (const dir of ['ASC', 'DESC']) {
    const rows = expectOk(await gql(api, ELENCO, { ord: 'RAWG_SLUG', dir, r: 'e2e-gqlvg-', l: 1000 })).elencoVideogame.elementi;
    const slugs = rows.map((g) => g.rawg_slug);
    const sorted = [...slugs].sort();
    expect(slugs).toEqual(dir === 'ASC' ? sorted : sorted.reverse());
  }
});

test('videogame: dettaglio con rawg_json serializzato; id inesistente → NOT_FOUND', async () => {
  const got = parseRawg(expectOk(await gql(api, DETTAGLIO, { id: games[0].id })).videogame);
  expect(got).toEqual(games[0]); // la risposta della creazione
  expectCode(await gql(api, DETTAGLIO, { id: 999999999 }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('aggiornaVideogame: con rawg_json presente non interroga RAWG; opzionali assenti azzerati', async ({ request }) => {
  const g = await nuovoVideogame();
  const before = await rawgCalls(request);
  const got = parseRawg(
    expectOk(
      await gql(api, AGGIORNA, {
        id: g.id,
        d: { rawg_slug: g.rawg_slug, titolo: 'Titolo corretto a mano', descrizione_raw: g.descrizione_raw, cover: g.cover },
      }),
    ).aggiornaVideogame,
  );
  expect(got.titolo).toBe('Titolo corretto a mano');
  expect(got.descrizione_html).toBeNull(); // assente → azzerato
  expect(got.rawg_json).toEqual(g.rawg_json);
  expect(await rawgCalls(request)).toBe(before);
  // rawg_json non è un campo di VideogameInput
  expectCode(
    await gql(api, `mutation { aggiornaVideogame(id: ${g.id}, dati: { rawg_slug: "${g.rawg_slug}", rawg_json: "{}" }) { id } }`),
    'GRAPHQL_VALIDATION',
  );
  expectCode(await gql(api, AGGIORNA, { id: 999999999, d: { rawg_slug: 'e2e-x' } }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('elencoAssociazioni ed associazione (F-AS-01, F-AS-02, F-VG-08)', async () => {
  // un videogame nuovo citato da due episodi con date diverse
  const g = await nuovoVideogame();
  const episodi = [await nuovoEpisodio('2001-03-01', g.id, '0:05:00'), await nuovoEpisodio('2001-04-01', g.id, '0:15:00')];
  // default: data di uscita crescente, poi istante
  const asc = expectOk(await gql(api, ASSOCIAZIONI, { v: g.id })).elencoAssociazioni;
  expect(asc.totale).toBe(2);
  expect(asc.elementi.map((a) => a.data_uscita)).toEqual(['2001-03-01', '2001-04-01']);
  expect(asc.elementi[0]).toMatchObject({
    episodio_id: episodi[0].id,
    videogame_id: g.id,
    istante: '00:05:00',
    speaker: 'FOSS',
    tipologia: 'CONS',
    videogame_titolo: g.titolo,
    episodio_titolo: episodi[0].titolo,
    episodio_numero: null,
  });
  // «Citato negli episodi» (F-VG-08): DATA_USCITA, DESC
  const desc = expectOk(await gql(api, ASSOCIAZIONI, { v: g.id, ord: 'DATA_USCITA', dir: 'DESC' })).elencoAssociazioni;
  expect(desc.elementi.map((a) => a.data_uscita)).toEqual(['2001-04-01', '2001-03-01']);
  for (const ord of ['ISTANTE', 'SPEAKER', 'TIPOLOGIA', 'VIDEOGAME_TITOLO', 'EPISODIO_TITOLO']) {
    expect(expectOk(await gql(api, ASSOCIAZIONI, { v: g.id, ord, dir: 'ASC' })).elencoAssociazioni.totale, ord).toBe(2);
  }
  const byEp = expectOk(await gql(api, ASSOCIAZIONI, { e: episodi[1].id })).elencoAssociazioni;
  expect(byEp.elementi.map((a) => a.episodio_id)).toEqual([episodi[1].id]);
  expect(expectOk(await gql(api, ASSOCIAZIONE, { id: asc.elementi[0].id })).associazione).toEqual(asc.elementi[0]);
  expectCode(await gql(api, ASSOCIAZIONE, { id: 999999999 }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('eliminaVideogame: restituisce il record e cancella solo le associazioni', async () => {
  const g = await nuovoVideogame();
  const episodi = [await nuovoEpisodio('2001-03-02', g.id, '0:05:00'), await nuovoEpisodio('2001-04-02', g.id, '0:15:00')];
  const deleted = parseRawg(expectOk(await gql(api, ELIMINA, { id: g.id })).eliminaVideogame);
  expect(deleted).toEqual(g);
  expectCode(await gql(api, DETTAGLIO, { id: g.id }), 'NOT_FOUND');
  // gli episodi restano, senza le associazioni
  for (const e of episodi) {
    const got = expectOk(await gql(api, `query($id: Int!) { episodio(id: $id) { id associazioni { id } } }`, { id: e.id })).episodio;
    expect(got).toEqual({ id: e.id, associazioni: [] });
  }
  expectCode(await gql(api, ELIMINA, { id: g.id }), 'NOT_FOUND', 'Risorsa non trovata');
});
