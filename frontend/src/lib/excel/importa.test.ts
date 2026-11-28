import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type CellaGrezza,
  ERRORE_DURATA,
  ERRORE_FILE_ILLEGGIBILE,
  ERRORE_FILE_VUOTO,
  ERRORE_NON_TEMPLATE,
  formattaDurata,
  leggiDurata,
  leggiFoglio,
  validaRighe,
} from './importa'
import { scriviXlsx } from './scrittore'
import { creaTemplate } from './template'

// Test del parser dell'import (criteri I6-I9 della spec, decisioni P1, P2, P4, P6, P7).
// Si lanciano con `bun run --cwd new-bo test`, che imposta TZ=Europe/Rome: gli orari convertiti
// da Excel arrivano come Date del 1899, e il fuso di Roma di allora non deve spostarli.

test('il fuso è Europe/Rome (lo imposta lo script «test» di package.json)', () => {
  expect(process.env.TZ).toBe('Europe/Rome')
})

const INTESTAZIONI: CellaGrezza[] = ['VIDEOGAME', 'RAWG SLUG', 'ISTANTE (H:MM:SS o MM:SS)', 'TIPOLOGIA', 'SPEAKER']
const DURATA = { durataEpisodio: '1:30:00' }

// Esito di un foglio con le intestazioni giuste e queste righe (dalla riga 2).
const valida = (righe: CellaGrezza[][], opzioni = DURATA) => validaRighe([INTESTAZIONI, ...righe], opzioni)
// Istante letto da una riga altrimenti valida.
const istante = (c: CellaGrezza, opzioni = DURATA) => {
  const esito = valida([['1-Gioco', null, c, null, null]], opzioni)
  return esito.errori.length ? esito.errori.map((e) => e.motivo) : esito.righe[0].istante
}
// Data come la restituisce read-excel-file per un orario di Excel: giorni dal 1899-12-30, in UTC.
const orarioExcel = (ore: number, minuti: number, secondi: number) =>
  new Date(Date.UTC(1899, 11, 30, ore, minuti, secondi))

// --- Durate --------------------------------------------------------------------------------------

describe('istante (I9, P2)', () => {
  test.each([
    ['12:30', '0:12:30'],
    ['10.11', '0:10:11'],
    ['1.02.03', '1:02:03'],
    ['1:02:03', '1:02:03'],
    ['00:10:11', '0:10:11'], // come in un foglio di Google Sheets
    [' 5:07 ', '0:05:07'],
    ['1:00:00', '1:00:00'],
  ])('«%s» → %s', (testo, atteso) => {
    expect(istante(testo)).toBe(atteso)
  })

  test('vuoto → 0:00:00, come una riga nuova del form', () => {
    expect(istante(null)).toBe('0:00:00')
  })

  test('numero: frazione di giorno (0:12:34 = 754 / 86400)', () => {
    expect(istante(754 / 86400)).toBe('0:12:34')
  })

  test('Date del 1899 (orario convertito dal programma), con TZ=Europe/Rome', () => {
    expect(istante(orarioExcel(0, 42, 41))).toBe('0:42:41')
    expect(istante(orarioExcel(1, 2, 3))).toBe('1:02:03')
  })

  test.each([['1:75:00'], ['12:60'], ['12'], ['ieri'], ['1:2:3:4'], ['-0:10'], ['12.5'], ['1:02.03'], ['1.2.3'], ['10.1']])(
    '«%s» → errore',
    (testo) => {
      expect(istante(testo)).toEqual([`istante non valido: «${testo}» (si scrive H:MM:SS o MM:SS)`])
    },
  )

  test('caratteri invisibili da copia-incolla (spazio a larghezza zero, BOM) non contano', () => {
    expect(istante('\u200B12:30\uFEFF')).toBe('0:12:30')
  })

  test('una data vera (testo preso per una data) → errore che lo dice, non «MM:SS letto come ore»', () => {
    expect(istante(new Date(Date.UTC(2026, 10, 10)))).toEqual([
      "ISTANTE: il programma l'ha trasformato nella data 10/11/2026: imposta la colonna come testo e riscrivi il valore",
    ])
  })

  test('un numero da un giorno in su (per esempio «12,30» letto come 12,3) → errore che lo dice', () => {
    expect(istante(12.3)).toEqual([
      'ISTANTE: «12.3» è un numero, non un orario: imposta la colonna come testo e riscrivi il valore',
    ])
  })

  test('un orario convertito oltre le 24 ore (45:10 letto come ore) resta un errore P1', () => {
    expect(istante(orarioExcel(45, 10, 0))).toEqual([
      'istante 45:10:00 oltre la durata nel form (1:30:00): forse MM:SS letto come ore?',
    ])
  })

  test('un valore vero/falso o negativo → errore', () => {
    expect(istante(true)).toEqual(['istante non valido: «true» (si scrive H:MM:SS o MM:SS)'])
    expect(istante(-0.1)).toEqual(['istante non valido: «-0.1» (si scrive H:MM:SS o MM:SS)'])
  })

  test('leggiDurata: la durata del form accetta solo i due punti', () => {
    expect(leggiDurata('1:30:00')).toBe(5400)
    expect(leggiDurata('30:00')).toBe(1800)
    expect(leggiDurata('1.30.00')).toBeNull()
    expect(leggiDurata('1.30.00', ':.')).toBe(5400)
    expect(formattaDurata(5400)).toBe('1:30:00')
    expect(formattaDurata(45296)).toBe('12:34:56')
  })
})

