// Autenticazione, sessioni e controllo Origin/Referer di /api/bo.
const { test, expect } = require('@playwright/test');
const { spawn, spawnSync } = require('child_process');
const { API_URL, USERS, BINARY, dreamEnv, django } = require('./env');
const { newContext, loggedIn } = require('./helpers');

test.describe('autenticazione', () => {
  test('senza sessione /api/bo/episodi risponde 401 con un JSON', async ({ request }) => {
    const res = await request.get('/api/bo/episodi');
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBeTruthy();
  });

  test('login di un utente creato da Django → 200, poi me e logout', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const t0 = Date.now();
    const res = await ctx.post('/api/bo/login', { data: USERS.staff });
    const elapsed = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(res.headers()['set-cookie']).toContain('dream.session=');
    // hash Django a 1.500.000 iterazioni: obiettivo < 1 s (margine per la CI)
    expect(elapsed).toBeLessThan(1500);
    const login = await res.json();
    expect(login).toMatchObject({ username: USERS.staff.username, is_superuser: false });

    const me = await ctx.get('/api/bo/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({ id: login.id, username: USERS.staff.username });

    // last_login aggiornato
    const lastLogin = django(
      `from django.contrib.auth.models import User\nprint(User.objects.get(username="${USERS.staff.username}").last_login is not None)`,
    );
    expect(lastLogin.split('\n').pop()).toBe('True');

    expect((await ctx.post('/api/bo/logout')).status()).toBe(200);
    expect((await ctx.get('/api/bo/me')).status()).toBe(401);
    await ctx.dispose();
  });

  for (const [name, data] of [
    ['password errata', { username: USERS.staff.username, password: 'sbagliata' }],
    ['utente inesistente', { username: 'e2e_nessuno', password: 'qualcosa' }],
    ['utente non attivo', USERS.inactive],
    ['utente non staff', USERS.nonstaff],
  ]) {
    test(`login rifiutato: ${name} → 401`, async ({ request }) => {
      const res = await request.post('/api/bo/login', { data });
      expect(res.status()).toBe(401);
      expect((await request.get('/api/bo/me')).status()).toBe(401);
    });
  }

  test('il cambio password invalida le sessioni aperte', async ({ playwright }) => {
    const victim = { username: 'e2e_pwchange', password: 'e2e-password-old' };
    django(`from django.contrib.auth.models import User
u, _ = User.objects.get_or_create(username="${victim.username}")
u.set_password("${victim.password}"); u.is_staff = True; u.is_active = True; u.save()`);
    const ctx = await loggedIn(playwright, victim);
    expect((await ctx.get('/api/bo/me')).status()).toBe(200);
    django(`from django.contrib.auth.models import User
u = User.objects.get(username="${victim.username}"); u.set_password("e2e-password-new"); u.save()`);
    expect((await ctx.get('/api/bo/me')).status()).toBe(401);
    await ctx.dispose();
  });

  test('un utente disattivato perde subito l\'accesso', async ({ playwright }) => {
    const u = { username: 'e2e_deactivated', password: 'e2e-password-deact' };
    django(`from django.contrib.auth.models import User
x, _ = User.objects.get_or_create(username="${u.username}")
x.set_password("${u.password}"); x.is_staff = True; x.is_active = True; x.save()`);
    const ctx = await loggedIn(playwright, u);
    django(`from django.contrib.auth.models import User
User.objects.filter(username="${u.username}").update(is_active=False)`);
    expect((await ctx.get('/api/bo/episodi')).status()).toBe(401);
    await ctx.dispose();
  });
});

