import type { Speaker, Tipologia } from '@/gql/graphql'
import type { ErroreRiga, RigaLetta } from './importa'

// Terzo passo dell'import Excel, dopo leggiFoglio e validaRighe: ogni riga diventa un videogame
// del DB. VIDEOGAME porta l'id; uno slug già nel DB usa quel gioco; uno slug nuovo crea il gioco
// da RAWG (criterio I6). Elenco e creazione arrivano da fuori, così i test usano dei finti.

export type GiocoNoto = { id: number; titolo: string | null; rawg_slug: string }

// Una riga pronta per il form: il titolo è quello del DB (o lo slug, se il gioco non ha titolo).
export type RigaRisolta = {
  riga: number
  videogame_id: number
  videogame_titolo: string
  istante: string
  tipologia: Tipologia
  speaker: Speaker
}

export type EsitoRisoluzione = {
  righe: RigaRisolta[] // vuoto se c'è almeno un errore
  errori: ErroreRiga[]
  creati: GiocoNoto[] // creati da RAWG: restano nel DB anche se l'import fallisce
}

export type Risoluzione = {
  elenco: readonly GiocoNoto[] // tutti i videogame del DB
  crea: (slug: string) => Promise<GiocoNoto> // crea il gioco da RAWG; un errore ha il messaggio del server
  // Dice se un errore di `crea` riguarda lo slug (per esempio «Gioco … non trovato su RAWG»): quello
  // va sulle sue righe. Gli altri (sessione scaduta, rete, RAWG che non risponde) fermano tutto: si
  // rilanciano, senza provare gli slug seguenti.
  erroreDiRiga: (e: unknown) => boolean
  onAvanzamento?: (provati: number, totale: number) => void // slug provati finora, su quanti
}

const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function risolviGiochi(
  righe: readonly RigaLetta[],
  { elenco, crea, erroreDiRiga, onAvanzamento }: Risoluzione,
): Promise<EsitoRisoluzione> {
  const perId = new Map(elenco.map((g) => [g.id, g]))
  const perSlug = new Map(elenco.map((g) => [g.rawg_slug.toLowerCase(), g]))
  const errori: ErroreRiga[] = []

  // 1. Gli id che non esistono. Se ce ne sono ci si ferma qui, prima di chiamare RAWG: l'import
  //    fallirebbe comunque, e i giochi creati resterebbero nel DB senza motivo.
  for (const r of righe) {
    if (r.videogame_id !== null && !perId.has(r.videogame_id))
      errori.push({ riga: r.riga, motivo: `videogame non trovato: nel DB non c'è l'id ${r.videogame_id}` })
  }
  if (errori.length > 0) return { righe: [], errori, creati: [] }

  // 2. Gli slug che non sono nel DB: ognuno si crea una volta sola, anche se è su più righe, uno
  //    dopo l'altro. Un errore dello slug (per esempio «Gioco … non trovato su RAWG») va su tutte
  //    le righe con quello slug; gli altri slug si provano lo stesso, così l'elenco degli errori
  //    è completo. Ogni altro errore si rilancia (vedi `erroreDiRiga`).
  const daCreare = [...new Set(righe.flatMap((r) => (r.slug !== null && !perSlug.has(r.slug) ? [r.slug] : [])))]
  const creati: GiocoNoto[] = []
  onAvanzamento?.(0, daCreare.length)
  for (const [i, slug] of daCreare.entries()) {
    try {
      const gioco = await crea(slug)
      creati.push(gioco)
      perSlug.set(slug, gioco)
    } catch (e) {
      if (!erroreDiRiga(e)) throw e
      for (const r of righe) if (r.slug === slug) errori.push({ riga: r.riga, motivo: messaggio(e) })
    }
    onAvanzamento?.(i + 1, daCreare.length)
  }
  if (errori.length > 0) return { righe: [], errori: errori.sort((a, b) => a.riga! - b.riga!), creati }

  // 3. Ogni riga con il suo gioco, nell'ordine del file.
  const risolte = righe.map((r) => {
    const gioco = r.videogame_id !== null ? perId.get(r.videogame_id)! : perSlug.get(r.slug!)!
    return {
      riga: r.riga,
      videogame_id: gioco.id,
      videogame_titolo: gioco.titolo || gioco.rawg_slug,
      istante: r.istante,
      tipologia: r.tipologia,
      speaker: r.speaker,
    }
  })
  return { righe: risolte, errori: [], creati }
}
