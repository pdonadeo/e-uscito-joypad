// Rotte /bo servite da Dream (la SPA react-admin arriva con la Fase 3).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT } = require('./env');

const boBuilt = fs.existsSync(path.join(ROOT, 'frontend', 'build', 'bo', 'index.html'));

test('/bo e /bo/qualcosa servono bo/index.html (404 finché la Fase 3 non la produce)', async ({ request }) => {
  for (const url of ['/bo', '/bo/episodi']) {
    const res = await request.get(url, { maxRedirects: 0 });
    if (boBuilt) {
      expect(res.status(), url).toBe(200);
      expect(res.headers()['content-type']).toContain('text/html');
    } else {
      expect(res.status(), url).toBe(404);
    }
  }
});

test('/bo/ redirige a /bo', async ({ request }) => {
  const res = await request.get('/bo/', { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect(res.headers().location).toBe('/bo');
});

test('/bo/files/** non viene servito come index.html (lo serve nginx)', async ({ request }) => {
  const res = await request.get('/bo/files/covers/qualcosa.png', { maxRedirects: 0 });
  expect(res.status()).toBe(404);
});

test('il sito pubblico non cambia: / e /api/last-episodes', async ({ request }) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(await home.text()).toContain('<html');
  const last = await request.get('/api/last-episodes/5/0');
  expect(last.status()).toBe(200);
  expect((await last.json()).status).toBe('ok');
});
