import { strToU8, zipSync } from 'fflate'

// Scrittore .xlsx minimo: modelli XML di SpreadsheetML compressi in zip con fflate.
//
// Un .xlsx è uno zip di file XML. Qui si scrive solo quello che serve al template dei minutaggi
// e che le librerie pronte non fanno (piano dell'import Excel, «Opzioni per la SCRITTURA»):
// - fogli nascosti (state="hidden");
// - nomi definiti, cioè intervalli con un nome, usati dai menu a tendina;
// - convalide «elenco», che rifiutano i valori fuori menu;
// - celle in formato testo (@), così Excel non trasforma «12:30» in un orario.
// Il formato l'hanno verificato a mano in Excel, LibreOffice Calc e Google Sheets (Fase 0).
//
// Struttura del file prodotto:
//   [Content_Types].xml          tipo di ogni parte
//   _rels/.rels                  punta a xl/workbook.xml
//   xl/workbook.xml              elenco dei fogli e nomi definiti
//   xl/_rels/workbook.xml.rels   dove stanno fogli, stili e stringhe
//   xl/styles.xml                gli stili di STILE qui sotto
//   xl/sharedStrings.xml         tutte le stringhe, scritte una volta sola
//   xl/worksheets/sheetN.xml     un file per foglio

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships'
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

// Stili delle celle: il numero è la posizione in <cellXfs> di styles.xml.
export const STILE = {
  normale: 0,
  intestazione: 1, // grassetto
  testo: 2, // formato @: quello che si scrive resta testo
  durata: 3, // formato [h]:mm:ss: un numero letto come frazione di giorno
} as const

export type Cella =
  | { t: 'testo'; v: string; s?: number }
  | { t: 'numero'; v: number; s?: number }
  | { t: 'vuota'; s: number } // senza valore, ma con uno stile (per esempio il formato testo)

export type Foglio = {
  nome: string
  nascosto?: boolean
  // larghezza delle colonne (0 = A), con uno stile facoltativo per l'intera colonna
  colonne?: { col: number; larghezza: number; stile?: number }[]
  // righe[0] è la riga 1. null è una cella assente: le celle dopo restano nella loro colonna.
  righe: (Cella | null)[][]
  bloccaIntestazione?: boolean // la riga 1 resta ferma scorrendo
  convalide?: { intervallo: string; elenco: string }[] // menu a tendina: intervallo «A2:A501», elenco = nome definito
}

export type NomeDefinito = { nome: string; riferimento: string } // per esempio «elenchi!$A$2:$A$10»

// Escape per testo e attributi XML. Toglie anche i caratteri di controllo, che XML 1.0 vieta
// (tranne tabulazione e a capo): un titolo che ne contiene uno renderebbe il file illeggibile.
const esc = (s: string) =>
  s
    // oxlint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

