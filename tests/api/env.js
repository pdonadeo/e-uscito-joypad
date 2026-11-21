// Parametri condivisi tra la config Playwright dell'API admin e i test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const API_PORT = Number(process.env.ADMIN_API_PORT || 3901);
const RAWG_PORT = Number(process.env.ADMIN_RAWG_PORT || 3902);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const MEDIA_ROOT = path.join(os.tmpdir(), 'euj-admin-api-test-media');
const RAWG_KEY = 'e2e-rawg-key';
const PG_CONTAINER = process.env.PG_CONTAINER || 'euj-postgresql';
const BINARY = path.join(ROOT, '_build', 'default', 'src', 'e_uscito_joypad.exe');

// Credenziali PostgreSQL di sviluppo da compose_env (il DB del compose espone la 5432).
function composeEnv() {
  const env = {};
  for (const line of fs.readFileSync(path.join(ROOT, 'compose_env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

// Variabili d'ambiente del server Dream sotto test.
function dreamEnv(extra = {}) {
  const c = composeEnv();
  return {
    PGHOST: process.env.PGHOST || 'localhost',
    PGPORT: process.env.PGPORT || '5432',
    PGUSER: c.PGUSER,
    PGPASSWORD: c.PGPASSWORD,
    PGDATABASE: c.PGDATABASE,
    REST_LISTEN_ADDRESS: '127.0.0.1',
    REST_LISTEN_PORT: String(API_PORT),
    DEBUG: 'True',
    DREAM_SECRET: 'e2e-dream-secret',
    MEDIA_ROOT,
    MEDIA_URL: 'bo/files/',
    RAWG_API_URL: `http://127.0.0.1:${RAWG_PORT}`,
    RAWG_API_KEY: RAWG_KEY,
    GC_PERIOD_SEC: '3600',
    ...extra,
  };
}

// Esegue `query` con psql dentro il container PostgreSQL e restituisce l'output (senza
// intestazioni, campi separati da `|`). I valori passano solo come variabili di psql: nella
// query si scrivono :'nome' (letterale quotato) e, se serve un tipo, :'nome'::int. La query va
// su stdin perché con -c psql non interpola le variabili. Dentro il container l'accesso locale
// è trust: niente password. `container` e `db` servono al Postgres usa e getta dei test delle
// migrazioni.
const NOME_VARIABILE = /^[a-z_][a-z0-9_]*$/;
const MAX_VALORE = 100 * 1024; // un argomento di execve non supera 128 KB

function sql(query, variabili = {}, { container = PG_CONTAINER, db } = {}) {
  const c = composeEnv();
  const args = ['exec', '-i', container, 'psql', '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'];
  args.push('-U', c.PGUSER, '-d', db || c.PGDATABASE);
  for (const [nome, valore] of Object.entries(variabili)) {
    if (!NOME_VARIABILE.test(nome)) throw new Error(`sql(): nome di variabile non valido: ${nome}`);
    if (valore === null || valore === undefined) throw new Error(`sql(): valore assente per ${nome} (NULL va scritto nella query)`);
    const testo = String(valore);
    if (Buffer.byteLength(testo) > MAX_VALORE) throw new Error(`sql(): valore di ${nome} oltre 100 KB`);
    args.push('-v', `${nome}=${testo}`);
  }
  return execFileSync('docker', args, { input: query, encoding: 'utf8' }).trim();
}

// Hash delle password nel formato di Django: pbkdf2_sha256$<iterazioni>$<salt>$<base64>.
// Il salt di default è come quello di Django: 22 caratteri alfanumerici.
const ALFABETO_SALT = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function hashDjango(password, { salt, iterazioni = 1_500_000 } = {}) {
  const s = salt || Array.from({ length: 22 }, () => ALFABETO_SALT[crypto.randomInt(ALFABETO_SALT.length)]).join('');
  const dk = crypto.pbkdf2Sync(password, s, iterazioni, 32, 'sha256').toString('base64');
  return `pbkdf2_sha256$${iterazioni}$${s}$${dk}`;
}

// true se `hash` (formato Django, pbkdf2_sha256) corrisponde a `password`.
function verificaHashDjango(password, hash) {
  const parti = hash.split('$');
  if (parti.length !== 4 || parti[0] !== 'pbkdf2_sha256') return false;
  const iterazioni = Number(parti[1]);
  if (!Number.isInteger(iterazioni) || iterazioni <= 0) return false;
  const atteso = Buffer.from(hashDjango(password, { salt: parti[2], iterazioni }));
  const dato = Buffer.from(hash);
  return atteso.length === dato.length && crypto.timingSafeEqual(atteso, dato);
}

// Crea l'utente o, se lo username esiste, ne aggiorna password e flag. Con `hash` la password
// non si ricalcola. Restituisce l'id.
function salvaUtente({ username, password, hash, is_staff = true, is_active = true, is_superuser = false }) {
  const id = sql(
    `INSERT INTO auth_user (username, password, is_staff, is_active, is_superuser, first_name, last_name, email, date_joined)
VALUES (:'username', :'hash', :'is_staff'::boolean, :'is_active'::boolean, :'is_superuser'::boolean, '', '', '', now())
ON CONFLICT (username) DO UPDATE
SET password = EXCLUDED.password, is_staff = EXCLUDED.is_staff, is_active = EXCLUDED.is_active,
    is_superuser = EXCLUDED.is_superuser
RETURNING id`,
    { username, hash: hash || hashDjango(password), is_staff, is_active, is_superuser },
  );
  return Number(id);
}

const USERS = {
  staff: { username: 'e2e_staff', password: 'e2e-password-staff' },
  superuser: { username: 'e2e_super', password: 'e2e-password-super' },
  inactive: { username: 'e2e_inactive', password: 'e2e-password-inactive' },
  nonstaff: { username: 'e2e_nonstaff', password: 'e2e-password-nonstaff' },
};

module.exports = {
  ROOT,
  API_PORT,
  RAWG_PORT,
  API_URL,
  MEDIA_ROOT,
  RAWG_KEY,
  USERS,
  BINARY,
  dreamEnv,
  sql,
  hashDjango,
  verificaHashDjango,
  salvaUtente,
};
