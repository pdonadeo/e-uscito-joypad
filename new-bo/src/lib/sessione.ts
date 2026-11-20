import { queryOptions } from '@tanstack/react-query'
import { graphql } from '@/gql'
import type { UtenteCorrenteQuery } from '@/gql/graphql'
import { esegui } from '@/lib/graphql'

// Sessione: login (F-AU-01), logout (F-AU-02), utente corrente (F-AU-03, F-AU-04, F-AU-05),
// cambio della propria password (F-AU-06).

const documentoMe = graphql(`
  query UtenteCorrente {
    me {
      id
      username
      fullName
      is_superuser
    }
  }
`)

const documentoLogin = graphql(`
  mutation Login($credenziali: CredenzialiInput!) {
    login(credenziali: $credenziali) {
      id
      username
      fullName
      is_superuser
    }
  }
`)

const documentoLogout = graphql(`
  mutation Logout {
    logout
  }
`)

const documentoCambiaPassword = graphql(`
  mutation CambiaPassword($attuale: String!, $nuova: String!) {
    cambiaPassword(attuale: $attuale, nuova: $nuova) {
      id
      username
      fullName
      is_superuser
    }
  }
`)

export type UtenteCorrente = UtenteCorrenteQuery['me']

export const utenteCorrente = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await esegui(documentoMe)).me,
  staleTime: 60_000,
})

export async function login(username: string, password: string) {
  return (await esegui(documentoLogin, { credenziali: { username, password } })).login
}

export async function logout() {
  return (await esegui(documentoLogout)).logout
}

// F-AU-06: la sessione corrente resta valida, le altre dello stesso utente si chiudono.
// Password attuale sbagliata → BAD_USER_INPUT con MESSAGGIO_ATTUALE_ERRATA (non UNAUTHENTICATED).
export const MESSAGGIO_ATTUALE_ERRATA = 'La password attuale non è corretta'

export async function cambiaPassword(attuale: string, nuova: string) {
  return (await esegui(documentoCambiaPassword, { attuale, nuova })).cambiaPassword
}