// Nome della colonna: 0 → A, 25 → Z, 26 → AA.
export function colonna(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function scriviXlsx(fogli: Foglio[], nomi: NomeDefinito[]): Uint8Array {
  // Tabella delle stringhe condivise, come la scrive Excel: ogni testo una volta sola.
  const stringhe: string[] = []
  const posizione = new Map<string, number>()
  let riferimenti = 0 // celle che usano una stringa: è il «count» di sharedStrings.xml
  const stringa = (v: string) => {
    riferimenti++
    let i = posizione.get(v)
    if (i === undefined) {
      i = stringhe.length
      stringhe.push(v)
      posizione.set(v, i)
    }
    return i
  }

  const xmlCella = (c: Cella, rif: string) => {
    const s = c.s ? ` s="${c.s}"` : ''
    if (c.t === 'vuota') return `<c r="${rif}"${s}/>`
    if (c.t === 'numero') {
      // NaN o Infinity darebbero <v>NaN</v>, che rende il file illeggibile: meglio fermarsi subito
      if (!Number.isFinite(c.v)) throw new Error(`cella ${rif}: numero non valido (${c.v})`)
      return `<c r="${rif}"${s}><v>${c.v}</v></c>`
    }
    return `<c r="${rif}"${s} t="s"><v>${stringa(c.v)}</v></c>`
  }

  const xmlFoglio = (f: Foglio) => {
    const vista = f.bloccaIntestazione
      ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      : ''
    const colonne = (f.colonne ?? [])
      .map((c) => {
        const stile = c.stile !== undefined ? ` style="${c.stile}"` : ''
        return `<col min="${c.col + 1}" max="${c.col + 1}" width="${c.larghezza}" customWidth="1"${stile}/>`
      })
      .join('')
    const righe = f.righe
      .map((riga, r) => {
        const celle = riga.map((c, ci) => (c === null ? '' : xmlCella(c, `${colonna(ci)}${r + 1}`))).join('')
        return `<row r="${r + 1}">${celle}</row>`
      })
      .join('')
    // type="list" + showErrorMessage="1" senza errorStyle (cioè «stop»): il valore fuori elenco
    // viene rifiutato. allowBlank="1": la cella si può lasciare vuota.
    const convalide = f.convalide?.length
      ? `<dataValidations count="${f.convalide.length}">` +
        f.convalide
          .map(
            (v) =>
              `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${v.intervallo}">` +
              `<formula1>${esc(v.elenco)}</formula1></dataValidation>`,
          )
          .join('') +
        '</dataValidations>'
      : ''
    return (
      `${XML}<worksheet xmlns="${NS}" xmlns:r="${NS_REL}">` +
      `<sheetViews><sheetView workbookViewId="0">${vista}</sheetView></sheetViews>` +
      '<sheetFormatPr defaultRowHeight="15"/>' +
      (colonne ? `<cols>${colonne}</cols>` : '') +
      `<sheetData>${righe}</sheetData>${convalide}</worksheet>`
    )
  }

  // I fogli si scrivono prima di sharedStrings.xml, perché sono loro a riempire la tabella.
  const xmlFogli = fogli.map(xmlFoglio)

  const workbook =
    `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_REL}">` +
    // la finestra a cui rimanda workbookViewId="0" di ogni foglio
    '<bookViews><workbookView/></bookViews><sheets>' +
    fogli
      .map((f, i) => {
        const nascosto = f.nascosto ? ' state="hidden"' : ''
        return `<sheet name="${esc(f.nome)}" sheetId="${i + 1}"${nascosto} r:id="rId${i + 1}"/>`
      })
      .join('') +
    '</sheets><definedNames>' +
    nomi.map((n) => `<definedName name="${esc(n.nome)}">${esc(n.riferimento)}</definedName>`).join('') +
    '</definedNames></workbook>'

  const relazioniWorkbook =
    `${XML}<Relationships xmlns="${NS_PKG}">` +
    fogli
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    `<Relationship Id="rId${fogli.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/>` +
    `<Relationship Id="rId${fogli.length + 2}" Type="${NS_REL}/sharedStrings" Target="sharedStrings.xml"/>` +
    '</Relationships>'

  // Gli <xf> di <cellXfs> sono, nell'ordine, gli stili di STILE. numFmtId 49 è il formato
  // testo «@», predefinito; 164 è il primo numero libero per un formato nostro.
  const stili =
    `${XML}<styleSheet xmlns="${NS}">` +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="[h]:mm:ss"/></numFmts>' +
    '<fonts count="2">' +
    '<font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
    '</fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
    '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>'

  const stringheCondivise =
    `${XML}<sst xmlns="${NS}" count="${riferimenti}" uniqueCount="${stringhe.length}">` +
    stringhe.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('') +
    '</sst>'

  const tipo = (t: string) => `application/vnd.openxmlformats-officedocument.spreadsheetml.${t}+xml`
  const tipiDiContenuto =
    `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    `<Override PartName="/xl/workbook.xml" ContentType="${tipo('sheet.main')}"/>` +
    fogli
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="${tipo('worksheet')}"/>`)
      .join('') +
    `<Override PartName="/xl/styles.xml" ContentType="${tipo('styles')}"/>` +
    `<Override PartName="/xl/sharedStrings.xml" ContentType="${tipo('sharedStrings')}"/>` +
    '</Types>'

  const relazioniRadice =
    `${XML}<Relationships xmlns="${NS_PKG}">` +
    `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
    '</Relationships>'

  const parti: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(tipiDiContenuto),
    '_rels/.rels': strToU8(relazioniRadice),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(relazioniWorkbook),
    'xl/styles.xml': strToU8(stili),
    'xl/sharedStrings.xml': strToU8(stringheCondivise),
  }
  xmlFogli.forEach((x, i) => (parti[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(x)))
  return zipSync(parti, { level: 6 })
}