describe('istante oltre la durata nel form (P1, P4)', () => {
  test('«12:30» convertito in 12 ore su un episodio di 1:30:00 → errore con il suggerimento', () => {
    expect(istante(orarioExcel(12, 30, 0))).toEqual([
      'istante 12:30:00 oltre la durata nel form (1:30:00): forse MM:SS letto come ore?',
    ])
    expect(istante(12.5 / 24)).toEqual([
      'istante 12:30:00 oltre la durata nel form (1:30:00): forse MM:SS letto come ore?',
    ])
  })

  test('un testo oltre la durata → errore che cita la durata del form', () => {
    expect(istante('0:45:10', { durataEpisodio: '0:30:00' })).toEqual([
      'istante 0:45:10 oltre la durata nel form (0:30:00): correggi la durata o il file',
    ])
  })

  test('un istante uguale alla durata va bene', () => {
    expect(istante('1:30:00')).toBe('1:30:00')
  })

  test.each([[''], ['  '], ['abc'], ['1.30.00'], ['1:61:00']])('durata «%s» → errore unico (P4)', (durata) => {
    expect(valida([['1-Gioco', null, '1:00', null, null]], { durataEpisodio: durata })).toEqual({
      righe: [],
      errori: [{ riga: null, motivo: ERRORE_DURATA }],
    })
  })
})

// --- Videogame e slug ----------------------------------------------------------------------------

describe('videogame e RAWG slug (I6, I7)', () => {
  const riga = (videogame: CellaGrezza, slug: CellaGrezza) => valida([[videogame, slug, '1:00', null, null]])

  test('VIDEOGAME: l\'id è la parte prima del primo «-»', () => {
    expect(riga('874-1666: Amsterdam', null).righe[0]).toMatchObject({ videogame_id: 874, slug: null })
    expect(riga('12-Spider-Man 2', null).righe[0]).toMatchObject({ videogame_id: 12 })
    expect(riga(' 42 - Titolo', null).righe[0]).toMatchObject({ videogame_id: 42 })
    expect(riga(42, null).righe[0]).toMatchObject({ videogame_id: 42 })
  })

  test('VIDEOGAME non riconoscibile → errore', () => {
    for (const v of ['Gioco senza id', '0-Zero', '-12-Meno', 'x12-Lettera']) {
      expect(riga(v, null).errori).toEqual([{ riga: 2, motivo: `videogame non riconoscibile: «${v}»` }])
    }
    // un id oltre il massimo di un Int di GraphQL
    expect(riga('3000000000-Troppo', null).errori[0].motivo).toBe('videogame non riconoscibile: «3000000000-Troppo»')
    expect(riga('99999999999999999999-x', null).errori).toHaveLength(1)
    expect(riga('2147483647-Ultimo', null).righe[0]).toMatchObject({ videogame_id: 2147483647 })
  })

  test('una voce trasformata dal programma in data → errore che lo dice', () => {
    expect(riga(new Date(Date.UTC(1942, 6, 1)), null).errori).toEqual([
      {
        riga: 2,
        motivo:
          'VIDEOGAME: il programma ha trasformato il valore nella data 01/07/1942: imposta la colonna come testo e riscrivi il valore',
      },
    ])
    expect(riga(null, new Date(Date.UTC(2026, 10, 10))).errori[0].motivo).toStartWith('RAWG SLUG: il programma ha trasformato')
  })

  test('VIDEOGAME e slug insieme: si usa il gioco e lo slug si ignora, anche se non valido', () => {
    expect(riga('7-Doom', 'slug con spazi').righe[0]).toMatchObject({ videogame_id: 7, slug: null })
  })

  test('slug senza VIDEOGAME: senza spazi in testa e in coda, in minuscolo', () => {
    expect(riga(null, '  Hades-2 ').righe[0]).toMatchObject({ videogame_id: null, slug: 'hades-2' })
    expect(riga('', 'grand_theft_auto_iii').righe[0]).toMatchObject({ slug: 'grand_theft_auto_iii' })
  })

  test('slug con caratteri non ammessi → errore', () => {
    expect(riga(null, 'slug con spazi').errori).toEqual([
      { riga: 2, motivo: 'RAWG slug non valido: «slug con spazi» (solo lettere, cifre, «-» e «_»)' },
    ])
    expect(riga(null, 'à-là').errori).toHaveLength(1)
  })

  test('una riga con altri dati ma senza videogame né slug → errore', () => {
    expect(valida([[null, null, '1:00', 'Recensione', null]]).errori).toEqual([
      { riga: 2, motivo: 'manca il videogame (o il suo RAWG slug)' },
    ])
  })
})

