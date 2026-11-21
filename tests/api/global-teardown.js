// Rimuove i dati creati dai test: episodi "[E2E]…", videogame "e2e-…", utenti "e2e_…".
// Le righe che puntano agli utenti (django_admin_log, gruppi e permessi) vanno tolte prima,
// come faceva il delete di Django.
const { sql } = require('./env');

module.exports = async () => {
  sql(`BEGIN;
DELETE FROM backoffice_associazioneepisodiovideogame
WHERE episodio_id IN (SELECT id FROM backoffice_episodio WHERE titolo LIKE '[E2E]%')
   OR videogame_id IN (SELECT id FROM backoffice_videogame WHERE rawg_slug LIKE 'e2e-%');
DELETE FROM backoffice_episodio WHERE titolo LIKE '[E2E]%';
DELETE FROM backoffice_videogame WHERE rawg_slug LIKE 'e2e-%';
DELETE FROM django_admin_log WHERE user_id IN (SELECT id FROM auth_user WHERE username LIKE 'e2e\\_%');
DELETE FROM auth_user_groups WHERE user_id IN (SELECT id FROM auth_user WHERE username LIKE 'e2e\\_%');
DELETE FROM auth_user_user_permissions WHERE user_id IN (SELECT id FROM auth_user WHERE username LIKE 'e2e\\_%');
DELETE FROM auth_user WHERE username LIKE 'e2e\\_%';
COMMIT;`);
};
