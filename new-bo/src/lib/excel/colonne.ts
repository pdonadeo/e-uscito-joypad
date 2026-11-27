import { SPEAKER, TIPOLOGIA } from '../etichette'

// Forma del template dei minutaggi (/bo/template): fogli, colonne ed elenchi dei menu a tendina.
// La scrittura (template.ts) e, dalla Fase 3, la lettura (importa.ts) partono da qui.

export const FOGLIO_MINUTAGGI = 'minutaggi'
export const FOGLIO_ELENCHI = 'elenchi' // nascosto: contiene le voci dei menu

// Intestazioni della riga 1 di «minutaggi», nell'ordine delle colonne A…E.
export const INTESTAZIONI = ['VIDEOGAME', 'RAWG SLUG', 'ISTANTE (H:MM:SS o MM:SS)', 'TIPOLOGIA', 'SPEAKER'] as const

// Righe con i menu a tendina e la colonna ISTANTE in formato testo: dalla 2 alla 501.
export const RIGHE_DA_COMPILARE = 500

// Voci dei menu TIPOLOGIA e SPEAKER: le etichette del /bo, nello stesso ordine.
export const TIPOLOGIE: readonly string[] = TIPOLOGIA.map((t) => t.etichetta)
export const SPEAKERS: readonly string[] = SPEAKER.map((s) => s.etichetta)

// Voce del menu VIDEOGAME: «id-titolo». Chi legge il file prende l'id prima del primo «-».
export const voceVideogame = (v: { id: number; titolo: string }) => `${v.id}-${v.titolo}`
