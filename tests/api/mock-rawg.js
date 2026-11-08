// Finto server RAWG per i test dell'API admin: GET /games/:slug?key=...
// - chiave diversa da RAWG_TEST_KEY → 401 (verifica che la chiave venga passata)
// - slug che inizia con "e2e-missing" → 404
// - slug che inizia con "e2e-broken" → 200 con JSON non valido
const http = require('http');

const port = Number(process.env.PORT || 3902);
const expectedKey = process.env.RAWG_TEST_KEY || 'e2e-rawg-key';
let calls = 0; // richieste a /games/*, lette dai test via GET /calls

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/health') {
      res.writeHead(200).end('ok');
      return;
    }
    if (url.pathname === '/calls') {
      res.writeHead(200).end(String(calls));
      return;
    }
    const m = url.pathname.match(/^\/games\/([^/]+)$/);
    if (!m) {
      res.writeHead(404).end('{}');
      return;
    }
    calls += 1;
    if (url.searchParams.get('key') !== expectedKey) {
      res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"error":"bad key"}');
      return;
    }
    const slug = decodeURIComponent(m[1]);
    if (slug.startsWith('e2e-missing')) {
      res.writeHead(404, { 'Content-Type': 'application/json' }).end('{"detail":"Not found."}');
      return;
    }
    if (slug.startsWith('e2e-broken')) {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{not json');
      return;
    }
    const body = {
      id: 424242,
      slug,
      name: `E2E Game ${slug}`,
      description: `<p>Descrizione di ${slug}</p>`,
      description_raw: `Descrizione di ${slug}`,
      background_image: `https://media.example.com/${slug}.jpg`,
    };
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  })
  .listen(port, '127.0.0.1');
