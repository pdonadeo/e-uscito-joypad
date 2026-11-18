import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { graphql } from '@/gql'
import type { Direzione, OrdinamentoUtenti, UtenteInput, UtenteQuery } from '@/gql/graphql'
import { ErroreApi, esegui, MESSAGGIO_RETE } from '@/lib/graphql'

// Utenti, solo per i superuser: F-UT-01 … F-UT-06 (docs/analisi.md).

export type { OrdinamentoUtenti }

// --- Elenco (F-UT-01, F-UT-02) --------------------------------------------------------------

const documentoElenco = graphql(`
  query ElencoUtenti($offset: Int, $limit: Int, $ricerca: String, $ordinamento: OrdinamentoUtenti, $direzione: Direzione) {
    elencoUtenti(offset: $offset, limit: $limit, ricerca: $ricerca, ordinamento: $ordinamento, direzione: $direzione) {
      totale
      elementi {
        id
        username
        first_name
        last_name
        email
        is_staff
        is_active
        is_superuser
        last_login
        date_joined
      }
    }
  }
`)

export type ParametriElencoUtenti = {
  pagina: number
  righe: number
  ricerca: string
  ordinamento: OrdinamentoUtenti
  direzione: Direzione
}

export const elencoUtenti = (p: ParametriElencoUtenti) =>
  queryOptions({
    queryKey: ['utenti', 'elenco', p],
    queryFn: async () =>
      (
        await esegui(documentoElenco, {
          offset: (p.pagina - 1) * p.righe,
          limit: p.righe,
          ricerca: p.ricerca.trim() === '' ? null : p.ricerca,
          ordinamento: p.ordinamento,
          direzione: p.direzione,
        })
      ).elencoUtenti,
    placeholderData: keepPreviousData,
  })

// --- Dettaglio (F-UT-03) --------------------------------------------------------------------

const documentoUtente = graphql(`
  query Utente($id: Int!) {
    utente(id: $id) {
      id
      username
      first_name
      last_name
      email
      is_staff
      is_active
      is_superuser
      last_login
      date_joined
    }
  }
`)

export type Utente = UtenteQuery['utente']

// Il form parte sempre dal dettaglio completo: staleTime 0, si rilegge a ogni apertura.
export const utente = (id: number) =>
  queryOptions({
    queryKey: ['utenti', 'dettaglio', id],
    queryFn: async () => (await esegui(documentoUtente, { id })).utente,
    staleTime: 0,
  })

// --- Scrittura (F-UT-04, F-UT-05, F-UT-06) --------------------------------------------------

// Le mutation restituiscono il dettaglio completo: dopo «Crea» si apre la modifica, dopo
// «Salva e continua» il form riparte dai dati salvati.
const documentoCrea = graphql(`
  mutation CreaUtente($dati: UtenteInput!) {
    creaUtente(dati: $dati) {
      id
      username
      first_name
      last_name
      email
      is_staff
      is_active
      is_superuser
      last_login
      date_joined
    }
  }
`)

const documentoAggiorna = graphql(`
  mutation AggiornaUtente($id: Int!, $dati: UtenteInput!) {
    aggiornaUtente(id: $id, dati: $dati) {
      id
      username
      first_name
      last_name
      email
      is_staff
      is_active
      is_superuser
      last_login
      date_joined
    }
  }
`)

const documentoElimina = graphql(`
  mutation EliminaUtente($id: Int!) {
    eliminaUtente(id: $id) {
      id
    }
  }
`)

export async function creaUtente(dati: UtenteInput): Promise<Utente> {
  return (await esegui(documentoCrea, { dati })).creaUtente
}

export async function aggiornaUtente(id: number, dati: UtenteInput): Promise<Utente> {
  return (await esegui(documentoAggiorna, { id, dati })).aggiornaUtente
}

export async function eliminaUtente(id: number) {
  return (await esegui(documentoElimina, { id })).eliminaUtente.id
}

// Eliminazione in blocco (F-UT-06): una mutation per utente. Restituisce gli errori delle righe
// che non si sono cancellate (per esempio «Non puoi cancellare te stesso»); le altre restano
// cancellate.
export async function eliminaUtenti(ids: readonly number[]): Promise<ErroreApi[]> {
  const esiti = await Promise.allSettled(ids.map((id) => eliminaUtente(id)))
  return esiti.flatMap((e) =>
    e.status === 'rejected' ? [e.reason instanceof ErroreApi ? e.reason : new ErroreApi(MESSAGGIO_RETE, 'RETE')] : [],
  )
}

// --- Formati --------------------------------------------------------------------------------

// Nome e cognome insieme, vuoto se mancano tutti e due.
export const nomeCompleto = (u: { first_name: string; last_name: string }) =>
  [u.first_name, u.last_name].filter((s) => s.trim() !== '').join(' ')

const due = (n: number) => String(n).padStart(2, '0')

// Data e ora nel fuso del browser, come nei PNG: «2026-11-16 09:12».
export function dataOra(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())} ${due(d.getHours())}:${due(d.getMinutes())}`
}

// Forma breve delle schede a 390 (elenco-utenti-390.png): «16/11 09:12» nell'anno in corso,
// «02/03/2025» negli anni passati.
export function dataBreve(iso: string, oggi = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  if (d.getFullYear() === oggi.getFullYear()) return `${due(d.getDate())}/${due(d.getMonth() + 1)} ${due(d.getHours())}:${due(d.getMinutes())}`
  return `${due(d.getDate())}/${due(d.getMonth() + 1)}/${d.getFullYear()}`
}
