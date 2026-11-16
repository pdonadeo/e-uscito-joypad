// GraphQL: autenticazione, permessi, sessione condivisa con /api/bo, Origin e
// trasporto HTTP di /api/graphql (Fase 3.5.2). Contratto: docs/schema.graphql.
const { test, expect } = require('@playwright/test');
const { API_URL, USERS, django } = require('./env');
const { newContext, loggedIn } = require('./helpers');
const { ENDPOINT, F, gql, expectOk, expectCode, gqlLoggedIn } = require('./gql-helpers');

const LOGIN = `mutation($c: CredenzialiInput!) { login(credenziali: $c) { ${F.me} } }`;
const ME = `{ me { ${F.me} } }`;
const LOGOUT = 'mutation { logout }';
const NO_ID = 999999999; // id inesistente: un'operazione eseguita per errore non tocca dati veri

const EPISODIO = '{ titolo: "[E2E] anonimo", data_uscita: "2001-01-01", durata: "0:30:00" }';
const UTENTE = '{ username: "e2e_anonimo", password: "e2e-password", is_staff: true, is_active: true, is_superuser: false }';

// Tutte le operazioni tranne login e logout, con argomenti minimi validi.
const OPERAZIONI = {
  me: '{ me { id } }',
  elencoEpisodi: '{ elencoEpisodi { totale } }',
  episodio: `{ episodio(id: ${NO_ID}) { id } }`,
  elencoVideogame: '{ elencoVideogame { totale } }',
  videogame: `{ videogame(id: ${NO_ID}) { id } }`,
  elencoAssociazioni: '{ elencoAssociazioni { totale } }',
  associazione: `{ associazione(id: ${NO_ID}) { id } }`,
  elencoUtenti: '{ elencoUtenti { totale } }',
  utente: `{ utente(id: ${NO_ID}) { id } }`,
  creaEpisodio: `mutation { creaEpisodio(dati: ${EPISODIO}) { id } }`,
  aggiornaEpisodio: `mutation { aggiornaEpisodio(id: ${NO_ID}, dati: ${EPISODIO}) { id } }`,
  eliminaEpisodio: `mutation { eliminaEpisodio(id: ${NO_ID}) { id } }`,
  creaVideogame: 'mutation { creaVideogame(dati: { rawg_slug: "e2e-anonimo" }) { id } }',
  aggiornaVideogame: `mutation { aggiornaVideogame(id: ${NO_ID}, dati: { rawg_slug: "e2e-anonimo" }) { id } }`,
  eliminaVideogame: `mutation { eliminaVideogame(id: ${NO_ID}) { id } }`,
  creaUtente: `mutation { creaUtente(dati: ${UTENTE}) { id } }`,
  aggiornaUtente: `mutation { aggiornaUtente(id: ${NO_ID}, dati: ${UTENTE}) { id } }`,
  eliminaUtente: `mutation { eliminaUtente(id: ${NO_ID}) { id } }`,
};
const SOLO_SUPERUSER = ['elencoUtenti', 'utente', 'creaUtente', 'aggiornaUtente', 'eliminaUtente'];

