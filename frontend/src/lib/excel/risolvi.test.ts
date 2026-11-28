import { describe, expect, test } from 'bun:test'
import type { RigaLetta } from './importa'
import { type GiocoNoto, risolviGiochi } from './risolvi'

// Test della risoluzione dei videogame dell'import (criterio I6), con elenco e RAWG finti.
// Si lanciano con `bun run --cwd frontend test`.

test('il fuso è Europe/Rome (lo imposta lo script «test» di package.json)', () => {
  expect(process.env.TZ).toBe('Europe/Rome')
})

const ELENCO: GiocoNoto[] = [
  { id: 1, titolo: 'Doom', rawg_slug: 'doom' },
  { id: 2, titolo: null, rawg_slug: 'senza-titolo' },
  { id: 3, titolo: 'Hades II', rawg_slug: 'Hades-2' }, // uno slug salvato con le maiuscole
]

const riga = (n: number, da: { id?: number; slug?: string }): RigaLetta => ({
  riga: n,
  videogame_id: da.id ?? null,
  slug: da.slug ?? null,
  istante: `0:0${n}:00`,
  tipologia: 'FREE',
  speaker: 'TUTT',
})

// RAWG finto: registra le chiamate; gli slug che iniziano con «missing» non esistono, quelli
// che iniziano con «giu» trovano RAWG irraggiungibile.
class ErroreSlug extends Error {}
function rawgFinto() {
  const chiamate: string[] = []
  let prossimo = 100
  const crea = async (slug: string): Promise<GiocoNoto> => {
    chiamate.push(slug)
    if (slug.startsWith('missing')) throw new ErroreSlug(`Gioco «${slug}» non trovato su RAWG`)
    if (slug.startsWith('giu')) throw new Error('RAWG non ha risposto in tempo')
    return { id: prossimo++, titolo: `Titolo di ${slug}`, rawg_slug: slug }
  }
  return { chiamate, crea, erroreDiRiga: (e: unknown) => e instanceof ErroreSlug }
}

describe('risolviGiochi', () => {
  test('id e slug già nel DB: nessuna chiamata a RAWG, titolo del DB, ordine del file', async () => {
    const rawg = rawgFinto()
    const esito = await risolviGiochi([riga(2, { id: 3 }), riga(3, { slug: 'doom' }), riga(4, { id: 2 })], {
      elenco: ELENCO,
      crea: rawg.crea,
      erroreDiRiga: rawg.erroreDiRiga,
    })
    expect(rawg.chiamate).toEqual([])
    expect(esito).toEqual({
      righe: [
        { riga: 2, videogame_id: 3, videogame_titolo: 'Hades II', istante: '0:02:00', tipologia: 'FREE', speaker: 'TUTT' },
        { riga: 3, videogame_id: 1, videogame_titolo: 'Doom', istante: '0:03:00', tipologia: 'FREE', speaker: 'TUTT' },
        // senza titolo si mostra lo slug, come nel resto del /bo
        { riga: 4, videogame_id: 2, videogame_titolo: 'senza-titolo', istante: '0:04:00', tipologia: 'FREE', speaker: 'TUTT' },
      ],
      errori: [],
      creati: [],
    })
  })

  test('uno slug del DB salvato con le maiuscole si trova lo stesso', async () => {
    const rawg = rawgFinto()
    const esito = await risolviGiochi([riga(2, { slug: 'hades-2' })], { elenco: ELENCO, crea: rawg.crea, erroreDiRiga: rawg.erroreDiRiga })
    expect(rawg.chiamate).toEqual([])
    expect(esito.righe[0].videogame_id).toBe(3)
  })

  test('uno slug nuovo su due righe si crea una volta sola, e l\'avanzamento lo conta', async () => {
    const rawg = rawgFinto()
    const avanzamento: string[] = []
    const esito = await risolviGiochi(
      [riga(2, { slug: 'celeste' }), riga(3, { id: 1 }), riga(4, { slug: 'celeste' }), riga(5, { slug: 'tunic' })],
      { elenco: ELENCO, ...rawg, onAvanzamento: (f, t) => avanzamento.push(`${f}/${t}`) },
    )
    expect(rawg.chiamate).toEqual(['celeste', 'tunic'])
    expect(avanzamento).toEqual(['0/2', '1/2', '2/2'])
    expect(esito.errori).toEqual([])
    expect(esito.creati.map((g) => g.rawg_slug)).toEqual(['celeste', 'tunic'])
    expect(esito.righe.map((r) => [r.riga, r.videogame_id, r.videogame_titolo])).toEqual([
      [2, 100, 'Titolo di celeste'],
      [3, 1, 'Doom'],
      [4, 100, 'Titolo di celeste'],
      [5, 101, 'Titolo di tunic'],
    ])
  })

  test('un id che non esiste: errore di riga e nessuna chiamata a RAWG', async () => {
    const rawg = rawgFinto()
    const esito = await risolviGiochi([riga(2, { slug: 'celeste' }), riga(3, { id: 999 })], {
      elenco: ELENCO,
      crea: rawg.crea,
      erroreDiRiga: rawg.erroreDiRiga,
    })
    expect(rawg.chiamate).toEqual([])
    expect(esito).toEqual({
      righe: [],
      errori: [{ riga: 3, motivo: "videogame non trovato: nel DB non c'è l'id 999" }],
      creati: [],
    })
  })

  test('RAWG non conosce uno slug: errore su tutte le sue righe, gli altri si creano e restano', async () => {
    const rawg = rawgFinto()
    const esito = await risolviGiochi(
      [riga(2, { slug: 'missing-1' }), riga(3, { slug: 'celeste' }), riga(4, { slug: 'missing-1' })],
      { elenco: ELENCO, crea: rawg.crea, erroreDiRiga: rawg.erroreDiRiga },
    )
    expect(rawg.chiamate).toEqual(['missing-1', 'celeste'])
    expect(esito.righe).toEqual([])
    expect(esito.errori).toEqual([
      { riga: 2, motivo: 'Gioco «missing-1» non trovato su RAWG' },
      { riga: 4, motivo: 'Gioco «missing-1» non trovato su RAWG' },
    ])
    expect(esito.creati.map((g) => g.rawg_slug)).toEqual(['celeste'])
  })

  test('l\'avanzamento conta anche gli slug falliti', async () => {
    const rawg = rawgFinto()
    const avanzamento: string[] = []
    await risolviGiochi([riga(2, { slug: 'missing-1' }), riga(3, { slug: 'celeste' })], {
      elenco: ELENCO,
      ...rawg,
      onAvanzamento: (f, t) => avanzamento.push(`${f}/${t}`),
    })
    expect(avanzamento).toEqual(['0/2', '1/2', '2/2'])
  })

  test('un errore che non riguarda lo slug (RAWG giù, sessione scaduta) ferma tutto e si rilancia', async () => {
    const rawg = rawgFinto()
    const esito = risolviGiochi([riga(2, { slug: 'giu-1' }), riga(3, { slug: 'celeste' })], { elenco: ELENCO, ...rawg })
    await expect(esito).rejects.toThrow('RAWG non ha risposto in tempo')
    expect(rawg.chiamate).toEqual(['giu-1']) // gli slug seguenti non si provano
  })
})
