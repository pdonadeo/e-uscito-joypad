// Crea gli utenti di test in SQL, con hash nel formato di Django calcolati da hashDjango
// (provati contro i vettori generati con Django in vettori-hash.spec.js), e prepara una
// MEDIA_ROOT vuota.
const fs = require('fs');
const { MEDIA_ROOT, USERS, salvaUtente, sql } = require('./env');
const cleanup = require('./global-teardown');

module.exports = async () => {
  await cleanup();
  fs.rmSync(MEDIA_ROOT, { recursive: true, force: true });
  fs.mkdirSync(MEDIA_ROOT, { recursive: true });
  for (const [u, is_active, is_staff, is_superuser] of [
    [USERS.staff, true, true, false],
    [USERS.superuser, true, true, true],
    [USERS.inactive, false, true, false],
    [USERS.nonstaff, true, false, false],
  ]) {
    salvaUtente({ ...u, is_active, is_staff, is_superuser });
  }
  // Videogame di prova dell'import Excel, con id fissi: le fixture committate in
  // fixture/import-excel/ contengono «990001-E2E Fixture 1» nella colonna VIDEOGAME (le genera
  // new-bo/scripts/genera-fixture-excel.ts, con gli stessi id e titoli). Il teardown li
  // cancella con gli altri (slug «e2e-…»).
  // ATTENZIONE: un INSERT con id esplicito non fa avanzare la sequenza degli id. Se i videogame
  // veri arrivassero a 990001 (oggi sono circa 900) questo INSERT fallirebbe: andrebbero scelti
  // id più alti, rigenerando le fixture.
  sql(`INSERT INTO backoffice_videogame (id, ts_created, ts, titolo, rawg_slug)
VALUES (990001, now(), now(), 'E2E Fixture 1', 'e2e-fixture-1'),
       (990002, now(), now(), 'E2E Fixture 2', 'e2e-fixture-2'),
       (990003, now(), now(), 'E2E Fixture 3', 'e2e-fixture-3')`);
};
