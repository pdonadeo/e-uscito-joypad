// Helper per i test GraphQL del backoffice (/bo) e per preparare i dati dei test:
// dalla Fase 1 della rimozione di Django la REST /api/bo non c'è più, tranne la cover.
const { expect } = require('@playwright/test');
const { newContext } = require('./helpers');

const ENDPOINT = '/api/graphql';

// Selezioni complete dei tipi di docs/schema.graphql.
const F = {
  me: 'id username fullName is_superuser',
  episodioInElenco:
    'id titolo episodio_numero data_uscita durata url url_post url_video descrizione_html descrizione_txt note pubblicato cover cover_url ts_created ts',
  associazioneEpisodio: 'id videogame_id videogame_titolo istante speaker tipologia',
  videogameInElenco: 'id titolo rawg_slug cover ts',
  videogame: 'id titolo rawg_slug cover descrizione_raw descrizione_html rawg_json ts_created ts',
  associazione:
    'id episodio_id videogame_id istante speaker tipologia videogame_titolo episodio_titolo episodio_numero data_uscita',
  utente: 'id username first_name last_name email is_staff is_active is_superuser last_login date_joined',
};
F.episodio = `${F.episodioInElenco} associazioni { ${F.associazioneEpisodio} }`;

// POST /api/graphql con { query, variables }. Restituisce la risposta e il
// corpo già letto. Se la risposta non è JSON (endpoint assente: oggi, in DEBUG,
// è la pagina HTML d'errore di Dream) il test fallisce con un messaggio chiaro.
async function gql(request, query, variables, options = {}) {
  const res = await request.post(ENDPOINT, { data: { query, variables }, ...options });
  const type = res.headers()['content-type'] || '';
  if (!type.startsWith('application/json')) {
    throw new Error(
      `POST ${ENDPOINT} → HTTP ${res.status()} ${type || '(senza Content-Type)'}: ` +
        "l'endpoint GraphQL non risponde in JSON (non ancora implementato: Fase 3.6a)",
    );
  }
  const body = await res.json();
  return { res, status: res.status(), body, data: body.data, errors: body.errors };
}

// La risposta non ha errori: restituisce data.
function expectOk(r) {
  expect(r.errors, JSON.stringify(r.body)).toBeUndefined();
  expect(r.status).toBe(200);
  return r.data;
}

// Il primo errore ha extensions.code = code (e, se indicato, quel messaggio).
// Gli errori dei resolver e di validazione hanno status 200 (schema.graphql).
function expectCode(r, code, message, status = 200) {
  expect(r.errors, JSON.stringify(r.body)).toBeTruthy();
  expect(r.errors[0].extensions && r.errors[0].extensions.code, JSON.stringify(r.body)).toBe(code);
  if (message !== undefined) expect(r.errors[0].message).toBe(message);
  expect(r.status).toBe(status);
}

// Contesto con la sessione dell'utente, ottenuta con la mutation login.
async function gqlLoggedIn(playwright, user) {
  const ctx = await newContext(playwright);
  const r = await gql(ctx, `mutation($c: CredenzialiInput!) { login(credenziali: $c) { ${F.me} } }`, {
    c: { username: user.username, password: user.password },
  });
  expectOk(r);
  return ctx;
}

// rawg_json: in REST è un oggetto, in GraphQL è JSON serializzato (schema.graphql).
function parseRawg(v) {
  return v && v.rawg_json != null ? { ...v, rawg_json: JSON.parse(v.rawg_json) } : v;
}

// --- Preparazione e lettura dei dati via GraphQL --------------------------------------------
// Prendono un oggetto con i campi dell'input e ignorano gli altri (id, ts, rawg_json…), così si
// può passare un record letto e modificato. Ogni errore GraphQL fa fallire il test.

const scegli = (o, nomi) => Object.fromEntries(nomi.filter((n) => o[n] !== undefined).map((n) => [n, o[n]]));
const CAMPI = {
  videogame: ['rawg_slug', 'titolo', 'descrizione_raw', 'descrizione_html', 'cover'],
  episodio: [
    'titolo',
    'episodio_numero',
    'data_uscita',
    'durata',
    'url',
    'url_post',
    'url_video',
    'descrizione_html',
    'descrizione_txt',
    'note',
    'pubblicato',
  ],
  associazione: ['id', 'videogame_id', 'istante', 'speaker', 'tipologia'],
  utente: ['username', 'password', 'first_name', 'last_name', 'email', 'is_staff', 'is_active', 'is_superuser'],
};
const inputEpisodio = (d) => {
  const i = scegli(d, CAMPI.episodio);
  if (d.associazioni != null) i.associazioni = d.associazioni.map((a) => scegli(a, CAMPI.associazione));
  return i;
};

