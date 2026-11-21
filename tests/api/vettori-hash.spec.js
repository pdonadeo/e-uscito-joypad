// Vettori di prova degli hash delle password, generati con Django 6.1.3 (Fase 2 di via-django):
// il codice Python che li ha prodotti è nel messaggio del commit che ha aggiunto vettori-hash.json.
// Provano che hashDjango (usato dai test per creare gli utenti in SQL) e il login di Dream
// calcolano gli stessi hash di Django, anche dopo che Django sarà sparito.
const { test, expect } = require('@playwright/test');
const { sql, hashDjango, verificaHashDjango, salvaUtente } = require('./env');
const { gql, expectOk, gqlLoggedIn } = require('./gql-helpers');
const { generato_con, vettori } = require('./vettori-hash.json');

const DEFAULT = 1_500_000;

test('il file copre i casi richiesti', () => {
  expect(generato_con).toMatch(/^Django 6\.1\.3, /);
  expect(vettori.length).toBeGreaterThanOrEqual(6);
  for (const v of vettori) {
    expect(Object.keys(v).sort()).toEqual(['hash', 'iterazioni', 'nota', 'password', 'salt']);
    expect(v.salt).toMatch(/^[A-Za-z0-9]{22}$/);
    expect(v.hash.startsWith(`pbkdf2_sha256$${v.iterazioni}$${v.salt}$`)).toBe(true);
  }
  const iterazioni = new Set(vettori.map((v) => v.iterazioni));
  expect(iterazioni.has(DEFAULT)).toBe(true);
  expect([...iterazioni].filter((n) => n < DEFAULT).length).toBeGreaterThanOrEqual(2);
  expect(vettori.some((v) => /^[\x20-\x7e]+$/.test(v.password))).toBe(true); // ASCII
  expect(vettori.some((v) => /[^\x00-\x7f]/.test(v.password))).toBe(true); // UTF-8
  expect(vettori.some((v) => Buffer.byteLength(v.password) > 64)).toBe(true); // ramo HMAC con chiave lunga
  expect(vettori.some((v) => v.password === 'CHANGE_ME_IN_PRODUCTION')).toBe(true); // admin del seed
});

vettori.forEach((v, i) => {
  test(`vettore ${i + 1} (${v.iterazioni} iterazioni, ${v.nota}): stesso hash in Node, login in Dream`, async ({
    playwright,
  }) => {
    expect(hashDjango(v.password, { salt: v.salt, iterazioni: v.iterazioni })).toBe(v.hash);
    expect(verificaHashDjango(v.password, v.hash)).toBe(true);
    expect(verificaHashDjango(`${v.password}x`, v.hash)).toBe(false);

    const u = { username: `e2e_vettore_${i + 1}`, password: v.password };
    salvaUtente({ ...u, hash: v.hash });
    const ctx = await gqlLoggedIn(playwright, u);
    expect(expectOk(await gql(ctx, '{ me { username } }')).me.username).toBe(u.username);
    await ctx.dispose();

    // dopo il login: sotto 1.500.000 Dream ricalcola l'hash (come must_update di Django);
    // in ogni caso l'hash salvato vale per la stessa password
    const dopo = sql(`SELECT password FROM auth_user WHERE username = :'u'`, { u: u.username });
    if (v.iterazioni < DEFAULT) {
      expect(dopo).not.toBe(v.hash);
      expect(Number(dopo.split('$')[1])).toBeGreaterThanOrEqual(DEFAULT);
    }
    expect(verificaHashDjango(v.password, dopo)).toBe(true);
  });
});
