import type { TypedDocumentNode } from '@graphql-typed-document-node/core'
import { ClientError, GraphQLClient } from 'graphql-request'
import { ErroreApi, MESSAGGIO_RETE, type CodiceErrore } from '@/lib/errore-api'

// Client di POST /api/graphql (docs/schema.graphql).
// - Content-Type esatto `application/json`, senza charset: con il charset Dream risponde 400.
// - Il cookie di sessione è quello di /api/bo (stessa origine, credentials same-origin).
// - Il browser manda da solo l'header Origin, richiesto dal controllo V-01.
// - I testi viaggiano sempre come variabili: il lexer della libreria OCaml non
//   accetta gli escape \u nelle query letterali.
const client = new GraphQLClient(`${window.location.origin}/api/graphql`, {
  credentials: 'same-origin',
  headers: { 'Content-Type': 'application/json' },
})

export { eErroreApi, ErroreApi, MESSAGGIO_RETE, type CodiceErrore } from '@/lib/errore-api'

function comeErroreApi(e: unknown): ErroreApi {
  if (e instanceof ClientError) {
    const primo = e.response.errors?.[0]
    if (primo) {
      const codice = (primo.extensions?.code as CodiceErrore | undefined) ?? 'INTERNAL'
      return new ErroreApi(primo.message, codice)
    }
    // 403 di Auth.origin_check: il body è il JSON REST {"message": …}, non errors[] (P-4)
    const corpo = e.response as unknown as { message?: unknown; status?: number }
    if (typeof corpo.message === 'string' && corpo.status === 403) return new ErroreApi(corpo.message, 'FORBIDDEN')
  }
  return new ErroreApi(MESSAGGIO_RETE, 'RETE')
}

export async function esegui<T, V extends Record<string, unknown>>(
  documento: TypedDocumentNode<T, V>,
  ...variabili: V extends Record<string, never> ? [] : [V]
): Promise<T> {
  try {
    return await client.request<T>({ document: documento, variables: variabili[0] })
  } catch (e) {
    throw comeErroreApi(e)
  }
}
