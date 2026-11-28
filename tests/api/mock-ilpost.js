// Finta pagina di Joypad sul Post per i test: il monitor la scarica da JOYPAD_PAGE_URL, così il
// binario sotto test non fa scraping del sito vero. L'HTML rispetta quel che legge
// src/joypad_monitor.ml: «main div» > «h3 a» col titolo, e «div[class*=_details_]» con data e
// durata. La data è vecchia di proposito: l'ultima puntata del DB è sempre più recente.
const http = require('http');

const port = Number(process.env.PORT || 3903);

const PAGINA = `<!doctype html>
<html lang="it">
<head><meta charset="utf-8"><title>Joypad (finto)</title></head>
<body>
<main>
  <div>
    <h3><a href="/episodio-finto">Ep. 42 – Titolo finto</a></h3>
    <div class="_episodio_finto_1">
      <div class="_episode-item__details_finto_1">12 Gen 2001 - 42 min</div>
    </div>
  </div>
</main>
</body>
</html>
`;

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/health') {
      res.writeHead(200).end('ok');
      return;
    }
    if (url.pathname !== '/podcasts/joypad/') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(PAGINA);
  })
  .listen(port, '127.0.0.1');
