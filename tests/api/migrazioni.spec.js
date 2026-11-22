// Runner delle migrazioni (src/migrazioni/migrazioni.ml), provato sul binario vero contro un
// PostgreSQL usa e getta (postgres:15-alpine su 127.0.0.1:55433, dati in tmpfs). Ogni caso
// lavora su un suo database. I binari ascoltano su 3921 e 3922.
//
// Il container riceve solo le variabili POSTGRES_* e PG* di compose_env, una per una con -e:
// con --env-file compose_env le righe `export` fanno fallire docker run.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, execFileSync } = require('child_process');
const { ROOT, BINARY, composeEnv, dreamEnv, sql } = require('./env');

const CONTAINER = 'euj-prova-migrazioni';
const PORTA_PG = 55433;
const PORTE = [3921, 3922];
const PROVA_SINTASSI = path.join(ROOT, '_build', 'default', 'src', 'migrazioni', 'test', 'prova_sintassi.exe');
// chiave di pg_advisory_lock del runner: 0x45554A4D, "EUJM" (vedi migrazioni.ml)
const CHIAVE_LOCK = 0x45554a4d;
const MIGRAZIONI = fs
  .readdirSync(path.join(ROOT, 'infra', 'db', 'migrazioni'))
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => f.replace(/\.sql$/, ''));

const env = composeEnv();
const PGUSER = env.PGUSER;
const avviati = [];

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

function docker(args, opzioni = {}) {
  return execFileSync('docker', args, { encoding: 'utf8', ...opzioni });
}

// SQL sul Postgres usa e getta, come PGUSER
function q(db, query, variabili = {}) {
  return sql(query, variabili, { container: CONTAINER, db });
}

function creaDb(nome) {
  docker(['exec', CONTAINER, 'createdb', '-U', env.POSTGRES_USER, '-O', PGUSER, nome]);
}

function envDb(db, porta = PORTE[0]) {
  return {
    ...process.env,
    ...dreamEnv({ PGHOST: '127.0.0.1', PGPORT: String(PORTA_PG), PGDATABASE: db, REST_LISTEN_PORT: String(porta) }),
  };
}

