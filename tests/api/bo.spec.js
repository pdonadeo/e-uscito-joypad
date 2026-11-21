// /bo è il backoffice (new-bo, Fase 1 di via-django): Dream serve new-bo/dist su /bo.
// /new-bo non esiste più; di /api/bo resta solo la cover.
const { test, expect } = require('@playwright/test');

test('/bo e /bo/episodi servono index.html di new-bo, senza framing', async ({ request }) => {
  for (const url of ['/bo', '/bo/episodi']) {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(200);
    expect(res.headers()['content-type'], url).toContain('text/html');
    expect(res.headers()['cache-control'], url).toBe('no-cache');
    expect(res.headers()['x-frame-options'], url).toBe('DENY');
    expect(res.headers()['content-security-policy'], url).toContain("frame-ancestors 'none'");
    // gli asset hanno il prefisso /bo/ (base di Vite)
    const html = await res.text();
    expect(html, url).toMatch(/src="\/bo\/assets\/[^"]+\.js"/);
  }
});

test('gli asset di new-bo stanno sotto /bo/assets', async ({ request }) => {
  const html = await (await request.get('/bo')).text();
  const js = html.match(/src="(\/bo\/assets\/[^"]+\.js)"/)[1];
  const res = await request.get(js);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('javascript');
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

test('/new-bo non esiste più', async ({ request }) => {
  for (const url of ['/new-bo', '/new-bo/episodi', '/new-bo/assets/index.js']) {
    expect((await request.get(url, { maxRedirects: 0 })).status(), url).toBe(404);
  }
});

test('la REST di react-admin non esiste più: 404 JSON', async ({ request }) => {
  for (const [method, url] of [
    ['post', '/api/bo/login'],
    ['post', '/api/bo/logout'],
    ['get', '/api/bo/me'],
    ['get', '/api/bo/episodi'],
    ['get', '/api/bo/episodi/1'],
    ['get', '/api/bo/videogame'],
    ['get', '/api/bo/associazioni'],
    ['get', '/api/bo/utenti'],
  ]) {
    const res = await request[method](url, { maxRedirects: 0 });
    expect(res.status(), url).toBe(404);
    expect(res.headers()['content-type'], url).toContain('application/json');
    expect((await res.json()).message, url).toBe('Endpoint inesistente');
  }
});

test('il sito pubblico non cambia: / e /api/last-episodes', async ({ request }) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(await home.text()).toContain('<html');
  const last = await request.get('/api/last-episodes/5/0');
  expect(last.status()).toBe(200);
  expect((await last.json()).status).toBe('ok');
});
