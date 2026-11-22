// Runner delle migrazioni (src/migrazioni/migrazioni.ml), provato sul binario vero contro un
// PostgreSQL usa e getta (postgres:15-alpine su 127.0.0.1:55433, dati in tmpfs). Ogni caso
// lavora su un suo database. I binari ascoltano su 3921 e 3922.
//
// I casi «initdb» usano un secondo PostgreSQL usa e getta (127.0.0.1:55435), che nasce come
// quello del compose di sviluppo: con infra/db/ intero in /docker-entrypoint-initdb.d.
//
// I container ricevono solo le variabili POSTGRES_* e PG* di compose_env (più DEBUG nei casi
// «initdb»), una per una con -e: con --env-file compose_env le righe `export` fanno fallire
// docker run.
const { test, expect, request: richieste } = require('@playwright/test');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { ROOT, BINARY, composeEnv, dreamEnv, sql } = require('./env');

const CONTAINER = 'euj-prova-migrazioni';
const PORTA_PG = 55433;
const CONTAINER_INITDB = 'euj-prova-initdb';
const PORTA_PG_INITDB = 55435;
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

function envDb(db, porta = PORTE[0], portaPg = PORTA_PG) {
  return {
    ...process.env,
    ...dreamEnv({ PGHOST: '127.0.0.1', PGPORT: String(portaPg), PGDATABASE: db, REST_LISTEN_PORT: String(porta) }),
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

// Variabili POSTGRES_* e PG* di compose_env, come argomenti -e di docker run.
const variabiliPg = () =>
  Object.entries(env)
    .filter(([k]) => /^(POSTGRES_|PG)[A-Z_]*$/.test(k))
    .flatMap(([k, v]) => ['-e', `${k}=${v}`]);

// Aspetta che il Postgres risponda su TCP: durante initdb ascolta solo sul socket locale, quindi
// la prima risposta su 127.0.0.1 arriva a initdb finito.
function attendiPostgres(container, ms) {
  const fine = Date.now() + ms;
  for (;;) {
    try {
      docker(['exec', container, 'psql', '-h', '127.0.0.1', '-U', PGUSER, '-d', env.PGDATABASE, '-c', 'SELECT 1'], {
        stdio: 'ignore',
      });
      return;
    } catch {
      if (Date.now() > fine) throw new Error(`il Postgres ${container} non è partito entro ${ms} ms`);
      execFileSync('sleep', ['0.5']);
    }
  }
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  try {
    docker(['rm', '-fv', CONTAINER], { stdio: 'ignore' });
  } catch {}
  docker([
    'run', '--rm', '-d', '--name', CONTAINER,
    '-p', `127.0.0.1:${PORTA_PG}:5432`,
    '--tmpfs', '/var/lib/postgresql/data',
    ...variabiliPg(),
    '-v', `${path.join(ROOT, 'infra', 'db', '01_init_pg.sh')}:/docker-entrypoint-initdb.d/01_init_pg.sh:ro`,
    'postgres:15-alpine',
  ]);
  attendiPostgres(CONTAINER, 45_000);
});

test.afterEach(async () => {
  for (const proc of avviati.splice(0)) await ferma(proc);
});

test.afterAll(() => {
  docker(['rm', '-fv', CONTAINER], { stdio: 'ignore' });
  try {
    docker(['rm', '-fv', CONTAINER_INITDB], { stdio: 'ignore' });
  } catch {}
});

test('DB vuoto: 0001 eseguita e registrata, 0002 no-op registrata, tutto di proprietà di PGUSER', async () => {
  creaDb('vuoto');
  const b = avviaBinario('vuoto');
  await attendiPorta(b, PORTE[0]);
  console.log(b.log);

  expect(b.log).toContain('migrazioni: stato del DB: Vuoto');
  expect(b.log).toContain('migrazioni: applico 0001_schema_di_partenza');
  expect(b.log).toMatch(/migrazioni: 0001_schema_di_partenza applicata in \d+ ms/);
  // 0002 non trova tabelle di Django da togliere: DROP TABLE IF EXISTS è un no-op
  expect(b.log).toMatch(/migrazioni: 0002_via_tabelle_django applicata in \d+ ms/);
  expect(q('vuoto', "SELECT versione || '|' || eseguita FROM schema_migrations ORDER BY 1")).toBe(
    ['0001|true', '0002|true'].join('\n'),
  );
  expect(q('vuoto', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")).toBe('5');
  expect(q('vuoto', "SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'")).toBe(PGUSER);
  expect(q('vuoto', "SELECT extname || '|' || extowner::regrole FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY 1")).toBe(
    [`btree_gin|${PGUSER}`, `pg_trgm|${PGUSER}`, `unaccent|${PGUSER}`].join('\n'),
  );
});

const SCHEMA_DJANGO = fs.readFileSync(path.join(ROOT, 'tests', 'migrazioni', 'schema-django.sql'), 'utf8');
const TABELLE_FINALI = [
  'auth_user',
  'backoffice_associazioneepisodiovideogame',
  'backoffice_episodio',
  'backoffice_videogame',
  'schema_migrations',
].join('\n');

test('DB come produzione (schema di Django): 0001 registrata senza eseguirla, 0002 toglie le tabelle Django', async () => {
  creaDb('produzione');
  q('produzione', SCHEMA_DJANGO);
  expect(q('produzione', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")).toBe('14');
  const b = avviaBinario('produzione');
  await attendiPorta(b, PORTE[0]);
  console.log(b.log);

  expect(b.log).toContain('migrazioni: stato del DB: Esistente_senza_registro');
  expect(b.log).toContain('migrazioni: 0001_schema_di_partenza registrata senza eseguirla');
  expect(b.log).not.toContain('migrazioni: applico 0001');
  expect(b.log).toContain('migrazioni: applico 0002_via_tabelle_django');
  expect(b.log).toMatch(/migrazioni: 0002_via_tabelle_django applicata in \d+ ms/);
  expect(q('produzione', "SELECT versione || '|' || eseguita FROM schema_migrations ORDER BY 1")).toBe(
    ['0001|false', '0002|true'].join('\n'),
  );
  // restano le 4 tabelle dei dati e il registro
  expect(q('produzione', "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).toBe(TABELLE_FINALI);
});

test('0002 fallisce (vista su django_session): esce con 12, rollback, tabelle Django intatte', async () => {
  creaDb('vista');
  q('vista', SCHEMA_DJANGO);
  q('vista', 'CREATE VIEW sessioni_e2e AS SELECT session_key FROM django_session');
  const b = avviaBinario('vista');
  const codice = await entro(b.uscita, 15_000, 'uscita del binario');
  console.log(b.log);

  expect(codice).toBe(12);
  expect(b.log).toContain('migrazioni: 0001_schema_di_partenza registrata senza eseguirla');
  const errore = righe(b.log, 'migrazioni: ERRORE in 0002_via_tabelle_django');
  expect(errore).toHaveLength(1);
  // 2BP01: dependent_objects_still_exist (senza CASCADE il DROP si ferma sulla vista)
  expect(errore[0]).toContain('SQLSTATE 2BP01');
  // il DETAIL di Postgres, in coda alla stessa riga, nomina la vista e la tabella
  expect(errore[0]).toContain('— DETAIL: view sessioni_e2e depends on table django_session');
  // 0001 era registrata in una transazione sua; la 0002 è andata in rollback
  expect(q('vista', "SELECT versione || '|' || eseguita FROM schema_migrations ORDER BY 1")).toBe('0001|false');
  expect(q('vista', "SELECT count(*) FROM pg_tables WHERE schemaname = 'public'")).toBe('15');
  expect(q('vista', "SELECT to_regclass('public.django_session') IS NOT NULL")).toBe('t');
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
    expect(q('lock', 'SELECT versione FROM schema_migrations ORDER BY 1')).toBe(
      MIGRAZIONI.map((m) => m.slice(0, 4)).join('\n'),
    );
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

// ---- initdb di sviluppo (Fase 7): 01_init_pg.sh e 02_schema_e_seed.sh su un volume vuoto ----

const TABELLE_DATI = [
  'auth_user',
  'backoffice_associazioneepisodiovideogame',
  'backoffice_episodio',
  'backoffice_videogame',
];

// SQL sul Postgres dei casi initdb, nel database PGDATABASE, come PGUSER
const qi = (query) => sql(query, {}, { container: CONTAINER_INITDB });

// Un Postgres nuovo, con infra/db/ montato come nel compose di sviluppo e DEBUG come indicato.
function avviaInitdb(debug) {
  try {
    docker(['rm', '-fv', CONTAINER_INITDB], { stdio: 'ignore' });
  } catch {}
  docker([
    'run', '--rm', '-d', '--name', CONTAINER_INITDB,
    '-p', `127.0.0.1:${PORTA_PG_INITDB}:5432`,
    '--tmpfs', '/var/lib/postgresql/data',
    ...variabiliPg(),
    '-e', `DEBUG=${debug}`,
    '-v', `${path.join(ROOT, 'infra', 'db')}:/docker-entrypoint-initdb.d:ro`,
    'postgres:15-alpine',
  ]);
  attendiPostgres(CONTAINER_INITDB, 90_000);
}

// Le righe di initdb dal log del container (docker logs scrive su stdout e su stderr).
function logInitdb() {
  const { stdout, stderr } = spawnSync('docker', ['logs', CONTAINER_INITDB], { encoding: 'utf8' });
  return (stdout + stderr)
    .split('\n')
    .filter((riga) => /02_schema_e_seed|01_init_pg|docker-entrypoint-initdb|ERROR|FATAL/.test(riga))
    .join('\n');
}

test('initdb di sviluppo (DEBUG del compose, True): schema e seed, poi il binario registra 0001 e applica 0002', async () => {
  test.setTimeout(150_000);
  expect(env.DEBUG.toLowerCase()).toBe('true');
  avviaInitdb(env.DEBUG);
  const log = logInitdb();
  console.log(log);
  expect(log).toContain('02_schema_e_seed: carico lo schema da /docker-entrypoint-initdb.d/migrazioni/0001_schema_di_partenza.sql');
  expect(log).toContain('02_schema_e_seed: carico il seed da /docker-entrypoint-initdb.d/seed/seed_sviluppo.sql');

  // i dati della fixture e il solo admin
  expect(qi('SELECT count(*) FROM backoffice_episodio')).toBe('108');
  expect(qi('SELECT count(*) FROM backoffice_videogame')).toBe('681');
  expect(qi('SELECT count(*) FROM backoffice_associazioneepisodiovideogame')).toBe('1209');
  expect(qi('SELECT username FROM auth_user')).toBe('admin');
  // tutto di PGUSER, nessun registro (lo crea il binario)
  expect(qi("SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public'")).toBe(
    TABELLE_DATI.join(','),
  );
  expect(qi("SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = 'public'")).toBe(PGUSER);
  // sequenze oltre il max(id): il prossimo id non collide
  for (const t of TABELLE_DATI) {
    const ultimo = qi(
      `SELECT last_value FROM pg_sequences WHERE schemaname || '.' || sequencename = pg_get_serial_sequence('public.${t}', 'id')`,
    );
    const massimo = qi(`SELECT max(id) FROM ${t}`);
    expect(Number(ultimo), t).toBeGreaterThanOrEqual(Number(massimo));
  }

  // il binario trova lo schema senza registro: registra 0001, applica 0002 (no-op)
  const b = avvia(BINARY, envDb(env.PGDATABASE, PORTE[0], PORTA_PG_INITDB));
  await attendiPorta(b, PORTE[0]);
  console.log(b.log);
  expect(b.log).toContain('migrazioni: stato del DB: Esistente_senza_registro');
  expect(b.log).toContain('migrazioni: 0001_schema_di_partenza registrata senza eseguirla');
  expect(b.log).toMatch(/migrazioni: 0002_via_tabelle_django applicata in \d+ ms/);
  expect(qi("SELECT versione || '|' || eseguita FROM schema_migrations ORDER BY 1")).toBe(
    ['0001|false', '0002|true'].join('\n'),
  );
  expect(qi('SELECT count(*) FROM backoffice_episodio')).toBe('108');

  // login GraphQL di admin con la password del seed
  const base = `http://127.0.0.1:${PORTE[0]}`;
  const ctx = await richieste.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
  try {
    const login = await (
      await ctx.post('/api/graphql', {
        data: {
          query: 'mutation($c: CredenzialiInput!) { login(credenziali: $c) { id } }',
          variables: { c: { username: 'admin', password: 'CHANGE_ME_IN_PRODUCTION' } },
        },
      })
    ).json();
    expect(login.errors, JSON.stringify(login)).toBeUndefined();
    const me = await (await ctx.post('/api/graphql', { data: { query: '{ me { username } }' } })).json();
    expect(me.data.me.username).toBe('admin');
  } finally {
    await ctx.dispose();
  }
});

test('initdb di sviluppo con DEBUG=False: schema sì, seed no', async () => {
  test.setTimeout(120_000);
  avviaInitdb('False');
  const log = logInitdb();
  console.log(log);
  expect(log).toContain('02_schema_e_seed: carico lo schema da /docker-entrypoint-initdb.d/migrazioni/0001_schema_di_partenza.sql');
  expect(log).toContain('02_schema_e_seed: DEBUG non è True, niente seed');
  expect(log).not.toContain('carico il seed');

  expect(qi("SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables WHERE schemaname = 'public'")).toBe(
    TABELLE_DATI.join(','),
  );
  for (const t of TABELLE_DATI) expect(qi(`SELECT count(*) FROM ${t}`), t).toBe('0');
});
