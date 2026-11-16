// Lo schema servito da /api/graphql coincide con docs/schema.graphql (Fase 3.5.4).
// Confronto: printSchema(lexicographicSortSchema(...)) di tutti e due, senza le
// descrizioni (tolte dall'AST: con una regex resterebbero righe vuote, spike 3.3a.1).
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { buildClientSchema, buildSchema, getIntrospectionQuery, lexicographicSortSchema, parse, print, printSchema, visit } = require('graphql');
const { ROOT } = require('./env');
const { newContext } = require('./helpers');
const { gql, expectOk } = require('./gql-helpers');

const SDL = fs.readFileSync(path.join(ROOT, 'docs', 'schema.graphql'), 'utf8');

function normalize(schema) {
  const ast = parse(printSchema(lexicographicSortSchema(schema)));
  return print(
    visit(ast, {
      enter(node) {
        return node.description ? { ...node, description: undefined } : undefined;
      },
    }),
  );
}

test('introspection anonima → stesso schema di docs/schema.graphql (descrizioni escluse)', async ({ playwright }) => {
  const ctx = await newContext(playwright);
  const data = expectOk(await gql(ctx, getIntrospectionQuery({ descriptions: true })));
  const fromServer = buildClientSchema(data);
  expect(normalize(fromServer)).toBe(normalize(buildSchema(SDL)));
  // i tipi radice si chiamano Query e Mutation (spike 3.3a.1)
  expect(fromServer.getQueryType().name).toBe('Query');
  expect(fromServer.getMutationType().name).toBe('Mutation');
  await ctx.dispose();
});

test('le etichette di Speaker e Tipologia sono le descrizioni dei valori (F-AS-03)', async ({ playwright }) => {
  const ctx = await newContext(playwright);
  const data = expectOk(await gql(ctx, getIntrospectionQuery({ descriptions: true })));
  const fromServer = buildClientSchema(data);
  const fromSdl = buildSchema(SDL);
  for (const name of ['Speaker', 'Tipologia']) {
    const labels = (s) => s.getType(name).getValues().map((v) => [v.name, v.description]);
    expect(labels(fromServer), name).toEqual(labels(fromSdl));
  }
  await ctx.dispose();
});