test.describe('accesso', () => {
  test('anonimo: ogni query e mutation tranne login e logout → UNAUTHENTICATED', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    for (const [nome, query] of Object.entries(OPERAZIONI)) {
      const r = await gql(ctx, query);
      expect(r.data, nome).toBeNull();
      expectCode(r, 'UNAUTHENTICATED', 'Autenticazione richiesta');
    }
    await ctx.dispose();
  });

  test('anonimo: l\'introspection è consentita', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const data = expectOk(await gql(ctx, '{ __schema { queryType { name } mutationType { name } } __type(name: "Speaker") { name } }'));
    expect(data.__schema).toEqual({ queryType: { name: 'Query' }, mutationType: { name: 'Mutation' } });
    expect(data.__type.name).toBe('Speaker');
    await ctx.dispose();
  });

  test('anonimo: logout riesce sempre', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    expect(expectOk(await gql(ctx, LOGOUT)).logout).toBe(true);
    await ctx.dispose();
  });

  test('login di un utente staff → UtenteCorrente, poi me', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const login = expectOk(await gql(ctx, LOGIN, { c: USERS.staff })).login;
    expect(login).toMatchObject({ username: USERS.staff.username, fullName: USERS.staff.username, is_superuser: false });
    expect(expectOk(await gql(ctx, ME)).me).toEqual(login);
    await ctx.dispose();
  });

  for (const [nome, c] of [
    ['password errata', { username: USERS.staff.username, password: 'sbagliata' }],
    ['utente inesistente', { username: 'e2e_nessuno', password: 'qualcosa' }],
    ['utente non attivo', USERS.inactive],
    ['utente non staff', USERS.nonstaff],
  ]) {
    test(`login rifiutato: ${nome} → UNAUTHENTICATED, nessuna sessione`, async ({ playwright }) => {
      const ctx = await newContext(playwright);
      const r = await gql(ctx, LOGIN, { c: { username: c.username, password: c.password } });
      expect(r.data).toBeNull();
      expectCode(r, 'UNAUTHENTICATED', 'Credenziali non valide o utente non abilitato');
      expectCode(await gql(ctx, ME), 'UNAUTHENTICATED');
      expect((await ctx.get('/api/bo/me')).status()).toBe(401);
      await ctx.dispose();
    });
  }

  test('staff: le operazioni sugli utenti → FORBIDDEN, il resto è consentito', async ({ playwright }) => {
    const ctx = await gqlLoggedIn(playwright, USERS.staff);
    for (const nome of SOLO_SUPERUSER) {
      const r = await gql(ctx, OPERAZIONI[nome]);
      expect(r.data, nome).toBeNull();
      expectCode(r, 'FORBIDDEN', 'Operazione riservata ai superuser');
    }
    for (const nome of ['me', 'elencoEpisodi', 'elencoVideogame', 'elencoAssociazioni']) {
      expectOk(await gql(ctx, OPERAZIONI[nome]));
    }
    // il 403 non chiude la sessione (F-AU-04)
    expectOk(await gql(ctx, ME));
    await ctx.dispose();
  });

  test('superuser: tutte le query sono consentite', async ({ playwright }) => {
    const ctx = await gqlLoggedIn(playwright, USERS.superuser);
    for (const nome of ['me', 'elencoEpisodi', 'elencoVideogame', 'elencoAssociazioni', 'elencoUtenti']) {
      expectOk(await gql(ctx, OPERAZIONI[nome]));
    }
    for (const nome of ['episodio', 'videogame', 'associazione', 'utente']) {
      expectCode(await gql(ctx, OPERAZIONI[nome]), 'NOT_FOUND', 'Risorsa non trovata');
    }
    await ctx.dispose();
  });

  test('raffica di login: oltre 2 in corso + 8 in coda → RATE_LIMITED, poi si torna normali', async ({ playwright }) => {
    // fetch di Node apre una connessione per richiesta: 16 login davvero concorrenti
    const codes = await Promise.all(
      Array.from({ length: 16 }, () =>
        fetch(`${API_URL}${ENDPOINT}`, {
          method: 'POST',
          headers: { Origin: API_URL, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: LOGIN, variables: { c: { username: 'e2e_nessuno', password: 'x' } } }),
        }).then(async (res) => {
          const text = await res.text();
          let body;
          try {
            body = JSON.parse(text);
          } catch {
            throw new Error(`POST ${ENDPOINT} → HTTP ${res.status}: risposta non JSON (endpoint non ancora implementato)`);
          }
          return body.errors[0].extensions.code;
        }),
      ),
    );
    expect(codes.filter((c) => c === 'RATE_LIMITED').length).toBeGreaterThanOrEqual(6);
    expect(codes.every((c) => c === 'UNAUTHENTICATED' || c === 'RATE_LIMITED')).toBe(true);
    const ctx = await newContext(playwright);
    expectOk(await gql(ctx, LOGIN, { c: USERS.staff }));
    await ctx.dispose();
  });
});

