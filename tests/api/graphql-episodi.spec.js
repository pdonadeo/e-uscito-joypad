// GraphQL: episodi e associazioni dell'episodio (F-EP-01 … F-EP-11, F-AS-03).
// Ogni test ha le sue fixture, così è indipendente (niente modalità serial).
// La cover passa dalla REST /api/bo/episodi/:id/cover, l'unica rimasta.
const { test, expect } = require('@playwright/test');
const { USERS, sql } = require('./env');
const { loggedIn, uniq, PNG_1x1 } = require('./helpers');
const { F, gql, expectOk, expectCode, creaVideogame, creaEpisodio } = require('./gql-helpers');

const CREA = `mutation($d: EpisodioInput!) { creaEpisodio(dati: $d) { ${F.episodio} } }`;
const AGGIORNA = `mutation($id: Int!, $d: EpisodioInput!) { aggiornaEpisodio(id: $id, dati: $d) { ${F.episodio} } }`;
const ELIMINA = `mutation($id: Int!) { eliminaEpisodio(id: $id) { ${F.episodio} } }`;
const DETTAGLIO = `query($id: Int!) { episodio(id: $id) { ${F.episodio} } }`;
const ELENCO = `query($o: Int, $l: Int, $r: String, $p: Boolean, $ord: OrdinamentoEpisodi, $dir: Direzione) {
  elencoEpisodi(offset: $o, limit: $l, ricerca: $r, pubblicato: $p, ordinamento: $ord, direzione: $dir) {
    totale elementi { ${F.episodioInElenco} } } }`;

let api; // sessione staff
const games = [];
let fixture; // episodio di riferimento per gli elenchi

// Episodio nuovo, con due associazioni (la seconda senza istante).
const nuovoEpisodio = (extra = {}) =>
  creaEpisodio(api, {
    titolo: `[E2E] GraphQL ${uniq()}`,
    episodio_numero: 'E2E-G1',
    data_uscita: '2001-01-01',
    durata: '1:02:03',
    url: 'https://example.com/audio.mp3',
    associazioni: [
      { videogame_id: games[0].id, istante: '00:01:00', speaker: 'BORD', tipologia: 'RECE' },
      { videogame_id: games[1].id, istante: null },
    ],
    ...extra,
  });

// Campi di EpisodioInput a partire da un Episodio (per la sostituzione completa).
const input = (e, patch = {}) => ({
  titolo: e.titolo,
  episodio_numero: e.episodio_numero,
  data_uscita: e.data_uscita,
  durata: e.durata,
  url: e.url,
  url_post: e.url_post,
  url_video: e.url_video,
  descrizione_html: e.descrizione_html,
  descrizione_txt: e.descrizione_txt,
  note: e.note,
  pubblicato: e.pubblicato,
  ...patch,
});

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
  for (let i = 0; i < 3; i++) games.push(await creaVideogame(api, { rawg_slug: `e2e-gqlep-${i}-${uniq()}` }));
  fixture = await nuovoEpisodio();
});

test.afterAll(async () => {
  await api.dispose();
});

test('creaEpisodio con associazioni: default di speaker e tipologia, istante assente → null', async () => {
  const titolo = `[E2E] GraphQL ${uniq()}`;
  const data = expectOk(
    await gql(api, CREA, {
      d: {
        titolo,
        episodio_numero: 'E2E-G1',
        data_uscita: '2001-01-01',
        durata: '1:02:03',
        url: 'https://example.com/audio.mp3',
        associazioni: [
          { videogame_id: games[0].id, istante: '0:01:00', speaker: 'BORD', tipologia: 'RECE' },
          { videogame_id: games[1].id },
        ],
      },
    }),
  );
  const ep = data.creaEpisodio;
  expect(ep).toMatchObject({
    titolo,
    episodio_numero: 'E2E-G1',
    data_uscita: '2001-01-01',
    durata: '01:02:03',
    url: 'https://example.com/audio.mp3',
    url_post: null,
    pubblicato: false,
    cover: null,
    cover_url: null,
  });
  expect(ep.ts_created).toMatch(/^\d{4}-\d{2}-\d{2}T.*[+-]\d{2}:\d{2}$/);
  // ordinate per istante, null in fondo
  expect(ep.associazioni.map((a) => [a.videogame_id, a.istante, a.speaker, a.tipologia])).toEqual([
    [games[0].id, '00:01:00', 'BORD', 'RECE'],
    [games[1].id, null, 'TUTT', 'FREE'],
  ]);
  expect(ep.associazioni[0].videogame_titolo).toBe(games[0].titolo);
  expectOk(await gql(api, ELIMINA, { id: ep.id }));
});

