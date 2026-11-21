// GraphQL: cambio della propria password (F-AU-06, Fase 3.6c.4d). Ogni test crea i suoi utenti
// «e2e_…» via GraphQL dal superuser di test (il teardown li cancella): gli utenti condivisi di
// env.js non cambiano mai password.
const { randomInt } = require('node:crypto');
const { test, expect } = require('@playwright/test');
const { USERS, django } = require('./env');
const { loggedIn, newContext } = require('./helpers');
const { F, gql, expectOk, expectCode, gqlLoggedIn, creaUtente } = require('./gql-helpers');

const CAMBIA = `mutation($a: String!, $n: String!) { cambiaPassword(attuale: $a, nuova: $n) { ${F.me} } }`;
const ME = `{ me { ${F.me} } }`;
const LOGIN = `mutation($c: CredenzialiInput!) { login(credenziali: $c) { ${F.me} } }`;

const VECCHIA = 'e2e-password-vecchia';
const NUOVA = 'e2e-password-nuova!';

let su;

test.beforeAll(async ({ playwright }) => {
  su = await loggedIn(playwright, USERS.superuser);
});

test.afterAll(async () => {
  await su.dispose();
});

const token = () => `${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;

// Un utente staff e attivo creato via GraphQL, con password VECCHIA.
async function nuovoUtente(extra = {}) {
  const username = `e2e_gcp_${token()}`;
  const u = await creaUtente(su, { username, password: VECCHIA, is_staff: true, is_active: true, is_superuser: false, ...extra });
  return { ...u, password: VECCHIA };
}

// Riesce il login GraphQL con questa password?
async function puoEntrare(playwright, username, password) {
  const ctx = await newContext(playwright);
  const r = await gql(ctx, LOGIN, { c: { username, password } });
  await ctx.dispose();
  if (r.errors) {
    expectCode(r, 'UNAUTHENTICATED', 'Credenziali non valide o utente non abilitato');
    return false;
  }
  return true;
}

// L'hash salvato in auth_user (letto da Django).
const hash = (username) =>
  django(`from django.contrib.auth.models import User
print(User.objects.get(username="${username}").password)`)
    .split('\n')
    .pop();

for (const superuser of [false, true]) {
  const chi = superuser ? 'superuser' : 'staff non superuser';
  test(`${chi}: cambia la propria password; la sessione resta, le altre si chiudono, vale solo la nuova`, async ({
    playwright,
  }) => {
    const u = await nuovoUtente({ is_superuser: superuser });
    const qui = await gqlLoggedIn(playwright, u);
    const altrove = await gqlLoggedIn(playwright, u);

    const me = expectOk(await gql(qui, CAMBIA, { a: VECCHIA, n: NUOVA })).cambiaPassword;
    expect(me).toEqual({ id: u.id, username: u.username, fullName: u.username, is_superuser: superuser });

    // la sessione corrente funziona
    expect(expectOk(await gql(qui, ME)).me.id).toBe(u.id);
    // un'altra sessione dello stesso utente è chiusa (F-AU-05)
    expectCode(await gql(altrove, ME), 'UNAUTHENTICATED', 'Autenticazione richiesta');

    expect(await puoEntrare(playwright, u.username, NUOVA)).toBe(true);
    expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(false);
    await qui.dispose();
    await altrove.dispose();
  });
}

test('l\'hash nuovo è pbkdf2_sha256 con le iterazioni di F-UT-04 e Django lo accetta', async ({ playwright }) => {
  const u = await nuovoUtente();
  const ctx = await gqlLoggedIn(playwright, u);
  const prima = hash(u.username);
  expectOk(await gql(ctx, CAMBIA, { a: VECCHIA, n: NUOVA }));
  const out = django(`from django.contrib.auth import authenticate
