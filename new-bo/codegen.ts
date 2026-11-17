import type { CodegenConfig } from '@graphql-codegen/cli'

// Tipi delle operazioni generati dal contratto (docs/schema.graphql) con il client preset.
// L'output in src/gql/ è rigenerato da `bun run codegen` e non si committa.
const config: CodegenConfig = {
  schema: '../docs/schema.graphql',
  documents: ['src/**/*.{ts,tsx}', '!src/gql/**/*'],
  ignoreNoDocuments: true,
  generates: {
    './src/gql/': {
      preset: 'client',
      presetConfig: { fragmentMasking: false },
      config: {
        // niente enum TypeScript: con erasableSyntaxOnly non compilerebbero
        enumsAsTypes: true,
        useTypeImports: true,
      },
    },
  },
}

export default config