// --- Tipologia e speaker -------------------------------------------------------------------------

describe('tipologia e speaker (P7)', () => {
  const leggi = (tipologia: CellaGrezza, speaker: CellaGrezza) => valida([['1-Gioco', null, '1:00', tipologia, speaker]])

  test('vuoti → «Chiacchiera libera» e «Tutti»', () => {
    expect(leggi(null, '  ').righe[0]).toMatchObject({ tipologia: 'FREE', speaker: 'TUTT' })
  })

  test.each([
    ['Chiacchiera libera', 'FREE'],
    ['chiacchiera', 'FREE'],
    ['RECE', 'RECE'],
    ['  consiglio ', 'CONS'],
    ['Osservatorio Star Citizen', 'STAR'],
    ['Osservatorio  Start Citizen', 'STAR'],
  ])('tipologia «%s» → %s', (testo, codice) => {
    expect(leggi(testo, null).righe[0].tipologia).toBe(codice as never)
  })

  test('caratteri invisibili e spazi non separabili non contano', () => {
    expect(leggi('\u00A0Recensione\u200B', '\u200BTutti').righe[0]).toMatchObject({ tipologia: 'RECE', speaker: 'TUTT' })
  })

  test('una data al posto della tipologia → errore che lo dice', () => {
    expect(leggi(new Date(Date.UTC(2026, 0, 2)), null).errori[0].motivo).toStartWith(
      'TIPOLOGIA: il programma ha trasformato il valore nella data 02/01/2026',
    )
  })

  test.each([
    ['Tutti', 'TUTT'],
    ['tutt', 'TUTT'],
    ['Matteo Bordone (corri!)', 'BORD'],
    ['BORDONE', 'BORD'],
    ['Fossetti', 'FOSS'],
    ['zamp', 'ZAMP'],
    ['Zampini', 'ZAMP'],
  ])('speaker «%s» → %s', (testo, codice) => {
    expect(leggi(null, testo).righe[0].speaker).toBe(codice as never)
  })

  test('fuori elenco → un errore per ciascuno', () => {
    expect(leggi('Intervista', 'Pippo').errori).toEqual([
      { riga: 2, motivo: 'tipologia non riconosciuta: «Intervista»' },
      { riga: 2, motivo: 'speaker non riconosciuto: «Pippo»' },
    ])
  })
})

// --- Il file nel suo insieme ---------------------------------------------------------------------

