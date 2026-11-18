import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { graphql } from '@/gql'
import type {
  Direzione,
  ElencoVideogameQuery,
  OrdinamentoVideogame,
  VideogameInput,
  VideogameQuery,
} from '@/gql/graphql'
import { ErroreApi, esegui, MESSAGGIO_RETE } from '@/lib/graphql'

// Videogame: F-VG-01…F-VG-08 e F-AS-01 per «Episodi in cui è citato» (docs/analisi.md).

export type { OrdinamentoVideogame }

// Il titolo può mancare (arriva da RAWG): al suo posto si mostra lo slug.
export const nomeVideogame = (v: { titolo?: string | null; rawg_slug: string }) => v.titolo || v.rawg_slug

// --- Elenco (F-VG-01 … F-VG-03) -------------------------------------------------------------

const documentoElenco = graphql(`
  query ElencoVideogame(
    $offset: Int
    $limit: Int
    $ricerca: String
    $ordinamento: OrdinamentoVideogame
    $direzione: Direzione
  ) {
    elencoVideogame(offset: $offset, limit: $limit, ricerca: $ricerca, ordinamento: $ordinamento, direzione: $direzione) {
      totale
      elementi {
        id
        titolo
        rawg_slug
        cover
      }
    }
  }
`)

export type VideogameInElenco = ElencoVideogameQuery['elencoVideogame']['elementi'][number]

export type ParametriElencoVideogame = {
  pagina: number
  righe: number
  ricerca: string
  ordinamento: OrdinamentoVideogame
  direzione: Direzione
}

export const elencoVideogame = (p: ParametriElencoVideogame) =>
  queryOptions({
    queryKey: ['videogame', 'elenco', p],
    queryFn: async () =>
      (
        await esegui(documentoElenco, {
          offset: (p.pagina - 1) * p.righe,
          limit: p.righe,
          ricerca: p.ricerca.trim() === '' ? null : p.ricerca,
          ordinamento: p.ordinamento,
          direzione: p.direzione,
        })
      ).elencoVideogame,
    placeholderData: keepPreviousData,
  })

// --- Dettaglio (F-VG-04) --------------------------------------------------------------------

const documentoVideogame = graphql(`
  query Videogame($id: Int!) {
    videogame(id: $id) {
      id
      titolo
      rawg_slug
      cover
      descrizione_raw
      descrizione_html
      rawg_json
    }
  }
`)

export type Videogame = VideogameQuery['videogame']

// Il form parte sempre dal dettaglio completo: staleTime 0, si rilegge a ogni apertura.
export const videogame = (id: number) =>
  queryOptions({
    queryKey: ['videogame', 'dettaglio', id],
    queryFn: async () => (await esegui(documentoVideogame, { id })).videogame,
    staleTime: 0,
  })

// --- Episodi in cui è citato (F-VG-08 su F-AS-01) -------------------------------------------

export const RIGHE_CITATI = 25

const documentoCitati = graphql(`
  query EpisodiCitati($videogame_id: Int, $offset: Int, $limit: Int) {
    elencoAssociazioni(
      videogame_id: $videogame_id
      offset: $offset
      limit: $limit
      ordinamento: DATA_USCITA
      direzione: DESC
    ) {
      totale
      elementi {
        id
        episodio_id
        episodio_numero
        episodio_titolo
        data_uscita
        istante
        tipologia
      }
    }
  }
`)

// F-VG-08: data di uscita decrescente e, a parità, istante decrescente; 25 righe per pagina.
export const episodiCitati = (videogameId: number, pagina: number) =>
  queryOptions({
    queryKey: ['videogame', 'citati', videogameId, pagina],
    queryFn: async () =>
      (
        await esegui(documentoCitati, {
          videogame_id: videogameId,
          offset: (pagina - 1) * RIGHE_CITATI,
          limit: RIGHE_CITATI,
        })
      ).elencoAssociazioni,
    placeholderData: keepPreviousData,
  })

// --- Scrittura (F-VG-05, F-VG-06, F-VG-07) --------------------------------------------------

// Le mutation restituiscono il dettaglio completo, come la query Videogame: `onCreato` riceve il
// videogame creato, dopo «Salva e continua» il form riparte dai dati salvati.
const documentoCrea = graphql(`
  mutation CreaVideogame($dati: VideogameInput!) {
    creaVideogame(dati: $dati) {
      id
      titolo
      rawg_slug
      cover
      descrizione_raw
      descrizione_html
      rawg_json
    }
  }
`)

const documentoAggiorna = graphql(`
  mutation AggiornaVideogame($id: Int!, $dati: VideogameInput!) {
    aggiornaVideogame(id: $id, dati: $dati) {
      id
      titolo
      rawg_slug
      cover
      descrizione_raw
      descrizione_html
      rawg_json
    }
  }
`)

const documentoElimina = graphql(`
  mutation EliminaVideogame($id: Int!) {
    eliminaVideogame(id: $id) {
      id
    }
  }
`)

export async function creaVideogame(dati: VideogameInput): Promise<Videogame> {
  return (await esegui(documentoCrea, { dati })).creaVideogame
}

export async function aggiornaVideogame(id: number, dati: VideogameInput): Promise<Videogame> {
  return (await esegui(documentoAggiorna, { id, dati })).aggiornaVideogame
}

export async function eliminaVideogame(id: number) {
  return (await esegui(documentoElimina, { id })).eliminaVideogame.id
}

// Eliminazione in blocco (F-VG-07): una mutation per videogame. Restituisce gli errori delle
// righe che non si sono cancellate; le altre restano cancellate.
export async function eliminaVideogameInBlocco(ids: readonly number[]): Promise<ErroreApi[]> {
  const esiti = await Promise.allSettled(ids.map((id) => eliminaVideogame(id)))
  return esiti.flatMap((e) =>
    e.status === 'rejected' ? [e.reason instanceof ErroreApi ? e.reason : new ErroreApi(MESSAGGIO_RETE, 'RETE')] : [],
  )
}

// rawg_json arriva come JSON serializzato: si mostra formattato (F-VG-04); se non è JSON valido
// si mostra com'è.
export function jsonLeggibile(v: string): string {
  try {
    return JSON.stringify(JSON.parse(v), null, 2)
  } catch {
    return v
  }
}