async function creaVideogame(api, dati) {
  const q = `mutation($d: VideogameInput!) { creaVideogame(dati: $d) { ${F.videogame} } }`;
  return expectOk(await gql(api, q, { d: scegli(dati, CAMPI.videogame) })).creaVideogame;
}

async function aggiornaVideogame(api, id, dati) {
  const q = `mutation($id: Int!, $d: VideogameInput!) { aggiornaVideogame(id: $id, dati: $d) { ${F.videogame} } }`;
  return expectOk(await gql(api, q, { id, d: scegli(dati, CAMPI.videogame) })).aggiornaVideogame;
}

// Il videogame, o null se non esiste (NOT_FOUND).
async function leggiVideogame(api, id) {
  const r = await gql(api, `query($id: Int!) { videogame(id: $id) { ${F.videogame} } }`, { id });
  if (r.errors && r.errors[0].extensions && r.errors[0].extensions.code === 'NOT_FOUND') return null;
  return expectOk(r).videogame;
}

// Righe di elencoVideogame per la ricerca (titolo, descrizione, slug RAWG).
async function elencoVideogame(api, ricerca) {
  const q = `query($r: String) { elencoVideogame(ricerca: $r, limit: 1000) { elementi { ${F.videogameInElenco} } } }`;
  return expectOk(await gql(api, q, { r: ricerca })).elencoVideogame.elementi;
}

async function creaEpisodio(api, dati) {
  const q = `mutation($d: EpisodioInput!) { creaEpisodio(dati: $d) { ${F.episodio} } }`;
  return expectOk(await gql(api, q, { d: inputEpisodio(dati) })).creaEpisodio;
}

// L'episodio con le associazioni, o null se non esiste (NOT_FOUND).
async function leggiEpisodio(api, id) {
  const r = await gql(api, `query($id: Int!) { episodio(id: $id) { ${F.episodio} } }`, { id });
  if (r.errors && r.errors[0].extensions && r.errors[0].extensions.code === 'NOT_FOUND') return null;
  return expectOk(r).episodio;
}

// Righe di elencoEpisodi per la ricerca (numero e titolo).
async function elencoEpisodi(api, ricerca) {
  const q = `query($r: String) { elencoEpisodi(ricerca: $r, limit: 1000) { elementi { ${F.episodioInElenco} } } }`;
  return expectOk(await gql(api, q, { r: ricerca })).elencoEpisodi.elementi;
}

async function creaUtente(api, dati) {
  const q = `mutation($d: UtenteInput!) { creaUtente(dati: $d) { ${F.utente} } }`;
  return expectOk(await gql(api, q, { d: scegli(dati, CAMPI.utente) })).creaUtente;
}

async function aggiornaUtente(api, id, dati) {
  const q = `mutation($id: Int!, $d: UtenteInput!) { aggiornaUtente(id: $id, dati: $d) { ${F.utente} } }`;
  return expectOk(await gql(api, q, { id, d: scegli(dati, CAMPI.utente) })).aggiornaUtente;
}

// L'utente, o null se non esiste (NOT_FOUND).
async function leggiUtente(api, id) {
  const r = await gql(api, `query($id: Int!) { utente(id: $id) { ${F.utente} } }`, { id });
  if (r.errors && r.errors[0].extensions && r.errors[0].extensions.code === 'NOT_FOUND') return null;
  return expectOk(r).utente;
}

// Riesce il login GraphQL con queste credenziali? (in un contesto a parte, poi chiuso)
async function puoEntrare(playwright, username, password) {
  const ctx = await newContext(playwright);
  const r = await gql(ctx, 'mutation($c: CredenzialiInput!) { login(credenziali: $c) { id } }', {
    c: { username, password },
  });
  await ctx.dispose();
  return !r.errors;
}

// L'utente della sessione (query me), o null se la sessione non c'è (UNAUTHENTICATED).
async function me(api) {
  const r = await gql(api, `{ me { ${F.me} } }`);
  if (r.errors && r.errors[0].extensions && r.errors[0].extensions.code === 'UNAUTHENTICATED') return null;
  return expectOk(r).me;
}

module.exports = {
  ENDPOINT,
  F,
  gql,
  expectOk,
  expectCode,
  gqlLoggedIn,
  parseRawg,
  creaVideogame,
  aggiornaVideogame,
  leggiVideogame,
  elencoVideogame,
  creaEpisodio,
  leggiEpisodio,
  elencoEpisodi,
  creaUtente,
  aggiornaUtente,
  leggiUtente,
  puoEntrare,
  me,
};
