// Cover degli episodi: POST/DELETE /api/bo/episodi/:id/cover, l'unica rotta rimasta in /api/bo
// dopo la rimozione della REST di react-admin (Fase 1 di via-django). I dati si preparano con
// GraphQL; lo scope /api/bo tiene sessione, controllo Origin/Referer e cookie Secure.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { USERS, MEDIA_ROOT } = require('./env');
const { newContext, loggedIn, uniq, PNG_1x1, JPEG } = require('./helpers');
const { creaVideogame, creaEpisodio, leggiEpisodio } = require('./gql-helpers');

test.describe.configure({ mode: 'serial' });

let api; // contesto con la sessione dell'utente staff
let episodio;

const coverPath = () => `/api/bo/episodi/${episodio.id}/cover`;
const png = (name = 'x.png') => ({ multipart: { file: { name, mimeType: 'image/png', buffer: PNG_1x1 } } });

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
  const gioco = await creaVideogame(api, { rawg_slug: `e2e-cover-${uniq()}` });
  episodio = await creaEpisodio(api, {
    titolo: `[E2E] Cover ${uniq()}`,
    episodio_numero: 'E2E-CV1',
    data_uscita: '2001-01-01',
    durata: '1:02:03',
    associazioni: [{ videogame_id: gioco.id, istante: '00:01:00' }],
  });
});

test.afterAll(async () => {
  await api.dispose();
});

test.describe('upload e rimozione', () => {
  test('upload PNG → salvato come covers/episodi-<num>-<slug>.png, leggibile da tutti', async () => {
    const res = await api.post(coverPath(), png('La Mia Cover!.PNG'));
    expect(res.status(), await res.text()).toBe(200);
    const ep = await res.json();
    expect(ep.cover).toBe('covers/episodi-e2e-cv1-la-mia-cover.png');
    expect(ep.cover_url).toBe('/bo/files/covers/episodi-e2e-cv1-la-mia-cover.png');
    const file = path.join(MEDIA_ROOT, ep.cover);
    expect(fs.readFileSync(file).equals(PNG_1x1)).toBe(true);
    expect(fs.statSync(file).mode & 0o777).toBe(0o644);
    // GraphQL legge la stessa cover
    expect(await leggiEpisodio(api, episodio.id)).toMatchObject({ cover: ep.cover, cover_url: ep.cover_url });

    // stesso nome: suffisso casuale come Django
    const again = await (await api.post(coverPath(), png('la mia cover.png'))).json();
    expect(again.cover).toMatch(/^covers\/episodi-e2e-cv1-la-mia-cover_[A-Za-z0-9]{7}\.png$/);
    expect(fs.existsSync(path.join(MEDIA_ROOT, again.cover))).toBe(true);
  });

  test('upload di un JPEG → 400', async () => {
    for (const [name, buffer] of [
      ['foto.jpg', JPEG],
      ['foto-travestita.png', JPEG],
      ['png-con-estensione-sbagliata.jpg', PNG_1x1],
    ]) {
      const res = await api.post(coverPath(), { multipart: { file: { name, mimeType: 'image/png', buffer } } });
      expect(res.status(), name).toBe(400);
      expect((await res.json()).message).toContain('PNG');
    }
  });

  test('upload senza multipart o senza file → 400; episodio inesistente → 404', async () => {
    expect((await api.post(coverPath(), { data: { file: 'x' } })).status()).toBe(400);
    expect((await api.post(coverPath(), { multipart: { altro: 'x' } })).status()).toBe(400);
    expect((await api.post('/api/bo/episodi/999999999/cover', png())).status()).toBe(404);
  });

  test('file oltre 10 MB → 413 senza scrivere nulla', async () => {
    const before = fs.readdirSync(path.join(MEDIA_ROOT, 'covers')).length;
    const big = Buffer.concat([PNG_1x1, Buffer.alloc(11 * 1024 * 1024)]);
    const res = await api.post(coverPath(), {
      multipart: { file: { name: 'enorme.png', mimeType: 'image/png', buffer: big } },
    });
    expect(res.status()).toBe(413);
    expect(fs.readdirSync(path.join(MEDIA_ROOT, 'covers')).length).toBe(before);
  });

  test('DELETE cover azzera il campo, anche per GraphQL', async () => {
    const res = await api.delete(coverPath());
    expect(res.status()).toBe(200);
    expect((await res.json()).cover).toBeNull();
    expect(await leggiEpisodio(api, episodio.id)).toMatchObject({ cover: null, cover_url: null });
  });
});

test.describe('sessione e controllo Origin/Referer (DEBUG=True)', () => {
  test('senza sessione → 401 con un JSON', async ({ playwright }) => {
    const ctx = await newContext(playwright);
    const res = await ctx.post(coverPath(), png());
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBeTruthy();
    expect((await ctx.delete(coverPath())).status()).toBe(401);
    await ctx.dispose();
  });

  test('Origin https://evil.example → 403 anche con sessione valida', async () => {
    const res = await api.post(coverPath(), { ...png(), headers: { Origin: 'https://evil.example' } });
    expect(res.status()).toBe(403);
    const del = await api.delete(coverPath(), { headers: { Origin: 'https://evil.example' } });
    expect(del.status()).toBe(403);
  });

  test('Referer di un altro host senza Origin → 403', async ({ playwright }) => {
    const ctx = await newContext(playwright, { Referer: 'https://evil.example/pagina' });
    expect((await ctx.post(coverPath(), png())).status()).toBe(403);
    await ctx.dispose();
  });

  test('POST senza Origin né Referer → 403', async ({ playwright }) => {
    const ctx = await newContext(playwright, {});
    expect((await ctx.post(coverPath(), png())).status()).toBe(403);
    await ctx.dispose();
  });

  test('le risposte di /api/bo non hanno header CORS; il resto del sito sì (DEBUG)', async ({ request }) => {
    const res = await request.post(coverPath(), png());
    expect(res.status()).toBe(401);
    expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    expect(res.headers()['access-control-allow-credentials']).toBeUndefined();
    const pub = await request.get('/api/ultima-puntata', { headers: { Origin: 'http://localhost:3000' } });
    expect(pub.headers()['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