// Avvia un eseguibile e ne raccoglie l'output (Dream scrive il log su stderr).
function avvia(eseguibile, environment) {
  const p = spawn(eseguibile, [], { env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  const proc = { p, log: '', codice: undefined };
  p.stdout.on('data', (d) => (proc.log += d));
  p.stderr.on('data', (d) => (proc.log += d));
  proc.uscita = new Promise((r) => p.on('exit', (codice, segnale) => r((proc.codice = codice ?? segnale))));
  avviati.push(proc);
  return proc;
}

const avviaBinario = (db, porta = PORTE[0]) => avvia(BINARY, envDb(db, porta));

async function entro(promessa, ms, cosa) {
  let timer;
  const scaduto = new Promise((_, rifiuta) => (timer = setTimeout(() => rifiuta(new Error(`${cosa}: oltre ${ms} ms`)), ms)));
  try {
    return await Promise.race([promessa, scaduto]);
  } finally {
    clearTimeout(timer);
  }
}

function portaAperta(porta) {
  return new Promise((r) => {
    const s = net.connect(porta, '127.0.0.1');
    s.on('connect', () => {
      s.destroy();
      r(true);
    });
    s.on('error', () => r(false));
  });
}

async function attendiPorta(proc, porta, ms = 30_000) {
  const fine = Date.now() + ms;
  while (Date.now() < fine) {
    if (await portaAperta(porta)) return;
    if (proc.codice !== undefined) throw new Error(`il binario è uscito con ${proc.codice}:\n${proc.log}`);
    await attendi(200);
  }
  throw new Error(`porta ${porta} non aperta entro ${ms} ms:\n${proc.log}`);
}

async function ferma(proc) {
  if (proc.codice !== undefined) return;
  proc.p.kill('SIGTERM');
  try {
    await entro(proc.uscita, 10_000, 'uscita dopo SIGTERM');
  } catch {
    proc.p.kill('SIGKILL');
    await proc.uscita;
  }
}

// Una sessione psql che tiene pg_advisory_lock della chiave del runner su `db`.
async function tieniLock(db) {
  const p = spawn('docker', ['exec', '-i', CONTAINER, 'psql', '-X', '-q', '-A', '-t', '-U', PGUSER, '-d', db]);
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  p.stdin.write(`SELECT pg_advisory_lock(${CHIAVE_LOCK});\n\\echo PRESO\n`);
  const fine = Date.now() + 10_000;
  while (!out.includes('PRESO')) {
    if (Date.now() > fine) throw new Error(`lock non preso dalla sessione psql: ${out}`);
    await attendi(100);
  }
  const uscita = new Promise((r) => p.on('exit', r));
  return {
    rilascia: async () => {
      p.stdin.end(`SELECT pg_advisory_unlock(${CHIAVE_LOCK});\n`);
      await entro(uscita, 10_000, 'uscita della sessione psql');
    },
    termina: () => p.kill('SIGKILL'),
  };
}

const righe = (log, testo) => log.split('\n').filter((r) => r.includes(testo));

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  try {
    docker(['rm', '-fv', CONTAINER], { stdio: 'ignore' });
  } catch {}
  const variabili = Object.entries(env)
    .filter(([k]) => /^(POSTGRES_|PG)[A-Z_]*$/.test(k))
    .flatMap(([k, v]) => ['-e', `${k}=${v}`]);
  docker([
    'run', '--rm', '-d', '--name', CONTAINER,
    '-p', `127.0.0.1:${PORTA_PG}:5432`,
    '--tmpfs', '/var/lib/postgresql/data',
    ...variabili,
    '-v', `${path.join(ROOT, 'infra', 'db', '01_init_pg.sh')}:/docker-entrypoint-initdb.d/01_init_pg.sh:ro`,
    'postgres:15-alpine',
  ]);
  // pronto quando risponde su TCP (durante initdb ascolta solo sul socket locale)
  const fine = Date.now() + 45_000;
  for (;;) {
    try {
      docker(['exec', CONTAINER, 'psql', '-h', '127.0.0.1', '-U', PGUSER, '-d', env.PGDATABASE, '-c', 'SELECT 1'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      if (Date.now() > fine) throw new Error('il Postgres usa e getta non è partito');
      execFileSync('sleep', ['0.5']);
    }
  }
});

test.afterEach(async () => {
  for (const proc of avviati.splice(0)) await ferma(proc);
});

test.afterAll(() => {
  docker(['rm', '-fv', CONTAINER], { stdio: 'ignore' });
});

test('DB vuoto: 0001 eseguita e registrata, tutto di proprietà di PGUSER', async () => {
  creaDb('vuoto');
  const b = avviaBinario('vuoto');
  await attendiPorta(b, PORTE[0]);
  console.log(b.log);

  expect(b.log).toContain('migrazioni: stato del DB: Vuoto');
  expect(b.log).toContain('migrazioni: applico 0001_schema_di_partenza');
  expect(b.log).toMatch(/migrazioni: 0001_schema_di_partenza applicata in \d+ ms/);
  expect(q('vuoto', "SELECT versione || '|' || eseguita FROM schema_migrations ORDER BY 1")).toBe('0001|true');
  expect(q('vuoto', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")).toBe('5');
  expect(q('vuoto', "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'")).toBe(PGUSER);
  expect(q('vuoto', "SELECT extname || '|' || extowner::regrole FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY 1")).toBe(
    [`btree_gin|${PGUSER}`, `pg_trgm|${PGUSER}`, `unaccent|${PGUSER}`].join('\n'),
  );
});

test('DB come produzione (schema di Django): 0001 registrata senza eseguirla', async () => {
  creaDb('produzione');
  q('produzione', fs.readFileSync(path.join(ROOT, 'tests', 'migrazioni', 'schema-django.sql'), 'utf8'));
  const prima = q('produzione', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'");
  const b = avviaBinario('produzione');
  await attendiPorta(b, PORTE[0]);
  console.log(b.log);

  expect(b.log).toContain('migrazioni: stato del DB: Esistente_senza_registro');
  expect(b.log).toContain('migrazioni: 0001_schema_di_partenza registrata senza eseguirla');
  expect(b.log).not.toContain('migrazioni: applico 0001');
  expect(q('produzione', "SELECT versione || '|' || eseguita FROM schema_migrations ORDER BY 1")).toBe('0001|false');
  // le tabelle di Django restano (le toglie la 0002, Fase 5): in più c'è solo il registro
  expect(Number(q('produzione', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"))).toBe(Number(prima) + 1);
});

test('DB parziale: esce con 11, schema non riconosciuto, nessun registro', async () => {
  creaDb('parziale');
  q('parziale', 'CREATE TABLE backoffice_episodio ()');
  const b = avviaBinario('parziale');
  const codice = await entro(b.uscita, 15_000, 'uscita del binario');
  console.log(b.log);

  expect(codice).toBe(11);
  expect(b.log).toContain('schema non riconosciuto');
  expect(b.log).toContain('tabelle trovate: backoffice_episodio');
  expect(q('parziale', "SELECT to_regclass('public.schema_migrations') IS NULL")).toBe('t');
});

test('0001 fallisce a metà file: esce con 12, rollback di tutto', async () => {
  creaDb('a_meta');
  // CREATE TABLE backoffice_videogame fallisce dopo i CREATE EXTENSION e il primo CREATE TABLE
  q('a_meta', 'CREATE TYPE backoffice_videogame AS (x int)');
  const b = avviaBinario('a_meta');
  const codice = await entro(b.uscita, 15_000, 'uscita del binario');
  console.log(b.log);

  expect(codice).toBe(12);
  const errore = righe(b.log, 'migrazioni: ERRORE in 0001_schema_di_partenza');
  expect(errore).toHaveLength(1);
  expect(errore[0]).toMatch(/SQLSTATE [0-9A-Z]{5}/);
  expect(errore[0]).toContain('backoffice_videogame');
  // DB invariato: nessuna estensione, nessuna tabella, nessun registro
  expect(q('a_meta', "SELECT string_agg(extname, ',') FROM pg_extension")).toBe('plpgsql');
  expect(q('a_meta', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")).toBe('0');
  expect(q('a_meta', "SELECT to_regclass('public.schema_migrations') IS NULL")).toBe('t');
});

test('errore di sintassi: esce con 12, log con migrazione, SQLSTATE e riga', async () => {
  creaDb('sintassi');
  const p = avvia(PROVA_SINTASSI, envDb('sintassi'));
  const codice = await entro(p.uscita, 15_000, 'uscita di prova_sintassi');
  console.log(p.log);

  expect(codice).toBe(12);
  const errore = righe(p.log, 'ERRORE in 9999_prova');
  expect(errore).toHaveLength(1);
  expect(errore[0]).toContain('SQLSTATE 42601');
  expect(errore[0]).toContain('riga 3');
});

test('due avvii concorrenti sullo stesso DB vuoto: ogni migrazione una volta sola', async () => {
  creaDb('concorrenti');
  const a = avviaBinario('concorrenti', PORTE[0]);
  const b = avviaBinario('concorrenti', PORTE[1]);
  await Promise.all([attendiPorta(a, PORTE[0]), attendiPorta(b, PORTE[1])]);
  console.log(`--- binario A\n${a.log}\n--- binario B\n${b.log}`);

  expect(q('concorrenti', 'SELECT versione FROM schema_migrations ORDER BY 1')).toBe(
    MIGRAZIONI.map((m) => m.slice(0, 4)).join('\n'),
  );
  for (const m of MIGRAZIONI) {
    expect(righe(a.log + b.log, `migrazioni: ${m} applicata in`)).toHaveLength(1);
  }
});

test('lock occupato: il binario aspetta e parte quando il lock si libera', async () => {
  creaDb('lock');
  const lock = await tieniLock('lock');
  try {
    const b = avviaBinario('lock');
    await attendi(5_000);
    expect(await portaAperta(PORTE[0])).toBe(false);
    expect(b.codice).toBeUndefined();
    expect(b.log).toContain('migrazioni: attendo il lock (altro processo in corso)');
    await lock.rilascia();
    await attendiPorta(b, PORTE[0], 10_000);
    console.log(b.log);
    expect(q('lock', 'SELECT versione FROM schema_migrations ORDER BY 1')).toBe('0001');
  } finally {
    lock.termina();
  }
});

test('lock mai rilasciato: dopo 60 s il binario esce con 13', async () => {
  test.setTimeout(90_000);
  creaDb('lock_mai');
  const lock = await tieniLock('lock_mai');
  try {
    const b = avviaBinario('lock_mai');
    const inizio = Date.now();
    const codice = await entro(b.uscita, 75_000, 'uscita del binario');
    console.log(b.log);
    expect(codice).toBe(13);
    expect(Date.now() - inizio).toBeGreaterThanOrEqual(59_000);
    expect(b.log).toContain('migrazioni: attendo il lock (altro processo in corso)');
    expect(b.log).toContain('migrazioni: lock non ottenuto entro 60 s');
    expect(q('lock_mai', "SELECT to_regclass('public.schema_migrations') IS NULL")).toBe('t');
  } finally {
    await lock.rilascia();
  }
});
