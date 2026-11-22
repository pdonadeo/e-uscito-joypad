// Rimuove i dati creati dai test: episodi "[E2E]…", videogame "e2e-…", utenti "e2e_…".
const { sql } = require('./env');

module.exports = async () => {
  sql(`BEGIN;
DELETE FROM backoffice_associazioneepisodiovideogame
WHERE episodio_id IN (SELECT id FROM backoffice_episodio WHERE titolo LIKE '[E2E]%')
   OR videogame_id IN (SELECT id FROM backoffice_videogame WHERE rawg_slug LIKE 'e2e-%');
DELETE FROM backoffice_episodio WHERE titolo LIKE '[E2E]%';
DELETE FROM backoffice_videogame WHERE rawg_slug LIKE 'e2e-%';
DELETE FROM auth_user WHERE username LIKE 'e2e\\_%';
COMMIT;`);
};
