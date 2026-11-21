const { expect } = require('@playwright/test');
const { randomInt } = require('node:crypto');
const { API_URL, RAWG_PORT } = require('./env');

async function newContext(playwright, headers = { Origin: API_URL }) {
  return playwright.request.newContext({ baseURL: API_URL, extraHTTPHeaders: headers });
}

// Contesto con sessione dell'utente indicato, aperta con la mutation login di GraphQL.
async function loggedIn(playwright, user) {
  const ctx = await newContext(playwright);
  const res = await ctx.post('/api/graphql', {
    data: {
      query: 'mutation($c: CredenzialiInput!) { login(credenziali: $c) { id } }',
      variables: { c: { username: user.username, password: user.password } },
    },
  });
  const body = await res.json();
  expect(body.errors, JSON.stringify(body)).toBeUndefined();
  return ctx;
}

async function rawgCalls(request) {
  const res = await request.get(`http://127.0.0.1:${RAWG_PORT}/calls`);
  return Number(await res.text());
}

const uniq = () => `${Date.now()}-${randomInt(1e6)}`;

// PNG 1x1 valido e JPEG minimale (solo i magic bytes contano per il server).
const PNG_1x1 = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6300010000050001' +
    '0d0a2db40000000049454e44ae426082',
  'hex',
);
const JPEG = Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9', 'hex');

module.exports = { newContext, loggedIn, rawgCalls, uniq, PNG_1x1, JPEG };