test('creaEpisodio: durata MM:SS e numero vuoto → null', async () => {
  const data = expectOk(
    await gql(api, CREA, { d: { titolo: `[E2E] GraphQL mmss ${uniq()}`, episodio_numero: '', data_uscita: '2001-01-02', durata: '45:30' } }),
  );
  expect(data.creaEpisodio).toMatchObject({ durata: '00:45:30', episodio_numero: null, associazioni: [] });
  expectOk(await gql(api, ELIMINA, { id: data.creaEpisodio.id }));
});

test('episodio: dettaglio con le associazioni ordinate per istante; id inesistente → NOT_FOUND', async () => {
  const got = expectOk(await gql(api, DETTAGLIO, { id: fixture.id })).episodio;
  expect(got).toMatchObject({ id: fixture.id, titolo: fixture.titolo, durata: '01:02:03', pubblicato: false });
  expect(got.associazioni.map((a) => [a.id, a.istante])).toEqual(fixture.associazioni.map((a) => [a.id, a.istante]));
  const r = await gql(api, DETTAGLIO, { id: 999999999 });
  expect(r.data).toBeNull();
  expectCode(r, 'NOT_FOUND', 'Risorsa non trovata');
});

test('elencoEpisodi: default data_uscita decrescente, totale, offset e limit', async () => {
  const total = Number(sql('SELECT count(*) FROM backoffice_episodio'));
  const page = expectOk(await gql(api, ELENCO, { o: 0, l: 20 })).elencoEpisodi;
  expect(page.totale).toBe(total);
  expect(page.elementi).toHaveLength(Math.min(20, total));
  const dates = page.elementi.map((e) => e.data_uscita);
  expect([...dates].sort().reverse()).toEqual(dates);
  const next = expectOk(await gql(api, ELENCO, { o: 1, l: 1 })).elencoEpisodi;
  expect(next.elementi[0].id).toBe(page.elementi[1].id);
  // senza limit: tutte le righe; offset senza limit: fino in fondo
  expect(expectOk(await gql(api, ELENCO, {})).elencoEpisodi.elementi).toHaveLength(total);
  expect(expectOk(await gql(api, ELENCO, { o: total - 1 })).elencoEpisodi.elementi).toHaveLength(1);
  // la riga dell'elenco non ha le associazioni (EpisodioInElenco)
  expect(page.elementi[0].associazioni).toBeUndefined();
});

test('elencoEpisodi: offset e limit fuori intervallo → BAD_USER_INPUT', async () => {
  expectCode(await gql(api, ELENCO, { o: -1 }), 'BAD_USER_INPUT', 'Parametro «offset»: deve essere ≥ 0');
  for (const l of [0, 1001]) {
    expectCode(await gql(api, ELENCO, { l }), 'BAD_USER_INPUT', 'Parametro «limit»: deve essere tra 1 e 1000');
  }
  expectOk(await gql(api, ELENCO, { l: 1000 }));
});

test('elencoEpisodi: ricerca in titolo e numero, senza maiuscole, con il filtro pubblicato', async () => {
  const byTitle = expectOk(await gql(api, ELENCO, { r: fixture.titolo.toLowerCase() })).elencoEpisodi;
  expect(byTitle.elementi.map((e) => e.id)).toEqual([fixture.id]);
  expect(byTitle.totale).toBe(1);
  const byNum = expectOk(await gql(api, ELENCO, { r: 'e2e-g1', p: false })).elencoEpisodi;
  expect(byNum.elementi.map((e) => e.id)).toContain(fixture.id);
  const pub = expectOk(await gql(api, ELENCO, { r: 'e2e-g1', p: true })).elencoEpisodi;
  expect(pub.elementi.map((e) => e.id)).not.toContain(fixture.id);
  // % e _ valgono letteralmente; stringa vuota = nessun filtro
  expect(expectOk(await gql(api, ELENCO, { r: '%_%_%' })).elencoEpisodi.totale).toBe(0);
  const all = expectOk(await gql(api, ELENCO, {})).elencoEpisodi.totale;
  expect(expectOk(await gql(api, ELENCO, { r: '' })).elencoEpisodi.totale).toBe(all);
});

