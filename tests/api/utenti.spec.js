// Gestione utenti (solo superuser) e compatibilità degli hash con Django.
const { test, expect } = require('@playwright/test');
const { USERS, django } = require('./env');
const { listQuery, loggedIn, newContext, uniq } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let su;
let me;

test.beforeAll(async ({ playwright }) => {
  su = await loggedIn(playwright, USERS.superuser);
  me = await (await su.get('/api/bo/me')).json();
});

test.afterAll(async () => {
  await su.dispose();
});

test('un utente staff non superuser riceve 403', async ({ playwright }) => {
  const staff = await loggedIn(playwright, USERS.staff);
  expect((await staff.get('/api/bo/utenti')).status()).toBe(403);
  expect((await staff.post('/api/bo/utenti', { data: { username: 'e2e_x', password: 'e2e-password' } })).status()).toBe(
    403,
  );
  await staff.dispose();
});

test('la lista non espone mai la password', async () => {
  const res = await su.get(`/api/bo/utenti${listQuery({ range: [0, 99], filter: { q: 'e2e_' } })}`);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-range']).toMatch(/^utenti 0-\d+\/\d+$/);
  const rows = await res.json();
  expect(rows.length).toBeGreaterThanOrEqual(4);
  for (const r of rows) expect(r.password).toBeUndefined();
  const one = await (await su.get(`/api/bo/utenti/${rows[0].id}`)).json();
  expect(one.password).toBeUndefined();
});

test('utente creato dall\'API: hash Django valido, login su /api/bo e in Django', async ({ playwright }) => {
  const user = { username: `e2e_new_${uniq()}`.slice(0, 30), password: 'e2e-password-nuova' };
  const res = await su.post('/api/bo/utenti', {
    data: { ...user, email: 'nuovo@example.com', first_name: 'Nuovo', is_staff: true },
  });
  expect(res.status(), await res.text()).toBe(201);
  const created = await res.json();
  expect(created).toMatchObject({ username: user.username, is_staff: true, is_active: true, is_superuser: false });
  expect(created.password).toBeUndefined();

  const out = django(`from django.contrib.auth import authenticate
from django.contrib.auth.models import User
u = User.objects.get(username="${user.username}")
print(u.password.split("$")[0], u.password.split("$")[1], authenticate(username="${user.username}", password="${user.password}") is not None)`);
  const [alg, iterations, ok] = out.split('\n').pop().split(' ');
  expect(alg).toBe('pbkdf2_sha256');
  expect(Number(iterations)).toBeGreaterThanOrEqual(1500000);
  expect(ok).toBe('True');

  const ctx = await loggedIn(playwright, user);
  expect((await ctx.get('/api/bo/me')).status()).toBe(200);
  await ctx.dispose();

  // PUT senza password: la password resta quella di prima
  const upd = await su.put(`/api/bo/utenti/${created.id}`, { data: { ...created, last_name: 'Cognome' } });
  expect(upd.status(), await upd.text()).toBe(200);
  expect((await upd.json()).last_name).toBe('Cognome');
  const again = await newContext(playwright);
  expect((await again.post('/api/bo/login', { data: user })).status()).toBe(200);
  await again.dispose();

  const del = await su.delete(`/api/bo/utenti/${created.id}`);
  expect(del.status()).toBe(200);
  expect((await su.get(`/api/bo/utenti/${created.id}`)).status()).toBe(404);
});

test('cancellare un utente con righe in django_admin_log non fallisce', async () => {
  const username = `e2e_logged_${uniq()}`.slice(0, 30);
  const id = django(`from django.contrib.auth.models import User
from django.contrib.admin.models import LogEntry, ADDITION
u = User.objects.create_user(username="${username}", password="e2e-password-log", is_staff=True)
LogEntry.objects.create(user=u, action_flag=ADDITION, object_repr="e2e", change_message="e2e")
print(u.id)`)
    .split('\n')
    .pop();
  const res = await su.delete(`/api/bo/utenti/${id}`);
  expect(res.status(), await res.text()).toBe(200);
});

test('validazioni: username duplicato, password corta, campi obbligatori', async () => {
  const dup = await su.post('/api/bo/utenti', { data: { username: USERS.staff.username, password: 'e2e-password' } });
  expect(dup.status()).toBe(409);
  const short = await su.post('/api/bo/utenti', { data: { username: 'e2e_short', password: 'corta' } });
  expect(short.status()).toBe(400);
  const nopw = await su.post('/api/bo/utenti', { data: { username: 'e2e_nopw' } });
  expect(nopw.status()).toBe(400);
  const badname = await su.post('/api/bo/utenti', { data: { username: 'con spazi', password: 'e2e-password' } });
  expect(badname.status()).toBe(400);
});

test('un superuser non può cancellarsi né togliersi i privilegi', async () => {
  expect((await su.delete(`/api/bo/utenti/${me.id}`)).status()).toBe(400);
  const self = await (await su.get(`/api/bo/utenti/${me.id}`)).json();
  for (const flag of ['is_superuser', 'is_staff', 'is_active']) {
    const res = await su.put(`/api/bo/utenti/${me.id}`, { data: { ...self, [flag]: false } });
    expect(res.status(), flag).toBe(400);
  }
  expect((await su.get('/api/bo/me')).status()).toBe(200);
});

test('un superuser che cambia la propria password resta loggato', async ({ playwright }) => {
  const u = { username: `e2e_selfpw_${uniq()}`.slice(0, 30), password: 'e2e-password-self-1' };
  django(`from django.contrib.auth.models import User
User.objects.create_user(username="${u.username}", password="${u.password}", is_staff=True, is_superuser=True)`);
  const ctx = await loggedIn(playwright, u);
  const self = await (await ctx.get('/api/bo/me')).json();
  const rec = await (await ctx.get(`/api/bo/utenti/${self.id}`)).json();
  const res = await ctx.put(`/api/bo/utenti/${self.id}`, { data: { ...rec, password: 'e2e-password-self-2' } });
  expect(res.status(), await res.text()).toBe(200);
  expect((await ctx.get('/api/bo/me')).status()).toBe(200);
  const other = await newContext(playwright);
  expect((await other.post('/api/bo/login', { data: { ...u, password: 'e2e-password-self-2' } })).status()).toBe(200);
  await other.dispose();
  await ctx.dispose();
});
