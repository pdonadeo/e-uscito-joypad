// GraphQL: gestione utenti, solo superuser (F-UT-01 … F-UT-06).
const { test, expect } = require('@playwright/test');
const { USERS, django } = require('./env');
const { loggedIn, newContext, uniq } = require('./helpers');
const { F, gql, expectOk, expectCode, gqlLoggedIn } = require('./gql-helpers');

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
  me = await (await su.get('/api/bo/me')).json();
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
  const out = django(`from django.contrib.auth import authenticate
from django.contrib.auth.models import User
u = User.objects.get(username="${user.username}")
print(u.password.split("$")[0], u.password.split("$")[1], authenticate(username="${user.username}", password="${user.password}") is not None)`);
  const [alg, iterations, ok] = out.split('\n').pop().split(' ');
  expect(alg).toBe('pbkdf2_sha256');
  expect(Number(iterations)).toBeGreaterThanOrEqual(1500000);
  expect(ok).toBe('True');

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

test('eliminaUtente: un utente con righe in django_admin_log si cancella', async () => {
  const username = `e2e_gql_log_${uniq()}`.slice(0, 30);
  const id = django(`from django.contrib.auth.models import User
from django.contrib.admin.models import LogEntry, ADDITION
u = User.objects.create_user(username="${username}", password="e2e-password-log", is_staff=True)
LogEntry.objects.create(user=u, action_flag=ADDITION, object_repr="e2e", change_message="e2e")
print(u.id)`)
    .split('\n')
    .pop();
  expect(expectOk(await gql(su, ELIMINA, { id: Number(id) })).eliminaUtente.username).toBe(username);
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
  django(`from django.contrib.auth.models import User
User.objects.create_user(username="${u.username}", password="${u.password}", is_staff=True, is_superuser=True)`);
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