test.describe('sessione condivisa con /api/bo', () => {
  test('login GraphQL: Set-Cookie dream.session con Path=/', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const r = await gql(ctx, LOGIN, { c: USERS.staff });
    expectOk(r);
    const cookie = r.res.headers()['set-cookie'];
    expect(cookie).toContain('dream.session=');
    expect(cookie).toMatch(/;\s*Path=\/(;|$)/);
    expect(cookie).toMatch(/HttpOnly/i);
    await ctx.dispose();
  });

  test('login su REST → me su GraphQL', async ({ playwright }) => {
    const ctx = await loggedIn(playwright, USERS.staff);
    const rest = await (await ctx.get('/api/bo/me')).json();
    expect(expectOk(await gql(ctx, ME)).me).toEqual(rest);
    await ctx.dispose();
  });

  test('login su GraphQL → /api/bo/me', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const login = expectOk(await gql(ctx, LOGIN, { c: USERS.superuser })).login;
    const me = await ctx.get('/api/bo/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toEqual(login);
    await ctx.dispose();
  });

  test('logout su REST → anonimo su REST e su GraphQL', async ({ playwright }) => {
    const ctx = await gqlLoggedIn(playwright, USERS.staff);
    expect((await ctx.post('/api/bo/logout')).status()).toBe(200);
    expect((await ctx.get('/api/bo/me')).status()).toBe(401);
    expectCode(await gql(ctx, ME), 'UNAUTHENTICATED', 'Autenticazione richiesta');
    await ctx.dispose();
  });

  test('logout su GraphQL → anonimo su GraphQL e su REST', async ({ playwright }) => {
    const ctx = await loggedIn(playwright, USERS.staff);
    expect(expectOk(await gql(ctx, LOGOUT)).logout).toBe(true);
    expectCode(await gql(ctx, ME), 'UNAUTHENTICATED');
    expect((await ctx.get('/api/bo/me')).status()).toBe(401);
    await ctx.dispose();
  });

  test('il cambio password (da Django) chiude la sessione GraphQL', async ({ playwright }) => {
    const victim = { username: 'e2e_gql_pwchange', password: 'e2e-password-old' };
    django(`from django.contrib.auth.models import User
u, _ = User.objects.get_or_create(username="${victim.username}")
u.set_password("${victim.password}"); u.is_staff = True; u.is_active = True; u.save()`);
    const ctx = await gqlLoggedIn(playwright, victim);
    expectOk(await gql(ctx, ME));
    django(`from django.contrib.auth.models import User
u = User.objects.get(username="${victim.username}"); u.set_password("e2e-password-new"); u.save()`);
    expectCode(await gql(ctx, ME), 'UNAUTHENTICATED');
    expect((await ctx.get('/api/bo/me')).status()).toBe(401);
    await ctx.dispose();
  });

  test('il cambio password con aggiornaUtente chiude le sessioni di quell\'utente', async ({ playwright }) => {
    const victim = { username: 'e2e_gql_pwchange2', password: 'e2e-password-old' };
    const id = django(`from django.contrib.auth.models import User
u, _ = User.objects.get_or_create(username="${victim.username}")
u.set_password("${victim.password}"); u.is_staff = True; u.is_active = True; u.save(); print(u.id)`)
      .split('\n')
      .pop();
    const vctx = await gqlLoggedIn(playwright, victim);
    const su = await gqlLoggedIn(playwright, USERS.superuser);
    expectOk(
      await gql(su, `mutation($id: Int!, $d: UtenteInput!) { aggiornaUtente(id: $id, dati: $d) { id } }`, {
        id: Number(id),
        d: { username: victim.username, password: 'e2e-password-new', is_staff: true, is_active: true, is_superuser: false },
      }),
    );
    expectCode(await gql(vctx, ME), 'UNAUTHENTICATED');
    expectOk(await gql(su, ME));
    await vctx.dispose();
    await su.dispose();
  });

  test('un utente disattivato perde subito l\'accesso anche su GraphQL', async ({ playwright }) => {
    const u = { username: 'e2e_gql_deact', password: 'e2e-password-deact' };
    django(`from django.contrib.auth.models import User
x, _ = User.objects.get_or_create(username="${u.username}")
x.set_password("${u.password}"); x.is_staff = True; x.is_active = True; x.save()`);
    const ctx = await gqlLoggedIn(playwright, u);
    django(`from django.contrib.auth.models import User
User.objects.filter(username="${u.username}").update(is_active=False)`);
    expectCode(await gql(ctx, '{ elencoEpisodi { totale } }'), 'UNAUTHENTICATED');
    await ctx.dispose();
  });
});

