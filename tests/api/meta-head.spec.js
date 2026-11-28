// Il blocco <head> che Dream inserisce in index.html: sul sito pubblico la risposta del giorno
// e gli og:, sul backoffice «noindex». La risposta NO non si può forzare da qui (dipende
// dall'orologio): la coprono i test OCaml di src/meta/test.
const { test, expect } = require('@playwright/test');
const { sql } = require('./env');
const { uniq } = require('./helpers');

const SITO = 'https://www.euscitojoypad.it';

const ENTITA = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodifica = (testo) =>
  testo.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tutto, e) => {
    if (e[0] !== '#') return ENTITA[e] ?? tutto;
    return String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  });

// <title> e <meta name|property content> della pagina, con le entità decodificate. Un tag
// ripetuto fa fallire il test.
function leggiHead(html) {
  const head = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)[1];
  const titoli = [...head.matchAll(/<title>([\s\S]*?)<\/title>/gi)].map((m) => decodifica(m[1]));
  expect(titoli, 'un solo <title>').toHaveLength(1);
  const meta = {};
  for (const [tag] of head.matchAll(/<meta\s[^>]*>/gi)) {
    const attributi = Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], decodifica(m[2])]));
    const nome = attributi.name || attributi.property;
    if (!nome) continue;
    expect(meta[nome], `meta «${nome}» ripetuto`).toBeUndefined();
    meta[nome] = attributi.content;
  }
  return { title: titoli[0], meta };
}

async function pagina(request, url) {
  const res = await request.get(url, { maxRedirects: 0 });
  expect(res.status(), url).toBe(200);
  const html = await res.text();
  expect(html, 'il marcatore è stato sostituito').not.toContain('<!-- euj:head -->');
  return { res, html, ...leggiHead(html) };
}

async function ultimaPuntata(request) {
  const res = await request.get('/api/ultima-puntata');
  expect(res.status()).toBe(200);
  return res.json();
}

// title, description e og: dicono la stessa cosa del JSON, qualunque sia la risposta di oggi.
function attesoDalJson({ title, meta }, dati) {
  if (dati.uscito) {
    expect(title).toMatch(/^Sì!/);
    expect(title).toContain(`«${dati.titolo}»`);
    expect(meta.description).toMatch(/^Sì!/);
    expect(meta.description).toContain(`«${dati.titolo}»`);
    expect(meta.description).toContain(dati.giorni_fa);
  } else {
    expect(title).toMatch(/^No\./);
    expect(title).toContain(dati.giorni_fa);
    expect(meta.description).toMatch(/^No\./);
    expect(meta.description).toContain(dati.giorni_fa);
    expect(meta.description).toContain(dati.data_italiano);
    if (dati.msg_risposta_no) expect(meta.description).toContain(dati.msg_risposta_no);
  }
  expect(meta['og:title']).toBe(title);
  expect(meta['og:description']).toBe(meta.description);
}

test.describe.serial('meta nel <head>', () => {
  test('la home dice quel che dice /api/ultima-puntata', async ({ request }) => {
    const dati = await ultimaPuntata(request);
    attesoDalJson(await pagina(request, '/'), dati);
  });

  test.describe('con un episodio uscito oggi', () => {
    // Caratteri da proteggere: finiscono negli attributi e in <title>.
    const titolo = `[E2E] meta ${uniq()} <b> & "virgolette"`;
    let id;

    test.beforeAll(() => {
      id = Number(
        sql(
          `INSERT INTO backoffice_episodio (ts_created, ts, titolo, episodio_numero, data_uscita, durata, pubblicato)
VALUES (now(), now(), :'titolo', '999', (now() AT TIME ZONE 'Europe/Rome')::date, interval '1 hour', true)
RETURNING id`,
          { titolo },
        ),
      );
    });

    test.afterAll(() => {
      if (id) sql(`DELETE FROM backoffice_episodio WHERE id = :'id'::int`, { id });
    });

    test('la home risponde SÌ col titolo dell\'episodio', async ({ request }) => {
      const dati = await ultimaPuntata(request);
      expect(dati.uscito).toBe(true);
      expect(dati.titolo).toBe(titolo);
      expect(dati.giorni_fa).toBe('oggi');

      const p = await pagina(request, '/');
      attesoDalJson(p, dati);
      expect(p.title).toMatch(/^Sì!/);
      expect(p.title).toContain(`«${titolo}»`);
      expect(p.html, 'il titolo non entra come HTML').not.toContain('<b> &');
    });
  });

  for (const url of ['/', '/se-ne-parla-qui/1/x', '/joycord/channels']) {
    test(`${url}: indicizzabile, og: assoluti e no-cache`, async ({ request }) => {
      const { res, title, meta } = await pagina(request, `${url}?x=1`);
      expect(res.headers()['cache-control']).toBe('no-cache');
      expect(title).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta['og:title']).toBe(title);
      expect(meta['og:description']).toBe(meta.description);
      expect(meta['og:type']).toBe('website');
      expect(meta['og:locale']).toBe('it_IT');
      expect(meta['og:url']).toBe(`${SITO}${url}`);
      expect(meta['og:image']).toBe(`${SITO}/joypad-img.jpg`);
      expect(meta.robots).toBe('index, follow');
    });
  }

  test('/se-ne-parla-qui ha X-Robots-Tag noindex', async ({ request }) => {
    const { res } = await pagina(request, '/se-ne-parla-qui/1/x');
    expect(res.headers()['x-robots-tag']).toBe('noindex, follow');
  });

  test('/bo/login: titolo del backoffice, noindex, nessun og: e niente framing', async ({ request }) => {
    const { res, title, meta } = await pagina(request, '/bo/login');
    expect(title).toBe('Retrobottega di «È uscito Joypad?»');
    expect(meta.robots).toBe('noindex, nofollow');
    expect(Object.keys(meta).filter((nome) => nome.startsWith('og:'))).toEqual([]);
    expect(res.headers()['x-frame-options']).toBe('DENY');
    expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  });
});
