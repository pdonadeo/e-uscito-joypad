// GET /api/template/videogame: elenco pubblico {id, titolo} per il menu VIDEOGAME del template
// Excel (/bo/template). I giochi di prova si inseriscono in SQL, perché uno deve avere il titolo
// NULL; il teardown li cancella comunque (rawg_slug "e2e-…").
const { test, expect } = require('@playwright/test');
const { sql } = require('./env');
const { newContext, uniq } = require('./helpers');

test.describe.configure({ mode: 'serial' });

const u = uniq();
const titolo = (s) => `E2E Template ${u} ${s}`;
let idC, idBMinuscolo, idA2, idA1, idAMaiuscolo, idNull;

const inserisci = (slug, titolo) =>
  Number(
    sql(
      `INSERT INTO backoffice_videogame (ts_created, ts, titolo, rawg_slug)
VALUES (now(), now(), ${titolo === null ? 'NULL' : ":'titolo'"}, :'slug')
RETURNING id`,
      titolo === null ? { slug } : { slug, titolo },
    ),
  );

test.beforeAll(() => {
  // Inseriti in ordine sparso. Atteso: le tre «a» per id, maiuscola compresa, poi «b», poi «C».
  // Con ORDER BY titolo, id la «A» maiuscola, che ha l'id più basso, finirebbe dopo le «a» in
  // en_US e dopo tutto in collation C, dove anche «b» finirebbe dopo «C».
  idAMaiuscolo = inserisci(`e2e-tpl-${u}-a3`, titolo('A'));
  idC = inserisci(`e2e-tpl-${u}-c`, titolo('C'));
  idBMinuscolo = inserisci(`e2e-tpl-${u}-b`, titolo('b'));
  idA2 = inserisci(`e2e-tpl-${u}-a2`, titolo('a'));
  idA1 = inserisci(`e2e-tpl-${u}-a1`, titolo('a'));
  idNull = inserisci(`e2e-tpl-${u}-null`, null);
});

test.afterAll(() => {
  sql(`DELETE FROM backoffice_videogame WHERE rawg_slug LIKE :'p'`, { p: `e2e-tpl-${u}-%` });
});

let corpo;

test('senza cookie né Origin → 200 JSON con Cache-Control: no-store', async ({ playwright }) => {
  const anonimo = await newContext(playwright, {});
  const res = await anonimo.get('/api/template/videogame');
  expect(res.status()).toBe(200);
  expect(res.headers()['cache-control']).toBe('no-store');
  expect(res.headers()['content-type']).toContain('application/json');
  corpo = await res.json();
  await anonimo.dispose();
  expect(corpo.status).toBe('ok');
  expect(Array.isArray(corpo.result)).toBe(true);
});

test('ogni elemento ha esattamente le chiavi id (intero) e titolo (stringa)', () => {
  expect(corpo.result.length).toBeGreaterThan(0);
  for (const v of corpo.result) {
    expect(Object.keys(v).sort()).toEqual(['id', 'titolo']);
    expect(Number.isInteger(v.id)).toBe(true);
    expect(typeof v.titolo).toBe('string');
  }
});

test('i giochi creati compaiono, quello senza titolo no', () => {
  const ids = corpo.result.map((v) => v.id);
  for (const id of [idC, idBMinuscolo, idA1, idA2, idAMaiuscolo]) expect(ids).toContain(id);
  expect(ids).not.toContain(idNull);
  expect(corpo.result.find((v) => v.id === idBMinuscolo).titolo).toBe(titolo('b'));
});

test('ordine per titolo senza distinguere le maiuscole e, a parità, per id', () => {
  const nostri = [idC, idBMinuscolo, idA1, idA2, idAMaiuscolo];
  const ordine = corpo.result.filter((v) => nostri.includes(v.id)).map((v) => v.id);
  const idA = [idA1, idA2, idAMaiuscolo].sort((x, y) => x - y);
  expect(ordine).toEqual([...idA, idBMinuscolo, idC]);
  // l'elenco intero segue l'ordine del DB
  const atteso = sql(`SELECT id FROM backoffice_videogame WHERE titolo IS NOT NULL ORDER BY lower(titolo), id`)
    .split('\n')
    .map(Number);
  expect(corpo.result.map((v) => v.id)).toEqual(atteso);
});
