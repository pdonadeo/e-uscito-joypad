// Crea gli utenti di test in SQL, con hash nel formato di Django calcolati da hashDjango
// (provati contro i vettori generati con Django in vettori-hash.spec.js), e prepara una
// MEDIA_ROOT vuota.
const fs = require('fs');
const { MEDIA_ROOT, USERS, salvaUtente } = require('./env');
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
};
