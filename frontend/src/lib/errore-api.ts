// Errori dell'API in forma comune a tutto il bo. Il file non importa graphql-request: lo usa
// anche main.tsx (gestore globale dei 401), che è nel chunk d'ingresso della home pubblica.
// lib/graphql.ts lo riesporta, così il resto del bo continua a importare da lì.

export type CodiceErrore =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'BAD_USER_INPUT'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'INTERNAL'
  | 'GRAPHQL_VALIDATION'
  // non è un codice del server: la richiesta non è arrivata o la risposta non è leggibile
  | 'RETE'

export class ErroreApi extends Error {
  readonly codice: CodiceErrore

  constructor(messaggio: string, codice: CodiceErrore) {
    super(messaggio)
    this.name = 'ErroreApi'
    this.codice = codice
  }
}

export const MESSAGGIO_RETE = 'Il server non risponde. Controlla la connessione e riprova.'

export const eErroreApi = (e: unknown, codice: CodiceErrore) => e instanceof ErroreApi && e.codice === codice
