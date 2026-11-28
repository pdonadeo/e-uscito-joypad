// Le rotte servite da Dream dopo il passaggio al frontend unico: pagine pubbliche e del bo,
// file statici, sitemap, e i vecchi percorsi che non devono più rispondere.
const { test, expect } = require('@playwright/test');

const PAGINE = ['/', '/se-ne-parla-qui/1/x', '/joycord/channels', '/bo', '/bo/login', '/bo/episodi/1'];

const STATICI = [
  ['/favicon-16x16.png', /^image\/png/],
  ['/favicon-32x32.png', /^image\/png/],
  ['/favicon.ico', /^image\/(x-icon|vnd\.microsoft\.icon)/],
  ['/static/apple-touch-icon.png', /^image\/png/],
  ['/static/joypad-img.jpg', /^image\/jpeg/],
  ['/joypad-img.jpg', /^image\/jpeg/],
  ['/site.webmanifest', /^application\/(manifest\+json|json)/],
  ['/favicon-bo.svg', /^image\/svg\+xml/],
];

// Il testo di src/sitemap.ml, uguale a quello di main.
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://www.euscitojoypad.it/</loc>
    <changefreq>daily</changefreq>
  </url>
</urlset>
`;

for (const url of PAGINE) {
  test(`${url} risponde 200 in HTML`, async ({ request }) => {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/html');
  });
}

for (const [url, tipo] of STATICI) {
  test(`${url} risponde 200 col suo content-type`, async ({ request }) => {
    const res = await request.get(url, { maxRedirects: 0 });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(tipo);
    expect((await res.body()).length).toBeGreaterThan(0);
  });
}

test('/bo/ redirige a /bo', async ({ request }) => {
  const res = await request.get('/bo/', { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect(res.headers().location).toBe('/bo');
});

test('/sitemap.xml ha lo stesso contenuto di prima', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('application/xml');
  expect(await res.text()).toBe(SITEMAP);
});

// Chi ha ancora aperta la versione precedente chiede i chunk sotto /bo/assets: deve ricevere
// un errore, non index.html.
// In debug Dream trasforma ogni 4xx in una pagina HTML d'errore: il content-type non dice
// niente, si controlla che il corpo non sia index.html.
async function nonTrovato(request, url) {
  const res = await request.get(url, { maxRedirects: 0 });
  expect(res.status()).toBe(404);
  const corpo = await res.text();
  for (const segno of ['id="root"', 'euj:head', '<script type="module"']) expect(corpo).not.toContain(segno);
}

test('/bo/assets/** risponde 404 e non index.html', async ({ request }) => {
  await nonTrovato(request, '/bo/assets/qualcosa.js');
});

test('/e-uscito-joypad.css non esiste più', async ({ request }) => {
  await nonTrovato(request, '/e-uscito-joypad.css');
});
