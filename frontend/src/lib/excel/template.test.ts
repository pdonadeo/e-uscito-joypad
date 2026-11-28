import { describe, expect, test } from 'bun:test'
import { strFromU8, unzipSync } from 'fflate'
import { RIGHE_DA_COMPILARE, SPEAKERS, TIPOLOGIE } from './colonne'
import { colonna } from './scrittore'
import { creaTemplate } from './template'

// Test del template dei minutaggi (criteri T2-T5 della spec, convalide della Fase 0).
// Si lanciano con `bun run --cwd frontend test`, che imposta TZ=Europe/Rome.

test('il fuso è Europe/Rome (lo imposta lo script «test» di package.json)', () => {
  expect(process.env.TZ).toBe('Europe/Rome')
})

// --- Lettura dello zip prodotto ----------------------------------------------------------------

type CellaLetta = { stile: number; valore: string | null }

function apri(file: Uint8Array) {
  const parti = unzipSync(file)
  const xml = (nome: string) => {
    const p = parti[nome]
    if (!p) throw new Error(`parte assente: ${nome}`)
    return strFromU8(p)
  }
  const condivise = [...xml('xl/sharedStrings.xml').matchAll(/<si><t xml:space="preserve">(.*?)<\/t><\/si>/g)].map(
    (m) => m[1],
  )
  // celle di un foglio: riferimento → stile e valore (il testo delle stringhe condivise, ancora con l'escape XML)
  // Celle di un foglio: riferimento → stile e valore (il testo delle stringhe condivise, ancora
  // con l'escape XML). Se una cella è scritta in una forma che la regex non riconosce, il test
  // si ferma: altrimenti un «cella assente» passerebbe per caso.
  const celle = (n: number) => {
    const foglio = xml(`xl/worksheets/sheet${n}.xml`)
    const mappa = new Map<string, CellaLetta>()
    const re = /<c r="([A-Z]+\d+)"(?: s="(\d+)")?( t="s")?(?:\/>|><v>(.*?)<\/v><\/c>)/g
    for (const m of foglio.matchAll(re)) {
      const [, rif, s, condivisa, v] = m
      mappa.set(rif, { stile: Number(s ?? 0), valore: v === undefined ? null : condivisa ? condivise[Number(v)] : v })
    }
    const scritte = foglio.match(/<c /g)?.length ?? 0
    if (scritte !== mappa.size) throw new Error(`sheet${n}: ${scritte} celle scritte, ${mappa.size} riconosciute`)
    return mappa
  }
  return { nomi: Object.keys(parti), xml, celle }
}

const GIOCHI = [
  { id: 874, titolo: '1666: Amsterdam' },
  { id: 12, titolo: 'Pokémon Rosso & Blu <edizione "speciale">' },
  { id: 496, titolo: "Don't Starve" },
]

// --- Struttura ---------------------------------------------------------------------------------

