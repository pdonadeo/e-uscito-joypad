// GraphQL: gestione utenti, solo superuser (F-UT-01 … F-UT-06).
const { test, expect } = require('@playwright/test');
const { USERS, sql, verificaHashDjango, salvaUtente } = require('./env');
const { loggedIn, newContext, uniq } = require('./helpers');
const { F, gql, expectOk, expectCode, gqlLoggedIn, me: utenteCorrente } = require('./gql-helpers');

const CREA = `mutation($d: UtenteInput!) { creaUtente(dati: $d) { ${F.utente} } }`;
const AGGIORNA = `mutation($id: Int!, $d: UtenteInput!) { aggiornaUtente(id: $id, dati: $d) { ${F.utente} } }`;
const ELIMINA = `mutation($id: Int!) { eliminaUtente(id: $id) { ${F.utente} } }`;
const DETTAGLIO = `query($id: Int!) { utente(id: $id) { ${F.utente} } }`;
const ELENCO = `query($o: Int, $l: Int, $r: String, $ord: OrdinamentoUtenti, $dir: Direzione) {
  elencoUtenti(offset: $o, limit: $l, ricerca: $r, ordinamento: $ord, direzione: $dir) { totale elementi { ${F.utente} } } }`;
const LOGIN = `mutation($c: CredenzialiInput!) { login(credenziali: $c) { ${F.me} } }`;

let su;
let me;

// Campi di UtenteInput a partire da un Utente (i flag sono obbligatori).
const input = (u, patch = {}) => ({
  username: u.username,
  first_name: u.first_name,
  last_name: u.last_name,
  email: u.email,
  is_staff: u.is_staff,
  is_active: u.is_active,
  is_superuser: u.is_superuser,
  ...patch,
});

test.beforeAll(async ({ playwright }) => {
  su = await loggedIn(playwright, USERS.superuser);
  me = await utenteCorrente(su);
});

test.afterAll(async () => {
  await su.dispose();
});

test('elencoUtenti: ricerca, ordinamento di default per username, nessun campo password', async () => {
  const page = expectOk(await gql(su, ELENCO, { r: 'E2E_', o: 0, l: 100 })).elencoUtenti;
  expect(page.totale).toBeGreaterThanOrEqual(4);
  const names = page.elementi.map((u) => u.username);
  expect(names).toEqual(expect.arrayContaining(Object.values(USERS).map((u) => u.username)));
  const esplicito = expectOk(await gql(su, ELENCO, { r: 'e2e_', l: 100, ord: 'USERNAME', dir: 'ASC' })).elencoUtenti;
  expect(esplicito.elementi.map((u) => u.username)).toEqual(names);
  for (const ord of ['FIRST_NAME', 'LAST_NAME', 'EMAIL', 'IS_STAFF', 'IS_ACTIVE', 'IS_SUPERUSER', 'LAST_LOGIN']) {
    for (const dir of ['ASC', 'DESC']) {
      expect(expectOk(await gql(su, ELENCO, { r: 'e2e_', ord, dir })).elencoUtenti.totale, `${ord} ${dir}`).toBe(page.totale);
    }
  }
  // il tipo Utente non espone la password
  const t = expectOk(await gql(su, '{ __type(name: "Utente") { fields { name } } }')).__type;
  expect(t.fields.map((f) => f.name)).not.toContain('password');
});

