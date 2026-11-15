// Lint del contratto GraphQL (Fase 3.3b): docs/schema.graphql è valido e
// copre docs/analisi.md. Non usa il server.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { buildSchema } = require('graphql');
const { ROOT } = require('./env');

const SDL = fs.readFileSync(path.join(ROOT, 'docs', 'schema.graphql'), 'utf8');
const ANALISI = fs.readFileSync(path.join(ROOT, 'docs', 'analisi.md'), 'utf8');

const ID_RE = /F-[A-Z]{2}-\d{2}/g;

// ID definiti in analisi.md: prima colonna delle tabelle delle funzioni.
function definedIds() {
  return [...ANALISI.matchAll(/^\| (F-[A-Z]{2}-\d{2}) \|/gm)].map((m) => m[1]);
}

// Tabella «Endpoint di /api/bo → ID»: [{ route, ids }].
function routeTable() {
  const start = ANALISI.indexOf('## Endpoint di `/api/bo`');
  const end = ANALISI.indexOf('\n## ', start + 1);
  return [...ANALISI.slice(start, end).matchAll(/^\| `([A-Z]+ \/api\/bo[^`]*)` \| ([^|]*) \|/gm)].map((m) => ({
    route: m[1],
    ids: m[2].match(ID_RE) || [],
  }));
}

// ID citati nei commenti «# F-…» che precedono un campo di Query o Mutation.
function operationIds() {
  const ids = new Set();
  let inRoot = false;
  let pending = [];
  for (const line of SDL.split('\n')) {
    const t = line.trim();
    if (/^type (Query|Mutation) \{/.test(t)) {
      inRoot = true;
      pending = [];
    } else if (inRoot && t === '}') {
      inRoot = false;
    } else if (inRoot && t.startsWith('#')) {
      pending.push(...(t.match(ID_RE) || []));
    } else if (inRoot && /^[a-zA-Z_]\w*[(:]/.test(t)) {
      pending.forEach((id) => ids.add(id));
      pending = [];
    }
  }
  return ids;
}

test.describe('lint di docs/schema.graphql', () => {
  test('buildSchema accetta lo schema', () => {
    expect(() => buildSchema(SDL)).not.toThrow();
  });

  test('ogni ID di analisi.md compare nello schema', () => {
    const ids = definedIds();
    expect(ids.length).toBeGreaterThan(30);
    const inSchema = new Set(SDL.match(ID_RE));
    expect(ids.filter((id) => !inSchema.has(id))).toEqual([]);
  });

  test('ogni route di /api/bo ha un\'operazione GraphQL (tranne la cover)', () => {
    const ops = operationIds();
    const routes = routeTable().filter((r) => !r.route.includes('/cover') && r.ids.length > 0);
    expect(routes.length).toBeGreaterThan(15);
    const missing = routes.filter((r) => !r.ids.some((id) => ops.has(id))).map((r) => r.route);
    expect(missing).toEqual([]);
  });
});