test.describe('controllo Origin/Referer (DEBUG=True)', () => {
  test('Origin https://evil.example → 403 anche con sessione valida', async ({ playwright }) => {
    const ctx = await loggedIn(playwright, USERS.staff);
    const get = await ctx.get('/api/bo/episodi', { headers: { Origin: 'https://evil.example' } });
    expect(get.status()).toBe(403);
    const put = await ctx.post('/api/bo/videogame', {
      headers: { Origin: 'https://evil.example' },
      data: { rawg_slug: 'e2e-evil' },
    });
    expect(put.status()).toBe(403);
    await ctx.dispose();
  });

  test('login con Origin estranea → 403', async ({ request }) => {
    const res = await request.post('/api/bo/login', { data: USERS.staff, headers: { Origin: 'https://evil.example' } });
    expect(res.status()).toBe(403);
  });

  test('Referer di un altro host senza Origin → 403', async ({ playwright }) => {
    const ctx = await newContext(playwright, { Referer: 'https://evil.example/pagina' });
    const res = await ctx.get('/api/bo/episodi');
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test('POST senza Origin né Referer → 403', async ({ playwright }) => {
    const ctx = await newContext(playwright, {});
    const res = await ctx.post('/api/bo/login', { data: USERS.staff });
    expect(res.status()).toBe(403);
    await ctx.dispose();
  });

  test('le risposte /api/bo non hanno header CORS', async ({ request }) => {
    const res = await request.get('/api/bo/me');
    expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    expect(res.headers()['access-control-allow-credentials']).toBeUndefined();
    // il resto del sito in DEBUG mantiene il CORS di sviluppo
    const pub = await request.get('/api/ultima-puntata', { headers: { Origin: 'http://localhost:3000' } });
    expect(pub.headers()['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('stesso host con porta diversa (Host senza porta dietro nginx) → consentito', async ({ playwright }) => {
    const ctx = await newContext(playwright, { Origin: 'http://127.0.0.1:5000' });
    const res = await ctx.post('/api/bo/login', { data: USERS.staff });
    expect(res.status()).toBe(200);
    await ctx.dispose();
  });
});

test.describe('DEBUG=False', () => {
  test('senza DREAM_SECRET, o con il placeholder di sviluppo, il server non parte', () => {
    for (const secret of [undefined, 'DREAM SECRET CHANGE ME IN PRODUCTION']) {
      const env = { ...process.env, ...dreamEnv({ DEBUG: 'False', REST_LISTEN_PORT: '3999' }) };
      if (secret === undefined) delete env.DREAM_SECRET;
      else env.DREAM_SECRET = secret;
      const r = spawnSync(BINARY, [], { env, timeout: 10000, encoding: 'utf8' });
      expect(r.status, String(secret)).toBe(1);
      expect(r.stderr).toContain('DREAM_SECRET');
    }
  });

  test('il cookie di sessione ha l\'attributo Secure', async ({ playwright }) => {
    const port = 3998;
    const url = `http://127.0.0.1:${port}`;
    const server = spawn(BINARY, [], {
      env: { ...process.env, ...dreamEnv({ DEBUG: 'False', REST_LISTEN_PORT: String(port) }) },
      stdio: 'ignore',
    });
    try {
      const ctx = await playwright.request.newContext({ baseURL: url, extraHTTPHeaders: { Origin: url } });
      let ready = false;
      for (let i = 0; i < 50 && !ready; i++) {
        try {
          ready = (await ctx.get('/api/bo/me')).status() === 401;
        } catch {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      expect(ready).toBe(true);
      const res = await ctx.post('/api/bo/login', { data: USERS.staff });
      expect(res.status()).toBe(200);
      const cookie = res.headers()['set-cookie'];
      expect(cookie).toContain('dream.session=');
      expect(cookie).toMatch(/;\s*Secure/i);
      expect(cookie).toMatch(/HttpOnly/i);
      await ctx.dispose();
    } finally {
      server.kill();
    }
  });
});

test('raffica di login: oltre 2 in corso + 8 in coda si risponde 429, poi si torna normali', async ({ playwright }) => {
  const ctx = await newContext(playwright);
  // fetch di Node apre una connessione per richiesta: 16 login davvero concorrenti
  const burst = Promise.all(
    Array.from({ length: 16 }, () =>
      fetch(`${API_URL}/api/bo/login`, {
        method: 'POST',
        headers: { Origin: API_URL, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'e2e_nessuno', password: 'x' }),
      }).then((r) => r.status),
    ),
  );
  // intanto il sito pubblico deve restare reattivo (l'hashing gira in altri Domain)
  await new Promise((r) => setTimeout(r, 300));
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    expect((await fetch(`${API_URL}/api/ultima-puntata`)).status).toBe(200);
    expect(Date.now() - t0).toBeLessThan(500);
  }
  const statuses = await burst;
  expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(6);
  expect(statuses.every((s) => s === 401 || s === 429)).toBe(true);
  expect((await ctx.post('/api/bo/login', { data: USERS.staff })).status()).toBe(200);
  await ctx.dispose();
});

test('login di un hash Django con meno iterazioni: ricalcolato come fa Django', async ({ playwright }) => {
  const u = { username: 'e2e_oldhash', password: 'e2e-password-old-hash' };
  django(`from django.contrib.auth.models import User
from django.contrib.auth.hashers import PBKDF2PasswordHasher
h = PBKDF2PasswordHasher()
x, _ = User.objects.get_or_create(username="${u.username}")
x.password = h.encode("${u.password}", h.salt(), iterations=320000)
x.is_staff = True; x.is_active = True; x.save()`);
  const ctx = await loggedIn(playwright, u);
  expect((await ctx.get('/api/bo/me')).status()).toBe(200);
  const out = django(`from django.contrib.auth import authenticate
from django.contrib.auth.models import User
x = User.objects.get(username="${u.username}")
print(x.password.split("$")[1], authenticate(username="${u.username}", password="${u.password}") is not None)`);
  const [iterations, ok] = out.split('\n').pop().split(' ');
  expect(Number(iterations)).toBeGreaterThanOrEqual(1500000);
  expect(ok).toBe('True');
  await ctx.dispose();
});
