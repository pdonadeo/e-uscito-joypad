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

  // Dalla Fase 1 di via-django la REST /api/bo ha solo la cover: la tabella di analisi.md
  // ha solo quelle due righe. Che ogni ID di analisi.md compaia nello schema lo prova il test sopra.
  test('la tabella di /api/bo in analisi.md ha solo le due route della cover', () => {
    expect(routeTable()).toEqual([
      { route: 'POST /api/bo/episodi/:id/cover', ids: ['F-EP-10'] },
      { route: 'DELETE /api/bo/episodi/:id/cover', ids: ['F-EP-11'] },
    ]);
  });
});
