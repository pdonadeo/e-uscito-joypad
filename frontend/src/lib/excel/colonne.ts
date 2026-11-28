import type { Speaker, Tipologia } from '@/gql/graphql'
import { SPEAKER, TIPOLOGIA } from '../etichette'

// Forma del template dei minutaggi (/bo/template): fogli, colonne ed elenchi dei menu a tendina.
// La scrittura (template.ts) e, dalla Fase 3, la lettura (importa.ts) partono da qui.

export const FOGLIO_MINUTAGGI = 'minutaggi'
export const FOGLIO_ELENCHI = 'elenchi' // nascosto: contiene le voci dei menu

// Intestazioni della riga 1 di «minutaggi», nell'ordine delle colonne A…E.
export const INTESTAZIONI = ['VIDEOGAME', 'RAWG SLUG', 'ISTANTE (H:MM:SS o MM:SS)', 'TIPOLOGIA', 'SPEAKER'] as const

// In lettura un'intestazione va bene se inizia con il nome della colonna, senza distinguere le
// maiuscole: «ISTANTE» da solo, come nei fogli fatti a mano, vale quanto «ISTANTE (H:MM:SS o MM:SS)».
export const NOMI_COLONNE = ['VIDEOGAME', 'RAWG SLUG', 'ISTANTE', 'TIPOLOGIA', 'SPEAKER'] as const

// Righe con i menu a tendina e la colonna ISTANTE in formato testo: dalla 2 alla 501.
export const RIGHE_DA_COMPILARE = 500

// Voci dei menu TIPOLOGIA e SPEAKER: le etichette del /bo, nello stesso ordine.
export const TIPOLOGIE: readonly string[] = TIPOLOGIA.map((t) => t.etichetta)
export const SPEAKERS: readonly string[] = SPEAKER.map((s) => s.etichetta)

// Voce del menu VIDEOGAME: «id-titolo». Chi legge il file prende l'id prima del primo «-».
export const voceVideogame = (v: { id: number; titolo: string }) => `${v.id}-${v.titolo}`

// --- Lettura: le forme accettate per TIPOLOGIA e SPEAKER (decisione P7) -------------------------

// Testo confrontabile: senza caratteri invisibili (spazio a larghezza zero, BOM…) né spazi in
// testa e in coda, spazi interni ridotti a uno, minuscolo.
export const normalizza = (s: string) =>
  s
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()

// Oltre alle etichette del /bo, il template accetta i codici (FREE, TUTT…) e le forme corte che
// si scrivono a mano. Un template vecchio resta leggibile anche se un'etichetta cambia, come
// «Osservatorio Start Citizen», il refuso corretto nel 2026.
function forme<C extends string>(voci: readonly { valore: C; etichetta: string }[], altre: Record<string, C>) {
  const mappa = new Map<string, C>()
  for (const v of voci) {
    mappa.set(normalizza(v.etichetta), v.valore)
    mappa.set(normalizza(v.valore), v.valore)
  }
  for (const [forma, valore] of Object.entries(altre)) mappa.set(normalizza(forma), valore)
  return mappa
}

export const FORME_TIPOLOGIA: ReadonlyMap<string, Tipologia> = forme(TIPOLOGIA, {
  Chiacchiera: 'FREE',
  'Osservatorio Start Citizen': 'STAR',
})

export const FORME_SPEAKER: ReadonlyMap<string, Speaker> = forme(SPEAKER, {
  Bordone: 'BORD',
  Fossetti: 'FOSS',
  Zampini: 'ZAMP',
})