describe('foglio', () => {
  test('intestazioni sbagliate → errore unico', () => {
    const atteso = { righe: [], errori: [{ riga: null, motivo: ERRORE_NON_TEMPLATE }] }
    expect(validaRighe([['TITOLO', 'SLUG', 'MINUTO'], ['1-Gioco', null, '1:00']], DURATA)).toEqual(atteso)
    expect(validaRighe([], DURATA)).toEqual(atteso)
    // le colonne nell'ordine sbagliato
    expect(validaRighe([['RAWG SLUG', 'VIDEOGAME', 'ISTANTE', 'TIPOLOGIA', 'SPEAKER']], DURATA)).toEqual(atteso)
  })

  test('intestazioni corte, come in un foglio fatto a mano, vanno bene', () => {
    const esito = validaRighe([['videogame', 'RAWG SLUG', 'Istante', 'TIPOLOGIA', 'SPEAKER'], ['1-Gioco', null, '1:00']], DURATA)
    expect(esito.errori).toEqual([])
  })

  test('solo le intestazioni, o solo righe vuote → errore unico (P6)', () => {
    const atteso = { righe: [], errori: [{ riga: null, motivo: ERRORE_FILE_VUOTO }] }
    expect(valida([])).toEqual(atteso)
    expect(valida([[null, null, null], ['', '  ', null, null, null]])).toEqual(atteso)
  })

  test('le righe vuote in mezzo si ignorano e il numero di riga resta quello del foglio (I8)', () => {
    const esito = valida([['1-A', null, '1:00'], [null, null, null, null, null], [], ['2-B', null, 'x']])
    expect(esito.errori).toEqual([{ riga: 5, motivo: 'istante non valido: «x» (si scrive H:MM:SS o MM:SS)' }])
  })

  test('tutto o niente: con un errore nessuna riga, con tutte valide le righe nell\'ordine del foglio', () => {
    expect(valida([['1-A', null, '1:00'], ['2-B', null, 'x']]).righe).toEqual([])
    expect(valida([['2-B', null, '2:00'], ['1-A', null, '1:00']]).righe).toEqual([
      { riga: 2, videogame_id: 2, slug: null, istante: '0:02:00', tipologia: 'FREE', speaker: 'TUTT' },
      { riga: 3, videogame_id: 1, slug: null, istante: '0:01:00', tipologia: 'FREE', speaker: 'TUTT' },
    ])
  })

  test('le colonne oltre la E si ignorano, anche in una riga altrimenti vuota', () => {
    expect(valida([['1-A', null, '1:00', null, null, 'nota a margine']]).errori).toEqual([])
    expect(valida([['1-A', null, '1:00'], [null, null, null, null, null, 'solo una nota']]).errori).toEqual([])
  })

  test('il messaggio delle intestazioni sbagliate dice quali servono', () => {
    expect(ERRORE_NON_TEMPLATE).toContain('VIDEOGAME, RAWG SLUG, ISTANTE, TIPOLOGIA e SPEAKER')
  })
})

// --- Lettura dei file .xlsx (fixture committate) -------------------------------------------------

const FIXTURE = join(import.meta.dir, '..', '..', '..', '..', 'tests', 'api', 'fixture', 'import-excel')
const buffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
const fixture = (nome: string) => buffer(readFileSync(join(FIXTURE, nome)))
const importa = async (nome: string, durataEpisodio = '1:30:00') =>
  validaRighe(await leggiFoglio(fixture(nome)), { durataEpisodio })