test('elencoEpisodi: ogni ordinamento in entrambe le direzioni', async () => {
  const key = {
    EPISODIO_NUMERO: 'episodio_numero',
    TITOLO: 'titolo',
    DATA_USCITA: 'data_uscita',
    DURATA: 'durata',
    PUBBLICATO: 'pubblicato',
  };
  for (const [ord, field] of Object.entries(key)) {
    for (const dir of ['ASC', 'DESC']) {
      const rows = expectOk(await gql(api, ELENCO, { ord, dir, l: 50 })).elencoEpisodi.elementi;
      expect(rows.length, `${ord} ${dir}`).toBeGreaterThan(0);
      // i null vanno in fondo, in entrambe le direzioni
      const values = rows.map((r) => r[field]);
      const firstNull = values.indexOf(null);
      if (firstNull >= 0) expect(values.slice(firstNull).every((v) => v === null), `${ord} ${dir}`).toBe(true);
    }
  }
});

test('elencoEpisodi: ordinamento indicato senza direzione → ASC (il default DESC vale solo senza argomenti)', async () => {
  const ids = async (vars) => expectOk(await gql(api, ELENCO, { l: 50, ...vars })).elencoEpisodi.elementi.map((e) => e.id);
  const asc = await ids({ ord: 'TITOLO', dir: 'ASC' });
  expect(await ids({ ord: 'TITOLO' })).toEqual(asc);
  // controllo che il test distingua le due direzioni
  expect(await ids({ ord: 'TITOLO', dir: 'DESC' })).not.toEqual(asc);
  // senza argomenti vale il default dell'elenco: DATA_USCITA, DESC
  expect(await ids({})).toEqual(await ids({ ord: 'DATA_USCITA', dir: 'DESC' }));
  // con la sola direzione la colonna resta quella di default
  expect(await ids({ dir: 'ASC' })).toEqual(await ids({ ord: 'DATA_USCITA', dir: 'ASC' }));
});

test('aggiornaEpisodio: sostituisce le associazioni (aggiorna per id, cancella, inserisce)', async () => {
  const ep = await nuovoEpisodio();
  const [kept, removed] = ep.associazioni;
  const wanted = [
    { id: kept.id, videogame_id: games[2].id, istante: '0:10:00', speaker: 'FOSS', tipologia: 'CONS' },
    { videogame_id: games[0].id, istante: '0:20:00', speaker: 'ZAMP', tipologia: 'STAR' },
  ];
  const got = expectOk(
    await gql(api, AGGIORNA, { id: ep.id, d: input(ep, { titolo: `${ep.titolo} (mod)`, pubblicato: true, associazioni: wanted }) }),
  ).aggiornaEpisodio;
  expect(got).toMatchObject({ titolo: `${ep.titolo} (mod)`, pubblicato: true });
  expect(got.associazioni.find((a) => a.id === kept.id)).toMatchObject({ videogame_id: games[2].id, istante: '00:10:00' });
  expect(got.associazioni.find((a) => a.id === removed.id)).toBeUndefined();
  expect(got.associazioni).toHaveLength(2);
  expect(expectOk(await gql(api, DETTAGLIO, { id: ep.id })).episodio).toEqual(got);
});

test('aggiornaEpisodio: sostituzione completa, un campo opzionale assente viene azzerato', async () => {
  const ep = await nuovoEpisodio({ pubblicato: true });
  const d = input(ep);
  delete d.url;
  delete d.pubblicato;
  const got = expectOk(await gql(api, AGGIORNA, { id: ep.id, d })).aggiornaEpisodio;
  expect(got.url).toBeNull();
  expect(got.pubblicato).toBe(false);
  // associazioni assenti: restano come sono
  expect(got.associazioni).toEqual(ep.associazioni);
});

