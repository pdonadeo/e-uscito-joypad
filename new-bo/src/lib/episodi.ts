import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { graphql } from '@/gql'
import type {
  Direzione,
  ElencoEpisodiQuery,
  EpisodioInput,
  EpisodioQuery,
  OrdinamentoEpisodi,
  Speaker,
  Tipologia,
} from '@/gql/graphql'
import { ErroreApi, esegui, MESSAGGIO_RETE } from '@/lib/graphql'

// Episodi e associazioni dell'episodio: F-EP-01…F-EP-11, F-AS-03 (docs/analisi.md).

export type { Direzione, OrdinamentoEpisodi, Speaker, Tipologia }

// --- Etichette (F-AS-03: l'interfaccia mostra le etichette, mai i codici) ---------------------

export const SPEAKER: readonly { valore: Speaker; etichetta: string }[] = [
  { valore: 'TUTT', etichetta: 'Tutti' },
  { valore: 'BORD', etichetta: 'Matteo Bordone (corri!)' },
  { valore: 'FOSS', etichetta: 'Francesco Fossetti (salta!)' },
  { valore: 'ZAMP', etichetta: 'Alessandro Zampini (spara!)' },
]

export const TIPOLOGIA: readonly { valore: Tipologia; etichetta: string }[] = [
  { valore: 'FREE', etichetta: 'Chiacchiera libera' },
  { valore: 'RECE', etichetta: 'Recensione' },
  { valore: 'CONS', etichetta: 'Consiglio' },
  { valore: 'STAR', etichetta: 'Osservatorio Start Citizen' },
]

// --- Formati -------------------------------------------------------------------------------

// Il server restituisce le durate come HH:MM:SS; i PNG le mostrano come H:MM:SS («0:30:00»).
export function durataBreve(v: string | null | undefined): string {
  if (!v) return ''
  return v.replace(/^0(\d:)/, '$1')
}

// «Ep. 312 · Speciale retrogaming», oppure il solo titolo se manca il numero.
export function nomeEpisodio(e: { episodio_numero?: string | null; titolo: string }): string {
  return e.episodio_numero ? `Ep. ${e.episodio_numero} · ${e.titolo}` : e.titolo
}

export const presente = (v: string | null | undefined) => v != null && v !== ''

// --- Elenco (F-EP-01 … F-EP-04) -------------------------------------------------------------

const documentoElenco = graphql(`
  query ElencoEpisodi(
    $offset: Int
    $limit: Int
    $ricerca: String
    $pubblicato: Boolean
    $ordinamento: OrdinamentoEpisodi
    $direzione: Direzione
  ) {
    elencoEpisodi(
      offset: $offset
      limit: $limit
      ricerca: $ricerca
      pubblicato: $pubblicato
      ordinamento: $ordinamento
      direzione: $direzione
    ) {
      totale
      elementi {
        id
        titolo
        episodio_numero
        data_uscita
        durata
        url
        url_post
        url_video
        pubblicato
        cover
      }
    }
  }
`)

export type EpisodioInElenco = ElencoEpisodiQuery['elencoEpisodi']['elementi'][number]

export type ParametriElenco = {
  pagina: number
  righe: number
  ricerca: string
  pubblicato: boolean | null
  ordinamento: OrdinamentoEpisodi
  direzione: Direzione
}

export const elencoEpisodi = (p: ParametriElenco) =>
  queryOptions({
    queryKey: ['episodi', 'elenco', p],
    queryFn: async () =>
      (
        await esegui(documentoElenco, {
          offset: (p.pagina - 1) * p.righe,
          limit: p.righe,
          ricerca: p.ricerca.trim() === '' ? null : p.ricerca,
          pubblicato: p.pubblicato,
          ordinamento: p.ordinamento,
          direzione: p.direzione,
        })
      ).elencoEpisodi,
    placeholderData: keepPreviousData,
  })

// --- Dettaglio (F-EP-05, F-EP-09) -----------------------------------------------------------

const documentoEpisodio = graphql(`
  query Episodio($id: Int!) {
    episodio(id: $id) {
      id
      titolo
      episodio_numero
      data_uscita
      durata
      url
      url_post
      url_video
      descrizione_html
      descrizione_txt
      note
      pubblicato
      cover
      cover_url
      associazioni {
        id
        videogame_id
        videogame_titolo
        istante
        speaker
        tipologia
      }
    }
  }
`)

export type Episodio = EpisodioQuery['episodio']