describe('struttura del file', () => {
  const f = apri(creaTemplate(GIOCHI))

  test('contiene tutte le parti di un .xlsx, con due fogli', () => {
    expect(f.nomi.sort()).toEqual(
      [
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/_rels/workbook.xml.rels',
        'xl/sharedStrings.xml',
        'xl/styles.xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ].sort(),
    )
  })

  test('ogni relazione punta a una parte che c\'è, e ogni parte xl/ ha il suo tipo di contenuto', () => {
    const relazioni = [...f.xml('xl/_rels/workbook.xml.rels').matchAll(/Id="(rId\d+)" Type="[^"]+" Target="([^"]+)"/g)]
    const idFogli = [...f.xml('xl/workbook.xml').matchAll(/r:id="(rId\d+)"/g)].map((m) => m[1])
    expect(relazioni.map((m) => `xl/${m[2]}`).sort()).toEqual(f.nomi.filter((n) => /^xl\/[^_]/.test(n) && n !== 'xl/workbook.xml').sort())
    for (const id of idFogli) expect(relazioni.find((m) => m[1] === id)?.[2]).toMatch(/^worksheets\/sheet\d\.xml$/)
    expect(f.xml('_rels/.rels')).toContain('Target="xl/workbook.xml"')
    const tipi = [...f.xml('[Content_Types].xml').matchAll(/PartName="\/([^"]+)"/g)].map((m) => m[1])
    expect(tipi.sort()).toEqual(f.nomi.filter((n) => n.startsWith('xl/') && !n.includes('_rels')).sort())
    // la finestra a cui rimandano i fogli (workbookViewId="0") esiste
    expect(f.xml('xl/workbook.xml')).toContain('<bookViews><workbookView/></bookViews>')
  })

  test('T2: «minutaggi» è il primo foglio, «elenchi» è nascosto', () => {
    const wb = f.xml('xl/workbook.xml')
    expect(wb).toContain('<sheet name="minutaggi" sheetId="1" r:id="rId1"/>')
    expect(wb).toContain('<sheet name="elenchi" sheetId="2" state="hidden" r:id="rId2"/>')
  })

  test('T2: intestazioni della riga 1, in grassetto, e riga 1 bloccata', () => {
    const c = f.celle(1)
    expect(['A1', 'B1', 'C1', 'D1', 'E1'].map((r) => c.get(r)?.valore)).toEqual([
      'VIDEOGAME',
      'RAWG SLUG',
      'ISTANTE (H:MM:SS o MM:SS)',
      'TIPOLOGIA',
      'SPEAKER',
    ])
    expect(c.get('A1')?.stile).toBe(1)
    expect(f.xml('xl/worksheets/sheet1.xml')).toContain('state="frozen"')
  })

  test('T3: i nomi definiti coprono esattamente le voci', () => {
    const wb = f.xml('xl/workbook.xml')
    expect(wb).toContain('<definedName name="VIDEOGAMES">elenchi!$A$2:$A$4</definedName>')
    expect(wb).toContain(`<definedName name="TIPOLOGIE">elenchi!$B$2:$B$${TIPOLOGIE.length + 1}</definedName>`)
    expect(wb).toContain(`<definedName name="SPEAKERS">elenchi!$C$2:$C$${SPEAKERS.length + 1}</definedName>`)
  })

  test('T3: con 1000 giochi VIDEOGAMES arriva alla riga 1001', () => {
    const mille = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, titolo: `Gioco ${i + 1}` }))
    const wb = apri(creaTemplate(mille)).xml('xl/workbook.xml')
    expect(wb).toContain('<definedName name="VIDEOGAMES">elenchi!$A$2:$A$1001</definedName>')
  })

  test('senza giochi VIDEOGAMES copre la sola riga 2, vuota, e non l\'intestazione', () => {
    const v = apri(creaTemplate([]))
    expect(v.xml('xl/workbook.xml')).toContain('<definedName name="VIDEOGAMES">elenchi!$A$2:$A$2</definedName>')
    expect(v.celle(2).get('A2')).toBeUndefined()
  })

  test('T4: tre convalide «elenco» con rifiuto dei valori fuori menu (Fase 0)', () => {
    const foglio = f.xml('xl/worksheets/sheet1.xml')
    const convalide = [...foglio.matchAll(/<dataValidation ([^>]*)><formula1>(.*?)<\/formula1><\/dataValidation>/g)]
    expect(foglio).toContain('<dataValidations count="3">')
    expect(convalide.map((m) => [m[1], m[2]])).toEqual([
      ['type="list" allowBlank="1" showErrorMessage="1" sqref="A2:A501"', 'VIDEOGAMES'],
      ['type="list" allowBlank="1" showErrorMessage="1" sqref="D2:D501"', 'TIPOLOGIE'],
      ['type="list" allowBlank="1" showErrorMessage="1" sqref="E2:E501"', 'SPEAKERS'],
    ])
    // niente errorStyle: il default è «stop», cioè il valore viene rifiutato
    expect(foglio).not.toContain('errorStyle')
  })

  test('T5: tutte le colonne sono in formato testo (@), come colonne e cella per cella da 2 a 501', () => {
    expect(f.xml('xl/styles.xml')).toMatch(
      /<cellXfs count="4"><xf [^>]*\/><xf [^>]*\/><xf numFmtId="49" [^>]*applyNumberFormat="1"\/>/,
    )
    const foglio = f.xml('xl/worksheets/sheet1.xml')
    for (let i = 1; i <= 5; i++) expect(foglio).toMatch(new RegExp(`<col min="${i}" max="${i}" [^>]*style="2"/>`))
    const c = f.celle(1)
    for (let r = 2; r <= RIGHE_DA_COMPILARE + 1; r++)
      for (const col of 'ABCDE') expect(c.get(`${col}${r}`)).toEqual({ stile: 2, valore: null })
    expect(c.size).toBe(5 * (RIGHE_DA_COMPILARE + 1)) // intestazioni + 500 righe, niente oltre
  })
})

// --- Voci dei menu -----------------------------------------------------------------------------

