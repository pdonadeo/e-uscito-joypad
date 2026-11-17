import { queryOptions } from '@tanstack/react-query'
import { graphql } from '@/gql'
import type { UtenteCorrenteQuery } from '@/gql/graphql'
import { esegui } from '@/lib/graphql'

// Sessione: login (F-AU-01), logout (F-AU-02), utente corrente (F-AU-03, F-AU-04, F-AU-05).

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