test('aggiornaEpisodio: payload non valido → BAD_USER_INPUT senza scritture parziali', async () => {
  const ep = await nuovoEpisodio();
  const before = expectOk(await gql(api, DETTAGLIO, { id: ep.id })).episodio;
  const invalid = [
    [{ titolo: '' }],
    [{ durata: '1:99:00' }],
    [{ data_uscita: '2001-02-30' }],
    [{ url: 'javascript:alert(1)' }],
    [{ titolo: 'x'.repeat(257) }],
    [{ associazioni: [{ videogame_id: 999999999 }] }, 'Videogame inesistenti: [999999999]'],
    [
      {
        associazioni: [
          { id: ep.associazioni[0].id, videogame_id: games[0].id },
          { id: ep.associazioni[0].id, videogame_id: games[1].id },
        ],
      },
      'Campo «associazioni»: id duplicati',
    ],
  ];
  for (const [patch, message] of invalid) {
    const r = await gql(api, AGGIORNA, { id: ep.id, d: input(ep, { titolo: 'NON DEVE ESSERE SALVATO', ...patch }) });
    expect(r.data, JSON.stringify(patch)).toBeNull();
    expectCode(r, 'BAD_USER_INPUT', message);
  }
  expect(expectOk(await gql(api, DETTAGLIO, { id: ep.id })).episodio).toEqual(before);
  expectCode(await gql(api, AGGIORNA, { id: 999999999, d: input(ep) }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('aggiornaEpisodio: associazioni [] le cancella tutte', async () => {
  const tmp = await nuovoEpisodio();
  const got = expectOk(await gql(api, AGGIORNA, { id: tmp.id, d: input(tmp, { associazioni: [] }) })).aggiornaEpisodio;
  expect(got.associazioni).toEqual([]);
  expectOk(await gql(api, ELIMINA, { id: tmp.id }));
});

test('cover: caricata via REST, letta da GraphQL (F-EP-10, F-EP-11)', async () => {
  const ep = await nuovoEpisodio();
  const up = await api.post(`/api/bo/episodi/${ep.id}/cover`, {
    multipart: { file: { name: 'cover gql.png', mimeType: 'image/png', buffer: PNG_1x1 } },
  });
  expect(up.status(), await up.text()).toBe(200);
  const rest = await up.json();
  const got = expectOk(await gql(api, DETTAGLIO, { id: ep.id })).episodio;
  expect(got.cover).toBe(rest.cover);
  expect(got.cover_url).toBe(rest.cover_url);
  expect((await api.delete(`/api/bo/episodi/${ep.id}/cover`)).status()).toBe(200);
  const after = expectOk(await gql(api, DETTAGLIO, { id: ep.id })).episodio;
  expect(after.cover).toBeNull();
  expect(after.cover_url).toBeNull();
});

test('eliminaEpisodio: restituisce il record e cancella le associazioni', async () => {
  const ep = await nuovoEpisodio();
  const before = expectOk(await gql(api, DETTAGLIO, { id: ep.id })).episodio;
  const deleted = expectOk(await gql(api, ELIMINA, { id: ep.id })).eliminaEpisodio;
  expect(deleted).toEqual(before);
  expectCode(await gql(api, DETTAGLIO, { id: ep.id }), 'NOT_FOUND');
  const assoc = expectOk(await gql(api, `{ elencoAssociazioni(episodio_id: ${ep.id}) { totale } }`)).elencoAssociazioni;
  expect(assoc.totale).toBe(0);
  expectCode(await gql(api, ELIMINA, { id: ep.id }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('valori di speaker e tipologia fuori dagli enum → GRAPHQL_VALIDATION', async () => {
  const r = await gql(api, `mutation { creaEpisodio(dati: { titolo: "[E2E] enum", data_uscita: "2001-01-01", durata: "0:30:00",
      associazioni: [{ videogame_id: ${games[0].id}, speaker: XXXX }] }) { id } }`);
  expectCode(r, 'GRAPHQL_VALIDATION');
  const labels = expectOk(await gql(api, '{ s: __type(name: "Speaker") { enumValues { name description } } t: __type(name: "Tipologia") { enumValues { name description } } }'));
  expect(labels.s.enumValues.map((v) => v.name)).toEqual(['TUTT', 'BORD', 'FOSS', 'ZAMP']);
  expect(labels.t.enumValues.map((v) => v.name)).toEqual(['FREE', 'RECE', 'CONS', 'STAR']);
  expect(labels.s.enumValues[0].description).toBe('Tutti');
});