describe('foglio «elenchi»', () => {
  const c = apri(creaTemplate(GIOCHI)).celle(2)
  const colonnaDa = (lettera: string, quante: number) =>
    Array.from({ length: quante }, (_, i) => c.get(`${lettera}${i + 2}`)?.valore)

  test('T3: i videogame come «id-titolo», nell\'ordine ricevuto dal server, con l\'escape XML', () => {
    expect(c.get('A1')?.valore).toBe('VIDEOGAMES')
    expect(colonnaDa('A', 3)).toEqual([
      '874-1666: Amsterdam',
      '12-Pokémon Rosso &amp; Blu &lt;edizione &quot;speciale&quot;&gt;',
      "496-Don't Starve",
    ])
    expect(c.get('A5')).toBeUndefined()
  })

  test('tipologie e speaker sono le etichette del /bo', () => {
    expect(colonnaDa('B', 4)).toEqual([
      'Chiacchiera libera',
      'Recensione',
      'Consiglio',
      'Osservatorio Star Citizen',
    ])
    expect(colonnaDa('C', 4)).toEqual([
      'Tutti',
      'Matteo Bordone (corri!)',
      'Francesco Fossetti (salta!)',
      'Alessandro Zampini (spara!)',
    ])
  })

  test('un carattere di controllo nel titolo sparisce: XML 1.0 non lo ammette', () => {
    const v = apri(creaTemplate([{ id: 7, titolo: 'Doom\u0007 Eternal\u001f' }])).celle(2)
    expect(v.get('A2')?.valore).toBe('7-Doom Eternal')
  })
})

// --- Righe compilate (per le fixture dei test dell'import) ---------------------------------------

describe('righe compilate', () => {
  const c = apri(
    creaTemplate(GIOCHI, [
      { videogame: '874-1666: Amsterdam', istante: '12:30', tipologia: 'Recensione', speaker: 'Tutti' },
      { slug: 'hades-2', istante: 12.5 / 24 },
      {},
      { speaker: 'Alessandro Zampini (spara!)' },
    ]),
  ).celle(1)

  const vuota = { stile: 2, valore: null }
  const scritta = (valore: string) => ({ stile: 2, valore })

  test('ogni valore resta nella sua colonna anche con celle vuote prima (errore trovato in Fase 0)', () => {
    expect(c.get('A2')).toEqual(scritta('874-1666: Amsterdam'))
    expect(c.get('D2')).toEqual(scritta('Recensione'))
    expect(c.get('E2')).toEqual(scritta('Tutti'))
    expect(c.get('A3')).toEqual(vuota)
    expect(c.get('B3')).toEqual(scritta('hades-2'))
    expect(c.get('E5')).toEqual(scritta('Alessandro Zampini (spara!)'))
    for (const r of ['A5', 'B5', 'C5', 'D5']) expect(c.get(r)).toEqual(vuota)
  })

  test('un istante di testo resta testo, un numero diventa un orario vero [h]:mm:ss', () => {
    expect(c.get('C2')).toEqual({ stile: 2, valore: '12:30' })
    expect(c.get('C3')).toEqual({ stile: 3, valore: String(12.5 / 24) })
    expect(c.get('C4')).toEqual(vuota)
  })

  test('un istante NaN o infinito ferma la generazione invece di produrre un file illeggibile', () => {
    expect(() => creaTemplate(GIOCHI, [{ istante: Number.NaN }])).toThrow('cella C2: numero non valido (NaN)')
    expect(() => creaTemplate(GIOCHI, [{}, { istante: Infinity }])).toThrow('cella C3')
  })
})

test('sharedStrings: count conta le celle, uniqueCount le stringhe diverse', () => {
  const sst = apri(creaTemplate(GIOCHI, [{ tipologia: 'Recensione' }])).xml('xl/sharedStrings.xml')
  // celle di testo: 5 intestazioni e «Recensione» in «minutaggi»; 3 intestazioni e le voci dei
  // menu in «elenchi». «Recensione» compare due volte (riga 2 e menu), quindi una stringa in meno.
  const intestazioniElenchi = 3
  const voci = GIOCHI.length + TIPOLOGIE.length + SPEAKERS.length
  const celle = 5 + 1 + intestazioniElenchi + voci
  expect(sst).toContain(`count="${celle}" uniqueCount="${celle - 1}"`)
})

test('colonna(): A, Z, AA, AZ, BA', () => {
  expect([0, 25, 26, 51, 52].map(colonna)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA'])
})
