import type { Speaker, Tipologia } from '@/gql/graphql'
import { FOGLIO_MINUTAGGI, FORME_SPEAKER, FORME_TIPOLOGIA, NOMI_COLONNE, normalizza } from './colonne'

// Lettura e controllo di un template dei minutaggi compilato (import nel form dell'episodio).
// Due passi, entrambi senza rete e senza DB:
// 1. leggiFoglio: dal file .xlsx alle celle grezze del foglio «minutaggi»;
// 2. validaRighe: dalle celle alle righe da importare, oppure all'elenco degli errori.
// La ricerca dei videogame nel DB e la creazione da RAWG vengono dopo (risolvi.ts, Fase 4).

// Una cella come la restituisce read-excel-file: testo, numero, vero/falso, data o vuota.
export type CellaGrezza = string | number | boolean | Date | null

// Una riga pronta per il form. `riga` è il numero di riga nel foglio, quello che si vede in Excel.
// Esattamente uno fra `videogame_id` e `slug` è valorizzato: lo slug si usa solo senza videogame.
export type RigaLetta = {
  riga: number
  videogame_id: number | null
  slug: string | null
  istante: string // H:MM:SS
  tipologia: Tipologia
  speaker: Speaker
}

// Un errore. `riga` è null per gli errori che riguardano tutto il file o il form.
export type ErroreRiga = { riga: number | null; motivo: string }

export type EsitoValidazione = { righe: RigaLetta[]; errori: ErroreRiga[] }

export const ERRORE_NON_TEMPLATE =
  'il file non è un template dei minutaggi: la riga 1 deve avere le colonne VIDEOGAME, RAWG SLUG, ISTANTE, TIPOLOGIA e SPEAKER'
export const ERRORE_FILE_VUOTO = 'il file non contiene nessuna riga compilata'
export const ERRORE_DURATA = "compila prima la durata dell'episodio"
export const ERRORE_FILE_ILLEGGIBILE = 'il file non è un .xlsx leggibile'

// --- 1. Lettura del file -------------------------------------------------------------------------

// Legge il foglio «minutaggi» o, se non c'è, il primo. Un file che non è un .xlsx diventa un
// errore con un messaggio comprensibile, invece dell'eccezione della libreria.
//
// Limite noto: read-excel-file legge una cella con un errore di formula (#N/A, #VALUE!) come
// vuota. Il template non ha formule; chi ne usa deve incollare i valori (docs/ui.md).
export async function leggiFoglio(dati: ArrayBuffer): Promise<CellaGrezza[][]> {
  // caricata qui, e non in cima al file, così nel /bo entra solo quando si importa davvero
  const { default: leggiFogli } = await import('read-excel-file/universal')
  let fogli: { sheet: string; data: CellaGrezza[][] }[]
  try {
    fogli = await leggiFogli(dati)
  } catch (e) {
    console.warn('import Excel: file rifiutato da read-excel-file', e) // la causa, per chi indaga
    throw new Error(ERRORE_FILE_ILLEGGIBILE, { cause: e })
  }
  return (fogli.find((f) => f.sheet === FOGLIO_MINUTAGGI) ?? fogli[0])?.data ?? []
}

// --- 2. Controllo delle righe --------------------------------------------------------------------