describe('fixture', () => {
  test('valido.xlsx: tre righe, con forme corte e il punto come separatore', async () => {
    expect(await importa('valido.xlsx')).toEqual({
      righe: [
        { riga: 2, videogame_id: 990001, slug: null, istante: '0:12:30', tipologia: 'RECE', speaker: 'BORD' },
        { riga: 3, videogame_id: 990002, slug: null, istante: '1:02:03', tipologia: 'FREE', speaker: 'ZAMP' },
        { riga: 4, videogame_id: 990003, slug: null, istante: '0:10:11', tipologia: 'FREE', speaker: 'TUTT' },
      ],
      errori: [],
    })
  })

  test('valido-slug.xlsx: lo slug ripetuto è normalizzato uguale su tutte e due le righe', async () => {
    const { righe, errori } = await importa('valido-slug.xlsx')
    expect(errori).toEqual([])
    expect(righe.map((r) => [r.riga, r.videogame_id, r.slug])).toEqual([
      [2, null, 'e2e-import-nuovo'],
      [3, 990001, null],
      [4, null, 'e2e-import-nuovo'],
    ])
  })

  test('slug-esistente, videogame-e-slug e slug-sconosciuto: validi in locale', async () => {
    expect((await importa('slug-esistente.xlsx')).righe).toMatchObject([{ slug: 'e2e-fixture-2' }])
    expect((await importa('videogame-e-slug.xlsx')).righe).toMatchObject([{ videogame_id: 990003, slug: null }])
    expect((await importa('slug-sconosciuto.xlsx')).righe).toMatchObject([
      { videogame_id: 990001 },
      { slug: 'e2e-missing-import' },
    ])
  })

  test('errori-misti.xlsx: ogni errore con il suo numero di riga, nessuna riga importata', async () => {
    expect(await importa('errori-misti.xlsx')).toEqual({
      righe: [],
      errori: [
        { riga: 3, motivo: 'videogame non riconoscibile: «Gioco senza id»' },
        { riga: 4, motivo: 'istante non valido: «1:75:00» (si scrive H:MM:SS o MM:SS)' },
        { riga: 5, motivo: 'tipologia non riconosciuta: «Intervista»' },
        { riga: 5, motivo: 'speaker non riconosciuto: «Pippo»' },
        { riga: 6, motivo: 'manca il videogame (o il suo RAWG slug)' },
        { riga: 7, motivo: 'RAWG slug non valido: «slug con spazi» (solo lettere, cifre, «-» e «_»)' },
      ],
    })
  })

  test('libreoffice.xlsx (valido-slug risalvato da LibreOffice, T7): le stesse righe dell\'originale', async () => {
    expect(await importa('libreoffice.xlsx')).toEqual(await importa('valido-slug.xlsx'))
  })

  test('riga-vuota-in-mezzo.xlsx: righe 2 e 4', async () => {
    expect((await importa('riga-vuota-in-mezzo.xlsx')).righe.map((r) => r.riga)).toEqual([2, 4])
  })

  test('istante-orario.xlsx: la cella numerica [h]:mm:ss arriva come Date e diventa 12 ore (P1)', async () => {
    const celle = await leggiFoglio(fixture('istante-orario.xlsx'))
    expect(celle[1][2]).toEqual(orarioExcel(12, 30, 0))
    expect((await importa('istante-orario.xlsx')).errori).toEqual([
      { riga: 2, motivo: 'istante 12:30:00 oltre la durata nel form (1:30:00): forse MM:SS letto come ore?' },
    ])
  })

  test('istante-lungo.xlsx: va bene con 1:30:00, non con la durata iniziale 0:30:00', async () => {
    expect((await importa('istante-lungo.xlsx')).righe).toMatchObject([{ istante: '0:45:00', tipologia: 'RECE' }])
    expect((await importa('istante-lungo.xlsx', '0:30:00')).errori).toEqual([
      { riga: 2, motivo: 'istante 0:45:00 oltre la durata nel form (0:30:00): correggi la durata o il file' },
    ])
  })

  test('il template vuoto, reimportato senza toccarlo → errore unico (P6)', async () => {
    const vuoto = buffer(creaTemplate([{ id: 1, titolo: 'Gioco' }]))
    expect(validaRighe(await leggiFoglio(vuoto), DURATA)).toEqual({
      righe: [],
      errori: [{ riga: null, motivo: ERRORE_FILE_VUOTO }],
    })
  })

  test('il foglio «minutaggi» si sceglie per nome, anche se non è il primo', async () => {
    const t = (v: string) => ({ t: 'testo' as const, v })
    const file = scriviXlsx(
      [
        { nome: 'altro', righe: [[t('niente da vedere')]] },
        { nome: 'minutaggi', righe: [INTESTAZIONI.map((v) => t(String(v))), [t('8-Gioco')]] },
      ],
      [],
    )
    expect(validaRighe(await leggiFoglio(buffer(file)), DURATA).righe).toMatchObject([{ riga: 2, videogame_id: 8 }])
  })

  test('senza il foglio «minutaggi» si legge il primo foglio', async () => {
    const file = scriviXlsx(
      [{ nome: 'Foglio1', righe: [INTESTAZIONI.map((v) => ({ t: 'testo' as const, v: String(v) })), [{ t: 'testo', v: '5-Gioco' }]] }],
      [],
    )
    expect(validaRighe(await leggiFoglio(buffer(file)), DURATA).righe).toMatchObject([{ riga: 2, videogame_id: 5 }])
  })

  test('un file che non è un .xlsx → errore leggibile', async () => {
    await expect(leggiFoglio(buffer(new TextEncoder().encode('non sono un foglio di calcolo')))).rejects.toThrow(
      ERRORE_FILE_ILLEGGIBILE,
    )
  })
})