// Il form parte sempre dal dettaglio completo (F-EP-05): staleTime 0, si rilegge a ogni apertura.
export const episodio = (id: number) =>
  queryOptions({
    queryKey: ['episodi', 'dettaglio', id],
    queryFn: async () => (await esegui(documentoEpisodio, { id })).episodio,
    staleTime: 0,
  })

// --- Scrittura (F-EP-06, F-EP-07, F-EP-08, F-EP-09) -----------------------------------------

const documentoCrea = graphql(`
  mutation CreaEpisodio($dati: EpisodioInput!) {
    creaEpisodio(dati: $dati) {
      id
    }
  }
`)

const documentoAggiorna = graphql(`
  mutation AggiornaEpisodio($id: Int!, $dati: EpisodioInput!) {
    aggiornaEpisodio(id: $id, dati: $dati) {
      id
    }
  }
`)

const documentoElimina = graphql(`
  mutation EliminaEpisodio($id: Int!) {
    eliminaEpisodio(id: $id) {
      id
    }
  }
`)

export async function creaEpisodio(dati: EpisodioInput) {
  return (await esegui(documentoCrea, { dati })).creaEpisodio.id
}

export async function aggiornaEpisodio(id: number, dati: EpisodioInput) {
  return (await esegui(documentoAggiorna, { id, dati })).aggiornaEpisodio.id
}

export async function eliminaEpisodio(id: number) {
  return (await esegui(documentoElimina, { id })).eliminaEpisodio.id
}

// Eliminazione in blocco (F-EP-08): una mutation per episodio. Restituisce gli errori delle righe
// che non si sono cancellate; le altre restano cancellate.
export async function eliminaEpisodi(ids: readonly number[]): Promise<ErroreApi[]> {
  const esiti = await Promise.allSettled(ids.map((id) => eliminaEpisodio(id)))
  return esiti.flatMap((e) =>
    e.status === 'rejected' ? [e.reason instanceof ErroreApi ? e.reason : new ErroreApi(MESSAGGIO_RETE, 'RETE')] : [],
  )
}

// --- Cover: resta su REST (F-EP-10, F-EP-11) -------------------------------------------------

export const COVER_MAX_BYTE = 10 * 1024 * 1024

// Stessi messaggi del server (media.ml), così l'utente legge lo stesso testo prima e dopo l'invio.
export function controllaCover(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.png') || (file.type !== '' && file.type !== 'image/png'))
    return 'Il file deve essere un\'immagine PNG'
  if (file.size === 0) return 'File vuoto'
  if (file.size > COVER_MAX_BYTE) return 'File troppo grande (massimo 10 MB)'
  return null
}

async function rest(metodo: 'POST' | 'DELETE', id: number, body?: FormData) {
  let res: Response
  try {
    res = await fetch(`/api/bo/episodi/${id}/cover`, { method: metodo, body, credentials: 'same-origin' })
  } catch {
    throw new ErroreApi(MESSAGGIO_RETE, 'RETE')
  }
  if (res.ok) return
  let messaggio = MESSAGGIO_RETE
  try {
    const j = (await res.json()) as { message?: unknown }
    if (typeof j.message === 'string') messaggio = j.message
  } catch {
    // corpo non JSON: resta il messaggio generico
  }
  const codice =
    res.status === 401
      ? 'UNAUTHENTICATED'
      : res.status === 403
        ? 'FORBIDDEN'
        : res.status === 404
          ? 'NOT_FOUND'
          : res.status === 400 || res.status === 413
            ? 'BAD_USER_INPUT'
            : 'INTERNAL'
  throw new ErroreApi(messaggio, codice)
}

export async function caricaCover(id: number, file: File) {
  const dati = new FormData()
  dati.append('file', file, file.name)
  await rest('POST', id, dati)
}

export async function rimuoviCover(id: number) {
  await rest('DELETE', id)
}

// --- Scelta del videogame (F-EP-09 con la ricerca di F-VG-03) --------------------------------

const documentoVideogame = graphql(`
  query SceltaVideogame($ricerca: String) {
    elencoVideogame(ricerca: $ricerca, ordinamento: TITOLO, direzione: ASC, limit: 20) {
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

export const sceltaVideogame = (ricerca: string) =>
  queryOptions({
    queryKey: ['videogame', 'scelta', ricerca],
    queryFn: async () =>
      (await esegui(documentoVideogame, { ricerca: ricerca.trim() === '' ? null : ricerca })).elencoVideogame,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