test.describe('Origin e trasporto HTTP', () => {
  test('Origin estraneo o assente → 403 con il JSON REST {message}, non errors[]', async ({ playwright }) => {
    // controllo positivo: con l'Origin dello stesso host l'endpoint risponde
    const ok = await newContext(playwright);
    expectOk(await gql(ok, LOGOUT));
    await ok.dispose();
    for (const headers of [{ Origin: 'https://evil.example' }, {}]) {
      const ctx = await newContext(playwright, headers);
      const res = await ctx.post(ENDPOINT, { data: { query: LOGOUT } });
      expect(res.status(), JSON.stringify(headers)).toBe(403);
      const body = await res.json();
      expect(body.message).toBeTruthy();
      expect(body.errors).toBeUndefined();
      await ctx.dispose();
    }
  });

  test('DEBUG: nessun header CORS riflessivo su /api/graphql', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const r = await gql(ctx, ME);
    expectCode(r, 'UNAUTHENTICATED');
    expect(r.res.headers()['access-control-allow-origin']).toBeUndefined();
    expect(r.res.headers()['access-control-allow-credentials']).toBeUndefined();
    await ctx.dispose();
  });

  test('DEBUG: POST /api/graphql/ → 303 verso /api/graphql, mai la pagina di debug HTML', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const res = await ctx.post(`${ENDPOINT}/`, { data: { query: ME }, maxRedirects: 0 });
    expect(res.status()).toBe(303);
    expect(res.headers().location).toBe(ENDPOINT);
    expect(res.headers()['content-type'] || '').not.toContain('text/html');
    expect(await res.text()).not.toMatch(/<html/i);
    await ctx.dispose();
  });

  test('GET /api/graphql → 404 (solo POST)', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    expectOk(await gql(ctx, LOGOUT)); // l'endpoint esiste in POST
    const res = await ctx.get(ENDPOINT);
    expect(res.status()).toBe(404);
    await ctx.dispose();
  });

  test('Content-Type con charset → 400 con errors[] BAD_USER_INPUT', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const res = await ctx.post(ENDPOINT, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      data: JSON.stringify({ query: ME }),
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).errors[0].extensions.code).toBe('BAD_USER_INPUT');
    await ctx.dispose();
  });

  test('body non JSON o JSON che non è un oggetto → 400 BAD_USER_INPUT, non 500', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    for (const data of [Buffer.from('{ non è JSON'), 'una stringa JSON']) {
      const res = await ctx.post(ENDPOINT, { headers: { 'Content-Type': 'application/json' }, data });
      expect(res.status()).toBe(400);
      expect((await res.json()).errors[0].extensions.code).toBe('BAD_USER_INPUT');
    }
    await ctx.dispose();
  });

  test('query non valida per lo schema → status 200 e GRAPHQL_VALIDATION', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    expectCode(await gql(ctx, '{ inesistente }'), 'GRAPHQL_VALIDATION');
    expectCode(await gql(ctx, '{ me { '), 'GRAPHQL_VALIDATION');
    expectCode(await gql(ctx, '{ elencoEpisodi(ordinamento: ALTRO) { totale } }'), 'GRAPHQL_VALIDATION');
    await ctx.dispose();
  });
});