from django.contrib.auth.models import User
u = User.objects.get(username="${u.username}")
hashes = [x.password for x in User.objects.exclude(username="${u.username}") if x.password.startswith("pbkdf2_sha256$")]
massimo = max([int(h.split("$")[1]) for h in hashes] or [0])
print(u.password.split("$")[0], u.password.split("$")[1], massimo, authenticate(username="${u.username}", password="${NUOVA}") is not None)`);
  const [alg, iterazioni, massimo, ok] = out.split('\n').pop().split(' ');
  expect(alg).toBe('pbkdf2_sha256');
  // F-UT-04: le iterazioni del più robusto tra gli hash esistenti, con un minimo di 1.500.000
  expect(Number(iterazioni)).toBe(Math.max(Number(massimo), 1500000));
  expect(ok).toBe('True');
  expect(hash(u.username)).not.toBe(prima);
  await ctx.dispose();
});

test('password attuale sbagliata → BAD_USER_INPUT, password invariata, sessione aperta', async ({ playwright }) => {
  const u = await nuovoUtente();
  const ctx = await gqlLoggedIn(playwright, u);
  const altrove = await gqlLoggedIn(playwright, u);
  const prima = hash(u.username);
  for (const a of ['password-sbagliata', '', VECCHIA.toUpperCase()]) {
    expectCode(await gql(ctx, CAMBIA, { a, n: NUOVA }), 'BAD_USER_INPUT', 'La password attuale non è corretta');
  }
  expect(hash(u.username)).toBe(prima);
  // MAI UNAUTHENTICATED: la sessione resta valida, e anche le altre dello stesso utente
  expect(expectOk(await gql(ctx, ME)).me.id).toBe(u.id);
  expect(expectOk(await gql(altrove, ME)).me.id).toBe(u.id);
  await altrove.dispose();
  expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(true);
  expect(await puoEntrare(playwright, u.username, NUOVA)).toBe(false);
  await ctx.dispose();
});

test('nuova password corta → BAD_USER_INPUT, password invariata; 8 caratteri bastano', async ({ playwright }) => {
  const u = await nuovoUtente();
  const ctx = await gqlLoggedIn(playwright, u);
  const prima = hash(u.username);
  for (const n of ['', 'corta', '1234567']) {
    expectCode(await gql(ctx, CAMBIA, { a: VECCHIA, n }), 'BAD_USER_INPUT', 'Campo «password»: almeno 8 caratteri');
  }
  expect(hash(u.username)).toBe(prima);
  expect(expectOk(await gql(ctx, ME)).me.id).toBe(u.id);
  expectOk(await gql(ctx, CAMBIA, { a: VECCHIA, n: '12345678' }));
  expect(await puoEntrare(playwright, u.username, '12345678')).toBe(true);
  await ctx.dispose();
});

test('anonimo → UNAUTHENTICATED, nessuna password cambiata', async ({ playwright }) => {
  const ctx = await newContext(playwright);
  expectCode(await gql(ctx, CAMBIA, { a: USERS.staff.password, n: NUOVA }), 'UNAUTHENTICATED', 'Autenticazione richiesta');
  await ctx.dispose();
  expect(await puoEntrare(playwright, USERS.staff.username, USERS.staff.password)).toBe(true);
});

test('un solo cambio per richiesta: il secondo alias → BAD_USER_INPUT, vale il primo', async ({ playwright }) => {
  const u = await nuovoUtente();
  const ctx = await gqlLoggedIn(playwright, u);
  const r = await gql(
    ctx,
    `mutation($a: String!) {
      uno: cambiaPassword(attuale: $a, nuova: "e2e-password-uno") { id }
      due: cambiaPassword(attuale: "e2e-password-uno", nuova: "e2e-password-due") { id }
    }`,
    { a: VECCHIA },
  );
  expectCode(r, 'BAD_USER_INPUT', 'È ammesso un solo cambio di password per richiesta');
  expect(r.errors[0].path).toEqual(['due']);
  expect(expectOk(await gql(ctx, ME)).me.id).toBe(u.id);
  expect(await puoEntrare(playwright, u.username, 'e2e-password-uno')).toBe(true);
  expect(await puoEntrare(playwright, u.username, 'e2e-password-due')).toBe(false);
  await ctx.dispose();
});

test('primo alias con la password sbagliata: l\'esecuzione si ferma, niente tentativi in serie con gli alias', async ({
  playwright,
}) => {
  const u = await nuovoUtente();
  const ctx = await gqlLoggedIn(playwright, u);
  const prima = hash(u.username);
  const r = await gql(
    ctx,
    `mutation($a: String!) {
      uno: cambiaPassword(attuale: "password-sbagliata", nuova: "e2e-password-uno") { id }
      due: cambiaPassword(attuale: $a, nuova: "e2e-password-due") { id }
    }`,
    { a: VECCHIA },
  );
  expect(r.status).toBe(200);
  // l'errore di un campo non nullo arriva alla radice della mutation (data null) e graphql-lwt non
  // esegue i campi successivi: «due», che avrebbe la password giusta, non parte. Se partisse,
  // troverebbe comunque la guardia del cambio unico (impostata prima della verifica)
  expect(r.errors.map((e) => [e.path, e.extensions.code, e.message])).toEqual([
    [['uno'], 'BAD_USER_INPUT', 'La password attuale non è corretta'],
  ]);
  expect(r.data).toBeNull();
  expect(hash(u.username)).toBe(prima);
  expect(expectOk(await gql(ctx, ME)).me.id).toBe(u.id);
  expect(await puoEntrare(playwright, u.username, VECCHIA)).toBe(true);
  await ctx.dispose();
});
