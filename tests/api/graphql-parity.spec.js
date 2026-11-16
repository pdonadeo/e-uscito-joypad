// Parità REST (/api/bo) ↔ GraphQL (/api/graphql), Fase 3.5.3.
// Per ogni ID di docs/analisi.md con un endpoint /api/bo: stessa fixture, stesse
// asserzioni sulle due implementazioni. Le differenze volute sono le eccezioni
// P-1 … P-6 del piano, ognuna verificata come differenza attesa: P-1 … P-5 in
// fondo al file, P-6 (valori fuori dagli enum) nel test F-AS-03.
const { test, expect } = require('@playwright/test');
const { USERS, django } = require('./env');
const { listQuery, loggedIn, newContext, rawgCalls, uniq, PNG_1x1 } = require('./helpers');
const { ENDPOINT, F, gql, expectOk, expectCode, parseRawg } = require('./gql-helpers');

// Status REST → codice GraphQL (schema.graphql, docs/spike-graphql.md punto 4).
const CODE = { 400: 'BAD_USER_INPUT', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'BAD_USER_INPUT', 429: 'RATE_LIMITED', 502: 'UPSTREAM_ERROR', 504: 'UPSTREAM_ERROR' };

async function rest(ctx, method, url, data) {
  const res = await ctx[method](url, data === undefined ? undefined : { data });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body, headers: res.headers() };
}

