// Risorse dell'admin: videogame (con RAWG), episodi con associazioni, associazioni, cover.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { USERS, MEDIA_ROOT, django } = require('./env');
const { listQuery, loggedIn, rawgCalls, uniq, PNG_1x1, JPEG } = require('./helpers');

test.describe.configure({ mode: 'serial' });

let api; // contesto con la sessione dell'utente staff
const games = []; // videogame creati via RAWG mock
let episodio; // episodio creato dai test

test.beforeAll(async ({ playwright }) => {
  api = await loggedIn(playwright, USERS.staff);
});

test.afterAll(async () => {
  await api.dispose();
});

test.describe('videogame', () => {
  test('POST {rawg_slug} riempie titolo, descrizioni, cover e rawg_json da RAWG', async ({ request }) => {
    for (let i = 0; i < 3; i++) {
      const slug = `e2e-game-${i}-${uniq()}`;
      const before = await rawgCalls(request);
      const res = await api.post('/api/bo/videogame', { data: { rawg_slug: slug, titolo: 'ignorato' } });
      expect(res.status(), await res.text()).toBe(201);
      const g = await res.json();
      expect(g).toMatchObject({
        rawg_slug: slug,
        titolo: `E2E Game ${slug}`,
        descrizione_html: `<p>Descrizione di ${slug}</p>`,
        descrizione_raw: `Descrizione di ${slug}`,
        cover: `https://media.example.com/${slug}.jpg`,
      });
      expect(g.rawg_json).toMatchObject({ id: 424242, slug, name: `E2E Game ${slug}` });
      expect(await rawgCalls(request)).toBe(before + 1);
      games.push(g);
    }
  });

  test('GET lista con Content-Range, ricerca q e getMany', async () => {
    const res = await api.get(`/api/bo/videogame${listQuery({ range: [0, 9], filter: { q: games[0].rawg_slug } })}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-range']).toBe('videogame 0-0/1');
    const rows = await res.json();
    expect(rows[0]).toMatchObject({ id: games[0].id, titolo: games[0].titolo });
    expect(rows[0].rawg_json).toBeUndefined(); // la lista è leggera

    const many = await api.get(`/api/bo/videogame${listQuery({ filter: { id: games.map((g) => g.id) } })}`);
    expect((await many.json()).map((g) => g.id).sort()).toEqual(games.map((g) => g.id).sort());
  });

  test('PUT con rawg_json presente non richiama RAWG e non accetta rawg_json dal client', async ({ request }) => {
    const g = games[0];
    const before = await rawgCalls(request);
    const res = await api.put(`/api/bo/videogame/${g.id}`, {
      data: { ...g, titolo: 'Titolo corretto a mano', rawg_json: { hacked: true } },
    });
    expect(res.status(), await res.text()).toBe(200);
    const updated = await res.json();
    expect(updated.titolo).toBe('Titolo corretto a mano');
    expect(updated.rawg_json).toEqual(g.rawg_json);
    expect(await rawgCalls(request)).toBe(before);
  });

  test('slug duplicato → 409', async () => {
    const res = await api.post('/api/bo/videogame', { data: { rawg_slug: games[1].rawg_slug } });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toContain('slug');
  });

  test('errori RAWG → 4xx/5xx con messaggio e nessun salvataggio', async () => {
    for (const [slug, status] of [
      [`e2e-missing-${uniq()}`, 400],
      [`e2e-broken-${uniq()}`, 502],
    ]) {
      const res = await api.post('/api/bo/videogame', { data: { rawg_slug: slug } });
      expect(res.status()).toBe(status);
      expect((await res.json()).message).toBeTruthy();
      const list = await api.get(`/api/bo/videogame${listQuery({ filter: { q: slug } })}`);
      expect(await list.json()).toEqual([]);
    }
    const bad = await api.post('/api/bo/videogame', { data: { rawg_slug: 'non valido/../x' } });
    expect(bad.status()).toBe(400);
    const missing = await api.post('/api/bo/videogame', { data: {} });
    expect(missing.status()).toBe(400);
  });
});

test.describe('episodi', () => {
  test('GET /api/bo/episodi?range=[0,19] → 200 con Content-Range episodi 0-19/N', async () => {
    const total = Number(
      django('from backoffice.models import Episodio\nprint(Episodio.objects.count())').split('\n').pop(),
    );
    const res = await api.get(`/api/bo/episodi${listQuery({ range: [0, 19] })}`);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-range']).toBe(`episodi 0-19/${total}`);
    const rows = await res.json();
    expect(rows).toHaveLength(20);
    // ordinamento di default: -data_uscita
    const dates = rows.map((r) => r.data_uscita);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(rows[0].durata).toMatch(/^\d{2,}:\d{2}:\d{2}$/);
  });

  test('sort, range e filter malformati o non consentiti → 400', async () => {
    for (const q of [
      listQuery({ sort: ['password', 'ASC'] }),
      listQuery({ sort: ['titolo', 'SIDEWAYS'] }),
      '?range=[5,1]',
      '?range=[0,1000]', // oltre 1000 righe
      '?range=[0,4611686018427387903]', // overflow di b - a + 1
      '?range=nonjson',
      '?filter=[1,2]',
    ]) {
      const res = await api.get(`/api/bo/episodi${q}`);
      expect(res.status(), q).toBe(400);
      expect((await res.json()).message).toBeTruthy();
    }
  });

  test('POST crea un episodio con associazioni', async () => {
    const res = await api.post('/api/bo/episodi', {
      data: {
        titolo: `[E2E] Episodio ${uniq()}`,
        episodio_numero: 'E2E-1',
        data_uscita: '2001-01-01',
        durata: '1:02:03',
        url: 'https://example.com/audio.mp3',
        pubblicato: false,
        associazioni: [
          { videogame_id: games[0].id, istante: '00:01:00', speaker: 'BORD', tipologia: 'RECE' },
          { videogame_id: games[1].id },
        ],
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    episodio = await res.json();
    expect(episodio).toMatchObject({ durata: '01:02:03', data_uscita: '2001-01-01', pubblicato: false, cover: null });
    expect(episodio.associazioni).toHaveLength(2);
    // speaker/tipologia/istante assenti → default Django (TUTT, FREE, 0:00:00)
    expect(episodio.associazioni.find((a) => a.videogame_id === games[1].id)).toMatchObject({
      videogame_id: games[1].id,
      speaker: 'TUTT',
      tipologia: 'FREE',
      istante: '00:00:00',
    });
  });

  test('ricerca q per titolo e numero, filtro pubblicato', async () => {
    const byTitle = await api.get(`/api/bo/episodi${listQuery({ filter: { q: episodio.titolo.toLowerCase() } })}`);
    expect((await byTitle.json()).map((e) => e.id)).toEqual([episodio.id]);
    const byNum = await api.get(`/api/bo/episodi${listQuery({ filter: { q: 'e2e-1', pubblicato: false } })}`);
    expect((await byNum.json()).map((e) => e.id)).toContain(episodio.id);
    const pub = await api.get(`/api/bo/episodi${listQuery({ filter: { q: 'e2e-1', pubblicato: true } })}`);
    expect((await pub.json()).map((e) => e.id)).not.toContain(episodio.id);
  });

  test('PUT con 3 associazioni, poi GET: le stesse 3 associazioni', async () => {
    const [kept, removed] = episodio.associazioni;
    const wanted = [
      { id: kept.id, videogame_id: games[2].id, istante: '00:10:00', speaker: 'FOSS', tipologia: 'CONS' },
      { videogame_id: games[0].id, istante: '00:20:00', speaker: 'ZAMP', tipologia: 'STAR' },
      { videogame_id: games[1].id, istante: null, speaker: 'TUTT', tipologia: 'FREE' },
    ];
    const res = await api.put(`/api/bo/episodi/${episodio.id}`, {
      data: { ...episodio, titolo: `${episodio.titolo} (mod)`, pubblicato: true, associazioni: wanted },
    });
    expect(res.status(), await res.text()).toBe(200);

    const got = await (await api.get(`/api/bo/episodi/${episodio.id}`)).json();
    expect(got.titolo).toBe(`${episodio.titolo} (mod)`);
    expect(got.pubblicato).toBe(true);
    const norm = (a) => ({ videogame_id: a.videogame_id, istante: a.istante, speaker: a.speaker, tipologia: a.tipologia });
    const key = (a) => `${a.videogame_id}|${a.istante}`;
    expect(got.associazioni.map(norm).sort((a, b) => key(a).localeCompare(key(b)))).toEqual(
      wanted.map((w) => norm(w)).sort((a, b) => key(a).localeCompare(key(b))),
    );
    // la riga con id è stata aggiornata in place, quella omessa cancellata
    expect(got.associazioni.find((a) => a.id === kept.id)).toMatchObject({ videogame_id: games[2].id });
    expect(got.associazioni.find((a) => a.id === removed.id)).toBeUndefined();
    episodio = got;
  });

  test('payload invalido → 400 senza scritture parziali', async () => {
    const invalid = [
      { associazioni: [{ videogame_id: games[0].id, speaker: 'XXXX' }] },
      { associazioni: [{ videogame_id: 999999999 }] },
      { durata: '1:99:00' },
      { durata: '1:0000000000000000000000001:00' },
      {
        associazioni: [
          { id: episodio.associazioni[0].id, videogame_id: games[0].id },
          { id: episodio.associazioni[0].id, videogame_id: games[1].id },
        ],
      },
      { data_uscita: '2001-02-30' },
      { titolo: '' },
      { url: 'javascript:alert(1)' },
    ];
    for (const patch of invalid) {
      const res = await api.put(`/api/bo/episodi/${episodio.id}`, {
        data: { ...episodio, titolo: 'NON DEVE ESSERE SALVATO', ...patch },
      });
      expect(res.status(), JSON.stringify(patch)).toBe(400);
      expect((await res.json()).message).toBeTruthy();
    }
    const got = await (await api.get(`/api/bo/episodi/${episodio.id}`)).json();
    expect(got).toEqual(episodio);
  });

  test('associazioni: getManyReference per videogame_id ed episodio_id', async () => {
    const res = await api.get(
      `/api/bo/associazioni${listQuery({ range: [0, 24], filter: { videogame_id: games[2].id } })}`,
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-range']).toBe('associazioni 0-0/1');
    const [row] = await res.json();
    expect(row).toMatchObject({ episodio_id: episodio.id, videogame_id: games[2].id, istante: '00:10:00' });
    expect(row._istante).toBeUndefined();

    const byEp = await api.get(`/api/bo/associazioni${listQuery({ filter: { episodio_id: episodio.id } })}`);
    const rows = await byEp.json();
    expect(rows).toHaveLength(3);
    // ordinate per istante (null in fondo)
    expect(rows.map((r) => r.istante)).toEqual(['00:10:00', '00:20:00', null]);
  });
});

test.describe('cover', () => {
  const coverPath = () => `/api/bo/episodi/${episodio.id}/cover`;

  test('upload PNG → salvato come covers/episodi-<num>-<slug>.png, leggibile da tutti', async () => {
    const res = await api.post(coverPath(), {
      multipart: { file: { name: 'La Mia Cover!.PNG', mimeType: 'image/png', buffer: PNG_1x1 } },
    });
    expect(res.status(), await res.text()).toBe(200);
    const ep = await res.json();
    expect(ep.cover).toBe('covers/episodi-e2e-1-la-mia-cover.png');
    expect(ep.cover_url).toBe('/bo/files/covers/episodi-e2e-1-la-mia-cover.png');
    const file = path.join(MEDIA_ROOT, ep.cover);
    expect(fs.readFileSync(file).equals(PNG_1x1)).toBe(true);
    expect(fs.statSync(file).mode & 0o777).toBe(0o644);

    // stesso nome: suffisso casuale come Django
    const again = await (
      await api.post(coverPath(), {
        multipart: { file: { name: 'la mia cover.png', mimeType: 'image/png', buffer: PNG_1x1 } },
      })
    ).json();
    expect(again.cover).toMatch(/^covers\/episodi-e2e-1-la-mia-cover_[A-Za-z0-9]{7}\.png$/);
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
    const res = await api.post('/api/bo/episodi/999999999/cover', {
      multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: PNG_1x1 } },
    });
    expect(res.status()).toBe(404);
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

  test('DELETE cover azzera il campo', async () => {
    const res = await api.delete(coverPath());
    expect(res.status()).toBe(200);
    expect((await res.json()).cover).toBeNull();
  });
});

test.describe('cancellazioni', () => {
  test('DELETE episodio cancella anche le associazioni', async () => {
    const res = await api.delete(`/api/bo/episodi/${episodio.id}`);
    expect(res.status()).toBe(200);
    expect((await api.get(`/api/bo/episodi/${episodio.id}`)).status()).toBe(404);
    const assoc = await api.get(`/api/bo/associazioni${listQuery({ filter: { episodio_id: episodio.id } })}`);
    expect(await assoc.json()).toEqual([]);
  });

  test('DELETE videogame cancella anche le sue associazioni', async () => {
    const ep = await (
      await api.post('/api/bo/episodi', {
        data: {
          titolo: `[E2E] Per cancellazione ${uniq()}`,
          data_uscita: '2001-01-02',
          durata: '00:30:00',
          associazioni: [{ videogame_id: games[0].id }],
        },
      })
    ).json();
    const res = await api.delete(`/api/bo/videogame/${games[0].id}`);
    expect(res.status()).toBe(200);
    expect((await api.get(`/api/bo/videogame/${games[0].id}`)).status()).toBe(404);
    const got = await (await api.get(`/api/bo/episodi/${ep.id}`)).json();
    expect(got.associazioni).toEqual([]);
  });

  test('id inesistente o non numerico → 404', async () => {
    expect((await api.get('/api/bo/episodi/999999999')).status()).toBe(404);
    expect((await api.get('/api/bo/episodi/abc')).status()).toBe(404);
    expect((await api.put('/api/bo/videogame/999999999', { data: { rawg_slug: 'e2e-x' } })).status()).toBe(404);
  });
});
