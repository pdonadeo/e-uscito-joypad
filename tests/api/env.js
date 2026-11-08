// Parametri condivisi tra la config Playwright dell'API admin e i test.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const API_PORT = Number(process.env.ADMIN_API_PORT || 3901);
const RAWG_PORT = Number(process.env.ADMIN_RAWG_PORT || 3902);
const API_URL = `http://127.0.0.1:${API_PORT}`;
const MEDIA_ROOT = path.join(os.tmpdir(), 'euj-admin-api-test-media');
const RAWG_KEY = 'e2e-rawg-key';
const BACKOFFICE_CONTAINER = process.env.BACKOFFICE_CONTAINER || 'euj-backoffice';
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

// Esegue codice Python nella shell Django del container backoffice.
function django(code) {
  return execFileSync('docker', ['exec', '-i', BACKOFFICE_CONTAINER, 'python', 'manage.py', 'shell'], {
    input: code,
    encoding: 'utf8',
  }).trim();
}

const USERS = {
  staff: { username: 'e2e_staff', password: 'e2e-password-staff' },
  superuser: { username: 'e2e_super', password: 'e2e-password-super' },
  inactive: { username: 'e2e_inactive', password: 'e2e-password-inactive' },
  nonstaff: { username: 'e2e_nonstaff', password: 'e2e-password-nonstaff' },
};

module.exports = { ROOT, API_PORT, RAWG_PORT, API_URL, MEDIA_ROOT, RAWG_KEY, USERS, BINARY, dreamEnv, django };