// Elenco REST: totale da Content-Range ("risorsa 0-19/135" oppure "risorsa */0").
async function restList(ctx, resource, q) {
  const r = await rest(ctx, 'get', `/api/bo/${resource}${listQuery(q)}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return { totale: Number(r.headers['content-range'].split('/')[1]), elementi: r.body };
}

// Lo stesso errore sulle due API: codice corrispondente allo status e stesso messaggio.
function sameError(restRes, gqlRes) {
  expect(CODE[restRes.status], `status REST ${restRes.status}`).toBeTruthy();
  expectCode(gqlRes, CODE[restRes.status], restRes.body.message);
  expect(gqlRes.data).toBeNull();
}

const omit = (o, keys) => Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
const normEp = (e) => ({ ...omit(e, ['id', 'ts', 'ts_created']), associazioni: e.associazioni.map((a) => omit(a, ['id'])) });
const normUt = (u) => omit(u, ['id', 'username', 'date_joined', 'last_login']);
const normVg = (g, slug) => JSON.parse(JSON.stringify(omit(g, ['id', 'ts', 'ts_created'])).split(slug).join('<slug>'));

const EP_LIST = `query($o: Int, $l: Int, $r: String, $p: Boolean, $ord: OrdinamentoEpisodi, $dir: Direzione) {
  elencoEpisodi(offset: $o, limit: $l, ricerca: $r, pubblicato: $p, ordinamento: $ord, direzione: $dir) { totale elementi { ${F.episodioInElenco} } } }`;
const EP_GET = `query($id: Int!) { episodio(id: $id) { ${F.episodio} } }`;
const EP_CREA = `mutation($d: EpisodioInput!) { creaEpisodio(dati: $d) { ${F.episodio} } }`;
const EP_AGG = `mutation($id: Int!, $d: EpisodioInput!) { aggiornaEpisodio(id: $id, dati: $d) { ${F.episodio} } }`;
const EP_DEL = `mutation($id: Int!) { eliminaEpisodio(id: $id) { ${F.episodio} } }`;
const VG_LIST = `query($o: Int, $l: Int, $r: String, $ord: OrdinamentoVideogame, $dir: Direzione) {
  elencoVideogame(offset: $o, limit: $l, ricerca: $r, ordinamento: $ord, direzione: $dir) { totale elementi { ${F.videogameInElenco} } } }`;
const VG_GET = `query($id: Int!) { videogame(id: $id) { ${F.videogame} } }`;
const VG_CREA = `mutation($d: VideogameInput!) { creaVideogame(dati: $d) { ${F.videogame} } }`;
const VG_AGG = `mutation($id: Int!, $d: VideogameInput!) { aggiornaVideogame(id: $id, dati: $d) { ${F.videogame} } }`;
const VG_DEL = `mutation($id: Int!) { eliminaVideogame(id: $id) { ${F.videogame} } }`;
const AS_LIST = `query($e: Int, $v: Int, $o: Int, $l: Int, $ord: OrdinamentoAssociazioni, $dir: Direzione) {
  elencoAssociazioni(episodio_id: $e, videogame_id: $v, offset: $o, limit: $l, ordinamento: $ord, direzione: $dir) { totale elementi { ${F.associazione} } } }`;
const AS_GET = `query($id: Int!) { associazione(id: $id) { ${F.associazione} } }`;
const UT_LIST = `query($o: Int, $l: Int, $r: String, $ord: OrdinamentoUtenti, $dir: Direzione) {
  elencoUtenti(offset: $o, limit: $l, ricerca: $r, ordinamento: $ord, direzione: $dir) { totale elementi { ${F.utente} } } }`;
const UT_GET = `query($id: Int!) { utente(id: $id) { ${F.utente} } }`;
const UT_CREA = `mutation($d: UtenteInput!) { creaUtente(dati: $d) { ${F.utente} } }`;
const UT_AGG = `mutation($id: Int!, $d: UtenteInput!) { aggiornaUtente(id: $id, dati: $d) { ${F.utente} } }`;
const UT_DEL = `mutation($id: Int!) { eliminaUtente(id: $id) { ${F.utente} } }`;
const LOGIN = `mutation($c: CredenzialiInput!) { login(credenziali: $c) { ${F.me} } }`;

let staff; // sessione staff
let su; // sessione superuser
const games = [];
let ep; // episodio di riferimento, creato via REST

// Videogame nuovo, creato via REST (fixture indipendente per ogni test).
async function nuovoVideogame() {
  const r = await rest(staff, 'post', '/api/bo/videogame', { rawg_slug: `e2e-par-${uniq()}` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
}

// EpisodioInput da un episodio REST (associazioni comprese, con istante esplicito).
const epInput = (e, patch = {}) => ({
  ...omit(e, ['id', 'ts', 'ts_created', 'cover', 'cover_url', 'associazioni']),
  associazioni: e.associazioni.map((a) => omit(a, ['videogame_titolo'])),
  ...patch,
});

test.beforeAll(async ({ playwright }) => {
  staff = await loggedIn(playwright, USERS.staff);
  su = await loggedIn(playwright, USERS.superuser);
  for (let i = 0; i < 3; i++) {
    const r = await rest(staff, 'post', '/api/bo/videogame', { rawg_slug: `e2e-par-${i}-${uniq()}` });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    games.push(r.body);
  }
  const r = await rest(staff, 'post', '/api/bo/episodi', {
    titolo: `[E2E] Parità 100%_\\ ${uniq()}`,
    episodio_numero: 'E2E-P1',
    data_uscita: '2001-05-01',
    durata: '1:02:03',
    url: 'https://example.com/a.mp3',
    note: 'nota',
    associazioni: [
      { videogame_id: games[0].id, istante: '00:20:00', speaker: 'BORD', tipologia: 'RECE' },
      { videogame_id: games[1].id, istante: null, speaker: 'FOSS', tipologia: 'CONS' },
      { videogame_id: games[2].id, istante: '00:05:00', speaker: 'ZAMP', tipologia: 'STAR' },
    ],
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ep = r.body;
});

test.afterAll(async () => {
  await staff.dispose();
  await su.dispose();
});

test.describe('autenticazione', () => {
  test('F-AU-01 login: stesso utente corrente; stesso rifiuto', async ({ playwright }) => {
    const a = await newContext(playwright);
    const b = await newContext(playwright);
    const r = await rest(a, 'post', '/api/bo/login', USERS.staff);
    expect(r.status).toBe(200);
    expect(expectOk(await gql(b, LOGIN, { c: USERS.staff })).login).toEqual(r.body);
    for (const c of [{ username: USERS.staff.username, password: 'sbagliata' }, USERS.nonstaff, USERS.inactive]) {
      sameError(await rest(a, 'post', '/api/bo/login', c), await gql(b, LOGIN, { c: { username: c.username, password: c.password } }));
    }
    await a.dispose();
    await b.dispose();
  });

  test('F-AU-02 logout senza sessione: riesce su tutte e due', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    expect((await rest(ctx, 'post', '/api/bo/logout')).status).toBe(200);
    expect(expectOk(await gql(ctx, 'mutation { logout }')).logout).toBe(true);
    await ctx.dispose();
  });

  test('F-AU-03 utente corrente: stessi campi; senza sessione stesso errore', async ({ playwright }) => {
    for (const ctx of [staff, su]) {
      expect(expectOk(await gql(ctx, `{ me { ${F.me} } }`)).me).toEqual((await rest(ctx, 'get', '/api/bo/me')).body);
    }
    const anon = await newContext(playwright);
    sameError(await rest(anon, 'get', '/api/bo/me'), await gql(anon, `{ me { ${F.me} } }`));
    await anon.dispose();
  });

  test('F-AU-04 staff sugli utenti: stesso rifiuto, sessione intatta', async () => {
    sameError(await rest(staff, 'get', '/api/bo/utenti'), await gql(staff, '{ elencoUtenti { totale } }'));
    sameError(await rest(staff, 'get', `/api/bo/utenti/${ep.id}`), await gql(staff, `{ utente(id: ${ep.id}) { id } }`));
    expect((await rest(staff, 'get', '/api/bo/me')).status).toBe(200);
  });

  test('F-AU-05 utente disattivato: stesso errore sulle due API', async ({ playwright }) => {
    const u = { username: 'e2e_par_deact', password: 'e2e-password-deact' };
    django(`from django.contrib.auth.models import User
x, _ = User.objects.get_or_create(username="${u.username}")
x.set_password("${u.password}"); x.is_staff = True; x.is_active = True; x.save()`);
    const a = await loggedIn(playwright, u);
    const b = await loggedIn(playwright, u);
    django(`from django.contrib.auth.models import User
User.objects.filter(username="${u.username}").update(is_active=False)`);
    sameError(await rest(a, 'get', '/api/bo/episodi'), await gql(b, '{ elencoEpisodi { totale } }'));
    await a.dispose();
    await b.dispose();
  });
});

test.describe('episodi', () => {
  test('F-EP-01 elenco: stessa prima pagina e stesso totale', async () => {
    const r = await restList(staff, 'episodi', { range: [0, 19] });
    const g = expectOk(await gql(staff, EP_LIST, { o: 0, l: 20 })).elencoEpisodi;
    expect(g).toEqual(r);
    const r2 = await restList(staff, 'episodi', { range: [20, 24] });
    expect(expectOk(await gql(staff, EP_LIST, { o: 20, l: 5 })).elencoEpisodi).toEqual(r2);
  });

  test('F-EP-02 ordinamento: stessi id per ogni campo e direzione', async () => {
    const campi = { EPISODIO_NUMERO: 'episodio_numero', TITOLO: 'titolo', DATA_USCITA: 'data_uscita', DURATA: 'durata', PUBBLICATO: 'pubblicato' };
    for (const [ord, campo] of Object.entries(campi)) {
      for (const dir of ['ASC', 'DESC']) {
        const r = await restList(staff, 'episodi', { sort: [campo, dir], range: [0, 49] });
        const g = expectOk(await gql(staff, EP_LIST, { ord, dir, o: 0, l: 50 })).elencoEpisodi;
        expect(g.elementi.map((e) => e.id), `${ord} ${dir}`).toEqual(r.elementi.map((e) => e.id));
      }
    }
  });

  test('F-EP-03 ricerca: stessi risultati (maiuscole, spazi esterni, % _ \\ letterali, stringa vuota)', async () => {
    for (const q of [ep.titolo, ep.titolo.toUpperCase(), `  ${ep.titolo}  `, '100%_\\', 'e2e-p1', '%', '_', '']) {
      const r = await restList(staff, 'episodi', { filter: { q }, range: [0, 49] });
      const g = expectOk(await gql(staff, EP_LIST, { r: q, o: 0, l: 50 })).elencoEpisodi;
      expect(g, JSON.stringify(q)).toEqual(r);
    }
  });

  test('F-EP-04 filtro «Pubblicato»: stessi risultati per sì e no, anche con la ricerca', async () => {
    for (const pubblicato of [true, false]) {
      for (const q of [undefined, 'e2e-p1']) {
        const filter = q === undefined ? { pubblicato } : { pubblicato, q };
        const r = await restList(staff, 'episodi', { filter, range: [0, 49] });
        const g = expectOk(await gql(staff, EP_LIST, { p: pubblicato, r: q, o: 0, l: 50 })).elencoEpisodi;
        expect(g, JSON.stringify(filter)).toEqual(r);
      }
    }
  });

  test('F-EP-05 F-EP-09 dettaglio: stesso episodio, associazioni nello stesso ordine; stesso 404', async () => {
    const r = await rest(staff, 'get', `/api/bo/episodi/${ep.id}`);
    expect(expectOk(await gql(staff, EP_GET, { id: ep.id })).episodio).toEqual(r.body);
    expect(r.body.associazioni.map((a) => a.istante)).toEqual(['00:05:00', '00:20:00', null]);
    sameError(await rest(staff, 'get', '/api/bo/episodi/999999999'), await gql(staff, EP_GET, { id: 999999999 }));
  });

  test('F-EP-06 creazione: stesso risultato con lo stesso payload', async () => {
    const d = {
      titolo: `[E2E] Parità crea ${uniq()}`,
      episodio_numero: 'E2E-P2',
      data_uscita: '2001-06-01',
      durata: '45:30',
      url_post: 'https://example.com/post',
      associazioni: [
        { videogame_id: games[0].id, istante: '0:01:00', speaker: 'BORD', tipologia: 'RECE' },
        { videogame_id: games[1].id, istante: '0:02:00' },
      ],
    };
    const r = await rest(staff, 'post', '/api/bo/episodi', d);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const g = expectOk(await gql(staff, EP_CREA, { d })).creaEpisodio;
    expect(normEp(g)).toEqual(normEp(r.body));
    await rest(staff, 'delete', `/api/bo/episodi/${r.body.id}`);
    await rest(staff, 'delete', `/api/bo/episodi/${g.id}`);
  });

  test('F-EP-07 F-EP-09 modifica: stesso risultato; stessi errori senza scritture parziali', async () => {
    const make = async () => (await rest(staff, 'post', '/api/bo/episodi', epInput(ep, { titolo: `[E2E] Parità mod ${uniq()}` }))).body;
    const a = await make();
    const b = await make();
    const patch = {
      titolo: '[E2E] Parità modificato',
      pubblicato: true,
      url: null,
      associazioni: [
        { id: null, videogame_id: games[2].id, istante: '00:30:00', speaker: 'TUTT', tipologia: 'FREE' },
      ],
    };
    const ra = await rest(staff, 'put', `/api/bo/episodi/${a.id}`, epInput(a, { ...patch, associazioni: [{ ...omit(a.associazioni[0], ['videogame_titolo']), istante: '00:01:00' }, patch.associazioni[0]] }));
    expect(ra.status, JSON.stringify(ra.body)).toBe(200);
    const gb = expectOk(
      await gql(staff, EP_AGG, { id: b.id, d: epInput(b, { ...patch, associazioni: [{ ...omit(b.associazioni[0], ['videogame_titolo']), istante: '00:01:00' }, omit(patch.associazioni[0], ['id'])] }) }),
    ).aggiornaEpisodio;
    expect(normEp(gb)).toEqual(normEp(ra.body));
    // la riga con id è stata aggiornata sul posto in tutte e due
    expect(gb.associazioni.map((x) => x.id)).toContain(b.associazioni[0].id);
    expect(ra.body.associazioni.map((x) => x.id)).toContain(a.associazioni[0].id);

    const invalid = [
      { titolo: '' },
      { durata: '1:99:00' },
      { durata: '1:0000000000000000000000001:00' },
      { data_uscita: '2001-02-30' },
      { url: 'javascript:alert(1)' },
      { titolo: 'x'.repeat(257) },
      { associazioni: [{ videogame_id: 999999999 }] },
      { associazioni: [{ id: ra.body.associazioni[0].id, videogame_id: games[0].id }, { id: ra.body.associazioni[0].id, videogame_id: games[1].id }] },
    ];
    for (const p of invalid) {
      const gp = p.associazioni ? { ...p, associazioni: p.associazioni.map((x) => (x.id ? { ...x, id: gb.associazioni[0].id } : x)) } : p;
      sameError(
        await rest(staff, 'put', `/api/bo/episodi/${a.id}`, epInput(ra.body, p)),
        await gql(staff, EP_AGG, { id: b.id, d: epInput(gb, gp) }),
      );
    }
    expect((await rest(staff, 'get', `/api/bo/episodi/${a.id}`)).body).toEqual(ra.body);
    expect(expectOk(await gql(staff, EP_GET, { id: b.id })).episodio).toEqual(gb);
    sameError(await rest(staff, 'put', '/api/bo/episodi/999999999', epInput(ra.body)), await gql(staff, EP_AGG, { id: 999999999, d: epInput(gb) }));
    await rest(staff, 'delete', `/api/bo/episodi/${a.id}`);
    await rest(staff, 'delete', `/api/bo/episodi/${b.id}`);
  });

  test('F-EP-08 eliminazione: stesso record restituito, associazioni cancellate, poi stesso 404', async () => {
    const make = async () => (await rest(staff, 'post', '/api/bo/episodi', epInput(ep, { titolo: `[E2E] Parità del ${uniq()}` }))).body;
    const a = await make();
    const b = await make();
    const ra = await rest(staff, 'delete', `/api/bo/episodi/${a.id}`);
    expect(ra.status).toBe(200);
    const gb = expectOk(await gql(staff, EP_DEL, { id: b.id })).eliminaEpisodio;
    expect(normEp({ ...gb, titolo: '' })).toEqual(normEp({ ...ra.body, titolo: '' }));
    expect(gb).toEqual(b);
    for (const id of [a.id, b.id]) {
      expect((await restList(staff, 'associazioni', { filter: { episodio_id: id } })).totale).toBe(0);
    }
    sameError(await rest(staff, 'delete', `/api/bo/episodi/${a.id}`), await gql(staff, EP_DEL, { id: b.id }));
  });

  test('F-EP-10 F-EP-11 cover caricata e tolta via REST: stessi cover e cover_url su GraphQL', async () => {
    const up = await staff.post(`/api/bo/episodi/${ep.id}/cover`, {
      multipart: { file: { name: 'parita.png', mimeType: 'image/png', buffer: PNG_1x1 } },
    });
    expect(up.status(), await up.text()).toBe(200);
    expect(expectOk(await gql(staff, EP_GET, { id: ep.id })).episodio).toEqual((await rest(staff, 'get', `/api/bo/episodi/${ep.id}`)).body);
    expect((await staff.delete(`/api/bo/episodi/${ep.id}/cover`)).status()).toBe(200);
    const after = (await rest(staff, 'get', `/api/bo/episodi/${ep.id}`)).body;
    expect(expectOk(await gql(staff, EP_GET, { id: ep.id })).episodio).toEqual(after);
    expect(expectOk(await gql(staff, EP_LIST, { r: ep.titolo })).elencoEpisodi.elementi[0].cover_url).toBeNull();
  });
});

test.describe('videogame e associazioni', () => {
  test('F-VG-01 F-VG-03 elenco e ricerca (titolo, descrizione, slug): stessi risultati', async () => {
    for (const q of [undefined, 'e2e-par-', games[0].rawg_slug.toUpperCase(), `Descrizione di ${games[1].rawg_slug}`, '%']) {
      const r = await restList(staff, 'videogame', { filter: q === undefined ? undefined : { q }, range: [0, 29] });
      const g = expectOk(await gql(staff, VG_LIST, { r: q, o: 0, l: 30 })).elencoVideogame;
      expect(g, JSON.stringify(q)).toEqual(r);
    }
  });

  test('F-VG-02 ordinamento per titolo e slug: stessi id', async () => {
    for (const [ord, campo] of [['TITOLO', 'titolo'], ['RAWG_SLUG', 'rawg_slug']]) {
      for (const dir of ['ASC', 'DESC']) {
        const r = await restList(staff, 'videogame', { sort: [campo, dir], range: [0, 49] });
        const g = expectOk(await gql(staff, VG_LIST, { ord, dir, o: 0, l: 50 })).elencoVideogame;
        expect(g.elementi.map((x) => x.id), `${ord} ${dir}`).toEqual(r.elementi.map((x) => x.id));
      }
    }
  });

  test('F-VG-04 dettaglio: stesso videogame (rawg_json serializzato in GraphQL); stesso 404', async () => {
    const r = await rest(staff, 'get', `/api/bo/videogame/${games[0].id}`);
    expect(parseRawg(expectOk(await gql(staff, VG_GET, { id: games[0].id })).videogame)).toEqual(r.body);
    sameError(await rest(staff, 'get', '/api/bo/videogame/999999999'), await gql(staff, VG_GET, { id: 999999999 }));
  });

  test('F-VG-05 creazione da RAWG: stesso risultato; stessi errori di RAWG e di validazione', async ({ request }) => {
    const sa = `e2e-par-crea-a-${uniq()}`;
    const sb = `e2e-par-crea-b-${uniq()}`;
    const before = await rawgCalls(request);
    const r = await rest(staff, 'post', '/api/bo/videogame', { rawg_slug: sa, titolo: 'ignorato' });
    expect(r.status).toBe(201);
    const g = parseRawg(expectOk(await gql(staff, VG_CREA, { d: { rawg_slug: sb, titolo: 'ignorato' } })).creaVideogame);
    expect(normVg(g, sb)).toEqual(normVg(r.body, sa));
    expect(await rawgCalls(request)).toBe(before + 2);
    for (const d of [{ rawg_slug: `e2e-missing-${uniq()}` }, { rawg_slug: `e2e-broken-${uniq()}` }, { rawg_slug: 'non valido/../x' }, { rawg_slug: '' }]) {
      sameError(await rest(staff, 'post', '/api/bo/videogame', d), await gql(staff, VG_CREA, { d }));
    }
  });

  test('F-VG-06 modifica: stesso risultato, RAWG non interrogato se rawg_json c\'è; stesso 404', async ({ request }) => {
    const [a, b] = [await nuovoVideogame(), await nuovoVideogame()];
    const patch = (x) => ({ rawg_slug: x.rawg_slug, titolo: 'Titolo a mano', descrizione_raw: 'Solo testo', cover: null });
    const before = await rawgCalls(request);
    const r = await rest(staff, 'put', `/api/bo/videogame/${a.id}`, patch(a));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const g = parseRawg(expectOk(await gql(staff, VG_AGG, { id: b.id, d: patch(b) })).aggiornaVideogame);
    expect(normVg(g, b.rawg_slug)).toEqual(normVg(r.body, a.rawg_slug));
    expect(await rawgCalls(request)).toBe(before);
    sameError(
      await rest(staff, 'put', '/api/bo/videogame/999999999', { rawg_slug: 'e2e-x' }),
      await gql(staff, VG_AGG, { id: 999999999, d: { rawg_slug: 'e2e-x' } }),
    );
  });

  test('F-VG-08 F-AS-01 associazioni filtrate: stessi risultati per ogni ordinamento e direzione', async () => {
    const campi = {
      DATA_USCITA: 'data_uscita',
      ISTANTE: 'istante',
      SPEAKER: 'speaker',
      TIPOLOGIA: 'tipologia',
      VIDEOGAME_TITOLO: 'videogame_titolo',
      EPISODIO_TITOLO: 'episodio_titolo',
    };
    for (const [filtro, vars] of [
      [{ episodio_id: ep.id }, { e: ep.id }],
      [{ videogame_id: games[0].id }, { v: games[0].id }],
    ]) {
      const def = await restList(staff, 'associazioni', { filter: filtro });
      expect(expectOk(await gql(staff, AS_LIST, vars)).elencoAssociazioni).toEqual(def);
      for (const [ord, campo] of Object.entries(campi)) {
        for (const dir of ['ASC', 'DESC']) {
          const r = await restList(staff, 'associazioni', { filter: filtro, sort: [campo, dir], range: [0, 24] });
          const g = expectOk(await gql(staff, AS_LIST, { ...vars, ord, dir, o: 0, l: 25 })).elencoAssociazioni;
          expect(g, `${JSON.stringify(filtro)} ${ord} ${dir}`).toEqual(r);
        }
      }
    }
  });

  test('F-AS-02 associazione per id: stesso record; stesso 404', async () => {
    const id = ep.associazioni[0].id;
    expect(expectOk(await gql(staff, AS_GET, { id })).associazione).toEqual((await rest(staff, 'get', `/api/bo/associazioni/${id}`)).body);
    sameError(await rest(staff, 'get', '/api/bo/associazioni/999999999'), await gql(staff, AS_GET, { id: 999999999 }));
  });

  test('F-AS-03 speaker e tipologia: stessi codici accettati e restituiti; P-6 sui valori fuori elenco', async () => {
    const assoc = ['TUTT', 'BORD', 'FOSS', 'ZAMP'].map((speaker, i) => ({
      videogame_id: games[0].id,
      istante: `0:0${i}:00`,
      speaker,
      tipologia: ['FREE', 'RECE', 'CONS', 'STAR'][i],
    }));
    const d = { titolo: `[E2E] Parità enum ${uniq()}`, data_uscita: '2001-07-01', durata: '0:30:00', associazioni: assoc };
    const r = await rest(staff, 'post', '/api/bo/episodi', d);
    expect(r.status).toBe(201);
    const g = expectOk(await gql(staff, EP_CREA, { d })).creaEpisodio;
    expect(normEp(g)).toEqual(normEp(r.body));
    // P-6 (eccezione dichiarata): un valore fuori elenco è rifiutato da tutte e due,
    // ma in modo diverso. REST: 400 con il messaggio di validazione del campo.
    // GraphQL: lo rifiuta il tipo enum prima del resolver → GRAPHQL_VALIDATION, senza data.
    for (const [campo, valori] of [
      ['speaker', 'TUTT, BORD, FOSS, ZAMP'],
      ['tipologia', 'FREE, RECE, CONS, STAR'],
    ]) {
      const titolo = `[E2E] Parità P-6 ${campo} ${uniq()}`;
      const bad = { ...d, titolo, associazioni: [{ videogame_id: games[0].id, [campo]: 'XXXX' }] };
      const rb = await rest(staff, 'post', '/api/bo/episodi', bad);
      expect(rb.status).toBe(400);
      expect(rb.body).toEqual({ message: `Campo «${campo}»: valori ammessi: ${valori}` });
      const gb = await gql(staff, EP_CREA, { d: bad });
      expectCode(gb, 'GRAPHQL_VALIDATION');
      expect(gb.data ?? null).toBeNull();
      // nessuna delle due ha scritto qualcosa
      expect((await restList(staff, 'episodi', { filter: { q: titolo } })).totale).toBe(0);
    }
    await rest(staff, 'delete', `/api/bo/episodi/${r.body.id}`);
    await rest(staff, 'delete', `/api/bo/episodi/${g.id}`);
  });

  test('F-VG-07 eliminazione: stesso record, associazioni cancellate, episodi intatti; stesso 404', async () => {
    const [a, b] = [await nuovoVideogame(), await nuovoVideogame()];
    for (const g of [a, b]) {
      await rest(staff, 'put', `/api/bo/episodi/${ep.id}`, epInput((await rest(staff, 'get', `/api/bo/episodi/${ep.id}`)).body, {
        associazioni: [...(await rest(staff, 'get', `/api/bo/episodi/${ep.id}`)).body.associazioni.map((x) => omit(x, ['videogame_titolo'])), { videogame_id: g.id, istante: '01:00:00' }],
      }));
    }
    const ra = await rest(staff, 'delete', `/api/bo/videogame/${a.id}`);
    expect(ra.status).toBe(200);
    const gb = parseRawg(expectOk(await gql(staff, VG_DEL, { id: b.id })).eliminaVideogame);
    expect(normVg(gb, b.rawg_slug)).toEqual(normVg(ra.body, a.rawg_slug));
    const after = (await rest(staff, 'get', `/api/bo/episodi/${ep.id}`)).body;
    expect(after.associazioni.map((x) => x.videogame_id)).not.toContain(a.id);
    expect(after.associazioni.map((x) => x.videogame_id)).not.toContain(b.id);
    expect(after.associazioni).toHaveLength(3);
    sameError(await rest(staff, 'delete', `/api/bo/videogame/${a.id}`), await gql(staff, VG_DEL, { id: b.id }));
  });
});

test.describe('utenti', () => {
  test('F-UT-01 F-UT-02 elenco, ricerca e ordinamento: stessi risultati', async () => {
    const campi = { USERNAME: 'username', FIRST_NAME: 'first_name', LAST_NAME: 'last_name', EMAIL: 'email', IS_STAFF: 'is_staff', IS_ACTIVE: 'is_active', IS_SUPERUSER: 'is_superuser', LAST_LOGIN: 'last_login' };
    for (const q of [undefined, 'e2e_', 'E2E_SUPER']) {
      const r = await restList(su, 'utenti', { filter: q === undefined ? undefined : { q }, range: [0, 49] });
      expect(expectOk(await gql(su, UT_LIST, { r: q, o: 0, l: 50 })).elencoUtenti, JSON.stringify(q)).toEqual(r);
    }
    for (const [ord, campo] of Object.entries(campi)) {
      for (const dir of ['ASC', 'DESC']) {
        const r = await restList(su, 'utenti', { sort: [campo, dir], range: [0, 49] });
        const g = expectOk(await gql(su, UT_LIST, { ord, dir, o: 0, l: 50 })).elencoUtenti;
        expect(g.elementi.map((u) => u.id), `${ord} ${dir}`).toEqual(r.elementi.map((u) => u.id));
      }
    }
  });

  test('F-UT-03 dettaglio: stesso utente; stesso 404', async () => {
    const me = (await rest(su, 'get', '/api/bo/me')).body;
    expect(expectOk(await gql(su, UT_GET, { id: me.id })).utente).toEqual((await rest(su, 'get', `/api/bo/utenti/${me.id}`)).body);
    sameError(await rest(su, 'get', '/api/bo/utenti/999999999'), await gql(su, UT_GET, { id: 999999999 }));
  });

  test('F-UT-04 creazione: stesso risultato; stessi errori di validazione', async () => {
    const base = { password: 'e2e-password-par', first_name: 'Par', email: 'par@example.com', is_staff: true, is_active: false, is_superuser: false };
    const r = await rest(su, 'post', '/api/bo/utenti', { ...base, username: `e2e_par_a_${uniq()}`.slice(0, 30) });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const g = expectOk(await gql(su, UT_CREA, { d: { ...base, username: `e2e_par_b_${uniq()}`.slice(0, 30) } })).creaUtente;
    expect(normUt(g)).toEqual(normUt(r.body));
    const flags = { is_staff: true, is_active: true, is_superuser: false };
    for (const d of [
      { username: 'e2e_par_short', password: 'corta', ...flags },
      { username: 'e2e_par_nopw', ...flags },
      { username: 'con spazi', password: 'e2e-password', ...flags },
      { username: 'x'.repeat(151), password: 'e2e-password', ...flags },
      { username: 'e2e_par_mail', password: 'e2e-password', email: 'x'.repeat(255), ...flags },
    ]) {
      sameError(await rest(su, 'post', '/api/bo/utenti', d), await gql(su, UT_CREA, { d }));
    }
    for (const u of [r.body, g]) await rest(su, 'delete', `/api/bo/utenti/${u.id}`);
  });

  test('F-UT-05 modifica: stesso risultato senza password; stesso rifiuto sui propri privilegi; stesso 404', async () => {
    const base = { password: 'e2e-password-par', is_staff: true, is_active: true, is_superuser: false };
    const a = (await rest(su, 'post', '/api/bo/utenti', { ...base, username: `e2e_par_ma_${uniq()}`.slice(0, 30) })).body;
    const b = (await rest(su, 'post', '/api/bo/utenti', { ...base, username: `e2e_par_mb_${uniq()}`.slice(0, 30) })).body;
    const patch = (u) => ({ username: u.username, last_name: 'Cognome', is_staff: false, is_active: true, is_superuser: false });
    const r = await rest(su, 'put', `/api/bo/utenti/${a.id}`, patch(a));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const g = expectOk(await gql(su, UT_AGG, { id: b.id, d: patch(b) })).aggiornaUtente;
    expect(normUt(g)).toEqual(normUt(r.body));
    const me = (await rest(su, 'get', `/api/bo/utenti/${(await rest(su, 'get', '/api/bo/me')).body.id}`)).body;
    const self = omit(me, ['id', 'last_login', 'date_joined']);
    for (const flag of ['is_superuser', 'is_staff', 'is_active']) {
      sameError(await rest(su, 'put', `/api/bo/utenti/${me.id}`, { ...self, [flag]: false }), await gql(su, UT_AGG, { id: me.id, d: { ...self, [flag]: false } }));
    }
    sameError(await rest(su, 'put', '/api/bo/utenti/999999999', patch(a)), await gql(su, UT_AGG, { id: 999999999, d: patch(a) }));
    for (const u of [a, b]) await rest(su, 'delete', `/api/bo/utenti/${u.id}`);
  });

  test('F-UT-06 eliminazione: stesso record restituito; stesso rifiuto su se stessi; stesso 404', async () => {
    const base = { password: 'e2e-password-par', is_staff: true, is_active: true, is_superuser: false };
    const a = (await rest(su, 'post', '/api/bo/utenti', { ...base, username: `e2e_par_da_${uniq()}`.slice(0, 30) })).body;
    const b = (await rest(su, 'post', '/api/bo/utenti', { ...base, username: `e2e_par_db_${uniq()}`.slice(0, 30) })).body;
    const r = await rest(su, 'delete', `/api/bo/utenti/${a.id}`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual(a);
    expect(expectOk(await gql(su, UT_DEL, { id: b.id })).eliminaUtente).toEqual(b);
    const me = (await rest(su, 'get', '/api/bo/me')).body;
    sameError(await rest(su, 'delete', `/api/bo/utenti/${me.id}`), await gql(su, UT_DEL, { id: me.id }));
    sameError(await rest(su, 'delete', `/api/bo/utenti/${a.id}`), await gql(su, UT_DEL, { id: b.id }));
  });
});

test.describe('eccezioni di parità dichiarate (P-1 … P-5)', () => {
  test('P-1 associazioni null in modifica: REST le cancella tutte, GraphQL le lascia ([] le cancella)', async () => {
    const make = async () => (await rest(staff, 'post', '/api/bo/episodi', epInput(ep, { titolo: `[E2E] P-1 ${uniq()}` }))).body;
    const a = await make();
    const b = await make();
    expect(a.associazioni).toHaveLength(3);
    // REST: associazioni: null → tutte cancellate (episodi.ml:111)
    const r = await rest(staff, 'put', `/api/bo/episodi/${a.id}`, epInput(a, { associazioni: null }));
    expect(r.status).toBe(200);
    expect(r.body.associazioni).toEqual([]);
    // GraphQL: null o assente → restano come sono
    const conNull = expectOk(await gql(staff, EP_AGG, { id: b.id, d: epInput(b, { associazioni: null }) })).aggiornaEpisodio;
    expect(conNull.associazioni).toEqual(b.associazioni);
    const d = epInput(b);
    delete d.associazioni;
    expect(expectOk(await gql(staff, EP_AGG, { id: b.id, d })).aggiornaEpisodio.associazioni).toEqual(b.associazioni);
    // GraphQL: [] → tutte cancellate
    expect(expectOk(await gql(staff, EP_AGG, { id: b.id, d: epInput(b, { associazioni: [] }) })).aggiornaEpisodio.associazioni).toEqual([]);
    for (const x of [a, b]) await rest(staff, 'delete', `/api/bo/episodi/${x.id}`);
  });

  test('P-2 istante assente in un\'associazione: REST 00:00:00, GraphQL null', async () => {
    const d = { titolo: `[E2E] P-2 ${uniq()}`, data_uscita: '2001-08-01', durata: '0:30:00', associazioni: [{ videogame_id: games[0].id }] };
    const r = await rest(staff, 'post', '/api/bo/episodi', d);
    expect(r.status).toBe(201);
    expect(r.body.associazioni[0].istante).toBe('00:00:00');
    const g = expectOk(await gql(staff, EP_CREA, { d })).creaEpisodio;
    expect(g.associazioni[0].istante).toBeNull();
    // in GraphQL istante: null vale come assente
    const g2 = expectOk(await gql(staff, EP_CREA, { d: { ...d, associazioni: [{ videogame_id: games[0].id, istante: null }] } })).creaEpisodio;
    expect(g2.associazioni[0].istante).toBeNull();
    for (const x of [r.body, g, g2]) await rest(staff, 'delete', `/api/bo/episodi/${x.id}`);
  });

  test('P-3 valore duplicato: REST 409, GraphQL BAD_USER_INPUT con lo stesso messaggio', async () => {
    const vr = await rest(staff, 'post', '/api/bo/videogame', { rawg_slug: games[0].rawg_slug });
    expect(vr.status).toBe(409);
    expectCode(await gql(staff, VG_CREA, { d: { rawg_slug: games[0].rawg_slug } }), 'BAD_USER_INPUT', vr.body.message);
    const ur = await rest(su, 'post', '/api/bo/utenti', { username: USERS.staff.username, password: 'e2e-password' });
    expect(ur.status).toBe(409);
    expectCode(
      await gql(su, UT_CREA, { d: { username: USERS.staff.username, password: 'e2e-password', is_staff: true, is_active: true, is_superuser: false } }),
      'BAD_USER_INPUT',
      ur.body.message,
    );
  });

  test('P-4 Origin assente o estraneo: 403 con {message} su REST e su GraphQL (non errors[])', async ({ playwright }) => {
    // controllo positivo: con l'Origin giusto GraphQL risponde in JSON GraphQL
    expectOk(await gql(staff, '{ me { id } }'));
    for (const headers of [{ Origin: 'https://evil.example' }, {}]) {
      const ctx = await newContext(playwright, headers);
      const r = await ctx.post('/api/bo/login', { data: USERS.staff });
      const g = await ctx.post(ENDPOINT, { data: { query: LOGIN, variables: { c: USERS.staff } } });
      expect(r.status(), JSON.stringify(headers)).toBe(403);
      expect(g.status(), JSON.stringify(headers)).toBe(403);
      const rb = await r.json();
      const gb = await g.json();
      expect(gb).toEqual(rb);
      expect(gb.errors).toBeUndefined();
      await ctx.dispose();
    }
  });

  test('P-5 flag assenti in creazione utente: REST usa true, true, false; GraphQL rifiuta (GRAPHQL_VALIDATION)', async () => {
    const ua = `e2e_p5_a_${uniq()}`.slice(0, 30);
    const r = await rest(su, 'post', '/api/bo/utenti', { username: ua, password: 'e2e-password-p5' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body).toMatchObject({ is_staff: true, is_active: true, is_superuser: false });
    const ub = `e2e_p5_b_${uniq()}`.slice(0, 30);
    const g = await gql(su, `mutation($u: String!) { creaUtente(dati: { username: $u, password: "e2e-password-p5" }) { id } }`, { u: ub });
    expectCode(g, 'GRAPHQL_VALIDATION');
    expect(expectOk(await gql(su, UT_LIST, { r: ub })).elencoUtenti.totale).toBe(0);
    // anche in modifica i flag sono obbligatori
    expectCode(
      await gql(su, `mutation($id: Int!, $u: String!) { aggiornaUtente(id: $id, dati: { username: $u }) { id } }`, { id: r.body.id, u: ua }),
      'GRAPHQL_VALIDATION',
    );
    await rest(su, 'delete', `/api/bo/utenti/${r.body.id}`);
  });
});
