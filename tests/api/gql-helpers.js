// Helper per i test GraphQL di /new-bo (Fase 3.5). helpers.js resta invariato.
const { expect } = require('@playwright/test');
const { newContext } = require('./helpers');

const ENDPOINT = '/api/graphql';

// Selezioni complete dei tipi di docs/schema.graphql: hanno gli stessi campi
// delle risposte di /api/bo, così i test di parità confrontano oggetti interi.
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

module.exports = { ENDPOINT, F, gql, expectOk, expectCode, gqlLoggedIn, parseRawg };