// Secondi in H:MM:SS, il formato dei campi istante e durata del form.
export function formattaDurata(secondi: number): string {
  const h = Math.floor(secondi / 3600)
  const m = Math.floor((secondi % 3600) / 60)
  const s = secondi % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// «H:MM:SS» o «MM:SS» in secondi, con le stesse regole del server (src/admin/input.ml): ore fino
// a 4 cifre, minuti e secondi fino a 2 cifre e minori di 60. null se il testo non si legge.
//
// Nel file il separatore può essere anche il punto, come lo scrivono alcuni programmi: «10.11» =
// 10:11 (decisione P2). Il separatore dev'essere lo stesso in tutto l'istante e, con il punto,
// minuti e secondi hanno sempre due cifre: «12.5» o «1:02.5» sembrano decimali, non orari, e
// sono errori. La durata del form accetta solo i due punti.
export function leggiDurata(testo: string, separatori: ':' | ':.' = ':'): number | null {
  const m = /^(?:(\d{1,4})([:.]))?(\d{1,2})([:.])(\d{1,2})$/.exec(testo.trim())
  if (!m) return null
  const [, h, sep1, mm, sep, ss] = m
  if (sep1 !== undefined && sep1 !== sep) return null
  if (sep === '.' && (separatori === ':' || mm.length !== 2 || ss.length !== 2)) return null
  const [ore, minuti, secondi] = [Number(h ?? 0), Number(mm), Number(ss)]
  if (minuti > 59 || secondi > 59) return null
  return ore * 3600 + minuti * 60 + secondi
}

// Un orario «vero» di Excel arriva come Date, contata da 1899-12-30 in UTC (esito della Fase 0),
// oppure come numero, cioè frazione di giorno (12:30:00 = 0,5208). Tutti e due diventano secondi.
const BASE_DATE_EXCEL = Date.UTC(1899, 11, 30)

// Una data «vera» (dal 1901 in poi) non è un orario: il programma ha preso il testo per una data.
const eDataVera = (d: Date) => d.getUTCFullYear() >= 1901
const dataBreve = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
const COME_TESTO = 'imposta la colonna come testo e riscrivi il valore'

type Istante = { secondi: number; convertito: boolean } | { motivo: string }

// Istante di una cella in secondi, e se veniva da un orario convertito dal programma.
function leggiIstante(c: CellaGrezza): Istante {
  const nonValido = { motivo: `istante non valido: «${testo(c)}» (si scrive H:MM:SS o MM:SS)` }
  if (c === null) return { secondi: 0, convertito: false } // vuoto: 0:00:00, come nel form
  if (typeof c === 'string') {
    const s = leggiDurata(pulisci(c), ':.')
    return s === null ? nonValido : { secondi: s, convertito: false }
  }
  if (c instanceof Date) {
    if (eDataVera(c)) return { motivo: `ISTANTE: il programma l'ha trasformato nella data ${dataBreve(c)}: ${COME_TESTO}` }
    const s = Math.round((c.getTime() - BASE_DATE_EXCEL) / 1000)
    return s >= 0 ? { secondi: s, convertito: true } : nonValido
  }
  if (typeof c === 'number') {
    // un giorno o più non è un orario di una puntata: è un numero (per esempio «12,30» letto come 12,3)
    if (c >= 1) return { motivo: `ISTANTE: «${c}» è un numero, non un orario: ${COME_TESTO}` }
    return c >= 0 ? { secondi: Math.round(c * 86400), convertito: true } : nonValido
  }
  return nonValido
}

// Toglie gli spazi in testa e in coda e i caratteri invisibili che arrivano dai copia-incolla
// (spazio a larghezza zero, BOM…), che altrimenti renderebbero diverse due parole uguali.
const pulisci = (s: string) => s.replace(/[​-‍⁠﻿]/g, '').trim()

// Testo di una cella, per i messaggi e le colonne di testo; null se è vuota.
function testo(c: CellaGrezza): string | null {
  if (c === null) return null
  const s = pulisci(c instanceof Date ? dataBreve(c) : String(c))
  return s === '' ? null : s
}

// VIDEOGAME: «id-titolo». L'id è la parte prima del primo «-», un intero positivo che sta in
// un Int di GraphQL (al massimo 2147483647).
const ID_MASSIMO = 2 ** 31 - 1
function leggiVideogame(c: CellaGrezza): number | null {
  const id = typeof c === 'number' ? String(c) : typeof c === 'string' ? pulisci(c).split('-')[0].trim() : ''
  if (!/^\d{1,10}$/.test(id)) return null
  const n = Number(id)
  return n > 0 && n <= ID_MASSIMO ? n : null
}

// RAWG SLUG: in minuscolo, poi la regola di src/admin/rawg.ml (valid_slug).
const slugValido = (s: string) => s.length <= 256 && /^[a-z0-9_-]+$/.test(s)

// Contano solo le colonne A-E: una nota a margine in F non rende compilata una riga vuota.
const RIGA_VUOTA = (r: CellaGrezza[]) => r.slice(0, NOMI_COLONNE.length).every((c) => testo(c) === null)

export function validaRighe(grezze: CellaGrezza[][], { durataEpisodio }: { durataEpisodio: string }): EsitoValidazione {
  const unico = (motivo: string): EsitoValidazione => ({ righe: [], errori: [{ riga: null, motivo }] })

  // Riga 1: le intestazioni attese, nell'ordine.
  const intestazioni = grezze[0] ?? []
  const template = NOMI_COLONNE.every((nome, i) => normalizza(testo(intestazioni[i]) ?? '').startsWith(normalizza(nome)))
  if (!template) return unico(ERRORE_NON_TEMPLATE)

  // Le righe del tutto vuote si ignorano, anche in mezzo; il numero di riga resta quello del foglio.
  const compilate = grezze
    .map((celle, i) => ({ riga: i + 1, celle }))
    .slice(1)
    .filter((r) => !RIGA_VUOTA(r.celle))
  if (compilate.length === 0) return unico(ERRORE_FILE_VUOTO)

  // P4: il riferimento per gli istanti è la durata scritta nel form in questo momento.
  const durata = leggiDurata(durataEpisodio)
  if (durata === null) return unico(ERRORE_DURATA)

  const righe: RigaLetta[] = []
  const errori: ErroreRiga[] = []
  for (const { riga, celle } of compilate) {
    const [cVideogame = null, cSlug = null, cIstante = null, cTipologia = null, cSpeaker = null] = celle
    const erroriRiga: string[] = []

    // Una data in una colonna di testo: il programma ha trasformato quello che c'era scritto
    const trasformata = (c: CellaGrezza, colonna: string) => {
      if (!(c instanceof Date)) return false
      erroriRiga.push(`${colonna}: il programma ha trasformato il valore nella data ${dataBreve(c)}: ${COME_TESTO}`)
      return true
    }

    // VIDEOGAME vince sullo slug, che allora si ignora (criterio I6)
    let videogame_id: number | null = null
    let slug: string | null = null
    if (testo(cVideogame) !== null) {
      if (!trasformata(cVideogame, 'VIDEOGAME')) {
        videogame_id = leggiVideogame(cVideogame)
        if (videogame_id === null) erroriRiga.push(`videogame non riconoscibile: «${testo(cVideogame)}»`)
      }
    } else if (testo(cSlug) !== null) {
      if (!trasformata(cSlug, 'RAWG SLUG')) {
        slug = testo(cSlug)!.toLowerCase()
        if (!slugValido(slug))
          erroriRiga.push(`RAWG slug non valido: «${testo(cSlug)}» (solo lettere, cifre, «-» e «_»)`)
      }
    } else {
      erroriRiga.push('manca il videogame (o il suo RAWG slug)')
    }

    const istante = leggiIstante(cIstante)
    if ('motivo' in istante) {
      erroriRiga.push(istante.motivo)
    } else if (istante.secondi > durata) {
      // P1 e P4: un MM:SS convertito dal programma diventa ore e supera quasi sempre la durata
      const suggerimento = istante.convertito ? ': forse MM:SS letto come ore?' : ': correggi la durata o il file'
      erroriRiga.push(
        `istante ${formattaDurata(istante.secondi)} oltre la durata nel form (${formattaDurata(durata)})${suggerimento}`,
      )
    }

    // TIPOLOGIA e SPEAKER: vuoti valgono «Chiacchiera libera» e «Tutti»
    const voce = <C extends string>(c: CellaGrezza, colonna: string, forme: ReadonlyMap<string, C>, vuota: C) => {
      if (testo(c) === null) return vuota
      if (trasformata(c, colonna)) return undefined
      const v = forme.get(normalizza(testo(c)!))
      if (v === undefined) erroriRiga.push(`${colonna.toLowerCase()} non riconosciut${colonna === 'SPEAKER' ? 'o' : 'a'}: «${testo(c)}»`)
      return v
    }
    const tipologia = voce(cTipologia, 'TIPOLOGIA', FORME_TIPOLOGIA, 'FREE')
    const speaker = voce(cSpeaker, 'SPEAKER', FORME_SPEAKER, 'TUTT')

    if (erroriRiga.length > 0 || 'motivo' in istante || tipologia === undefined || speaker === undefined) {
      errori.push(...erroriRiga.map((motivo) => ({ riga, motivo })))
      continue
    }
    righe.push({ riga, videogame_id, slug, istante: formattaDurata(istante.secondi), tipologia, speaker })
  }

  // Tutto o niente: con un solo errore non si importa nessuna riga
  return errori.length > 0 ? { righe: [], errori } : { righe, errori }
}