test('utente: dettaglio; id inesistente → NOT_FOUND', async () => {
  const got = expectOk(await gql(su, DETTAGLIO, { id: me.id })).utente;
  expect(got).toMatchObject({ id: me.id, username: USERS.superuser.username, is_superuser: true, is_staff: true, is_active: true });
  expect(got.date_joined).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expectCode(await gql(su, DETTAGLIO, { id: 999999999 }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('creaUtente: hash Django valido, login GraphQL; aggiornaUtente senza password la conserva', async ({ playwright }) => {
  const user = { username: `e2e_gql_${uniq()}`.slice(0, 30), password: 'e2e-password-nuova' };
  const created = expectOk(
    await gql(su, CREA, {
      d: { ...user, email: 'nuovo@example.com', first_name: 'Nuovo', is_staff: true, is_active: true, is_superuser: false },
    }),
  ).creaUtente;
  expect(created).toMatchObject({
    username: user.username,
    first_name: 'Nuovo',
    last_name: '',
    email: 'nuovo@example.com',
    is_staff: true,
    is_active: true,
    is_superuser: false,
    last_login: null,
  });
  const salvato = sql(`SELECT password FROM auth_user WHERE username = :'u'`, { u: user.username });
  const [alg, iterations] = salvato.split('$');
  expect(alg).toBe('pbkdf2_sha256');
  expect(Number(iterations)).toBeGreaterThanOrEqual(1500000);
  expect(verificaHashDjango(user.password, salvato)).toBe(true);

  const ctx = await gqlLoggedIn(playwright, user);
  await ctx.dispose();

  // senza password la password resta; nome, cognome ed email assenti diventano vuoti
  const upd = expectOk(await gql(su, AGGIORNA, { id: created.id, d: input(created, { first_name: undefined, last_name: 'Cognome', email: undefined }) }))
    .aggiornaUtente;
  expect(upd).toMatchObject({ first_name: '', last_name: 'Cognome', email: '' });
  const again = await newContext(playwright);
  expectOk(await gql(again, LOGIN, { c: user }));
  await again.dispose();

  const deleted = expectOk(await gql(su, ELIMINA, { id: created.id })).eliminaUtente;
  expect(deleted).toMatchObject({ id: created.id, username: user.username });
  expectCode(await gql(su, DETTAGLIO, { id: created.id }), 'NOT_FOUND');
});

test('creaUtente: validazioni → BAD_USER_INPUT', async () => {
  const flags = { is_staff: true, is_active: true, is_superuser: false };
  expectCode(
    await gql(su, CREA, { d: { username: USERS.staff.username, password: 'e2e-password', ...flags } }),
    'BAD_USER_INPUT',
    'Esiste già un utente con questo username',
  );
  for (const d of [
    { username: 'e2e_gql_short', password: 'corta', ...flags },
    { username: 'e2e_gql_nopw', ...flags },
    { username: 'con spazi', password: 'e2e-password', ...flags },
    { username: 'x'.repeat(151), password: 'e2e-password', ...flags },
  ]) {
    const r = await gql(su, CREA, { d });
    expect(r.data, JSON.stringify(d)).toBeNull();
    expectCode(r, 'BAD_USER_INPUT');
  }
});

test('eliminaUtente: nessuna FK punta ad auth_user e la cancellazione riesce', async () => {
  // dopo la migrazione 0002 le tabelle di Django (e le loro FK verso auth_user) non ci sono più
  expect(sql(`SELECT count(*) FROM pg_constraint WHERE confrelid = 'auth_user'::regclass`)).toBe('0');
  const username = `e2e_gql_del_${uniq()}`.slice(0, 30);
  const id = salvaUtente({ username, password: 'e2e-password-del' });
  expect(expectOk(await gql(su, ELIMINA, { id })).eliminaUtente.username).toBe(username);
  expect(sql(`SELECT count(*) FROM auth_user WHERE id = :'id'::int`, { id })).toBe('0');
  expectCode(await gql(su, ELIMINA, { id: 999999999 }), 'NOT_FOUND', 'Risorsa non trovata');
});

test('un superuser non può cancellarsi né togliersi i privilegi', async () => {
  expectCode(await gql(su, ELIMINA, { id: me.id }), 'BAD_USER_INPUT', 'Non puoi cancellare te stesso');
  const self = expectOk(await gql(su, DETTAGLIO, { id: me.id })).utente;
  for (const flag of ['is_superuser', 'is_staff', 'is_active']) {
    expectCode(
      await gql(su, AGGIORNA, { id: me.id, d: input(self, { [flag]: false }) }),
      'BAD_USER_INPUT',
      'Non puoi togliere a te stesso i privilegi di staff, attivo o superuser',
    );
  }
  expectOk(await gql(su, `{ me { id } }`));
});

test('un superuser che cambia la propria password con aggiornaUtente resta loggato', async ({ playwright }) => {
  const u = { username: `e2e_gql_selfpw_${uniq()}`.slice(0, 30), password: 'e2e-password-self-1' };
  salvaUtente({ ...u, is_superuser: true });
  const ctx = await gqlLoggedIn(playwright, u);
  const self = expectOk(await gql(ctx, `{ me { id } }`)).me;
  const rec = expectOk(await gql(ctx, DETTAGLIO, { id: self.id })).utente;
  expectOk(await gql(ctx, AGGIORNA, { id: self.id, d: input(rec, { password: 'e2e-password-self-2' }) }));
  expectOk(await gql(ctx, `{ me { id } }`));
  const other = await newContext(playwright);
  expectOk(await gql(other, LOGIN, { c: { ...u, password: 'e2e-password-self-2' } }));
  await other.dispose();
  await ctx.dispose();
});
