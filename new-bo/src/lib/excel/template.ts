import {
  FOGLIO_ELENCHI,
  FOGLIO_MINUTAGGI,
  INTESTAZIONI,
  RIGHE_DA_COMPILARE,
  SPEAKERS,
  TIPOLOGIE,
  voceVideogame,
} from './colonne'
import { type Cella, type Foglio, scriviXlsx, STILE } from './scrittore'

// Template dei minutaggi (/bo/template): un .xlsx con due fogli.
// - «minutaggi»: le colonne da compilare, con i menu a tendina su VIDEOGAME, TIPOLOGIA e SPEAKER
//   e la colonna ISTANTE in formato testo;
// - «elenchi», nascosto: le voci dei menu. I nomi definiti VIDEOGAMES, TIPOLOGIE e SPEAKERS
//   puntano alle sue colonne A, B e C.

export type Videogame = { id: number; titolo: string }

// Una riga già compilata: serve a generare i file di prova dei test (Fase 3).
// Un istante numerico è una frazione di giorno (12:30:00 = 12.5 / 24) e si scrive come un
// orario vero, cioè come lo lascerebbe Excel se convertisse da solo il testo «12:30».
export type RigaCompilata = {
  videogame?: string
  slug?: string
  istante?: string | number
  tipologia?: string
  speaker?: string
}

export const NOME_FILE = 'minutaggi-joypad.xlsx'
export const TIPO_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const testo = (v: string | undefined, s?: number): Cella | null => (v ? { t: 'testo', v, s } : null)

// Cella da compilare: sempre in formato testo (@), anche vuota. Così Excel non trasforma quello
// che si scrive o si sceglie dal menu: «12:30» in un orario, una voce come «7-1942» in una data.
const daCompilare = (v: string | undefined): Cella =>
  v ? { t: 'testo', v, s: STILE.testo } : { t: 'vuota', s: STILE.testo }

// Un istante numerico invece resta un numero, con il formato orario.
const cellaIstante = (istante: string | number | undefined): Cella =>
  typeof istante === 'number' ? { t: 'numero', v: istante, s: STILE.durata } : daCompilare(istante)

// I videogame finiscono nel menu nell'ordine ricevuto: /api/template/videogame li dà già
// ordinati per titolo, senza distinguere le maiuscole.
export function creaTemplate(videogame: readonly Videogame[], righe: readonly RigaCompilata[] = []): Uint8Array {
  const quante = Math.max(RIGHE_DA_COMPILARE, righe.length)
  const ultima = quante + 1 // numero dell'ultima riga di «minutaggi» con i menu

  const minutaggi: Foglio = {
    nome: FOGLIO_MINUTAGGI,
    bloccaIntestazione: true,
    // tutte le colonne in formato testo, anche oltre l'ultima riga con i menu
    colonne: [48, 24, 26, 28, 30].map((larghezza, col) => ({ col, larghezza, stile: STILE.testo })),
    righe: [
      INTESTAZIONI.map((h) => testo(h, STILE.intestazione)),
      ...Array.from({ length: quante }, (_, i) => {
        const r = righe[i] ?? {}
        return [
          daCompilare(r.videogame),
          daCompilare(r.slug),
          cellaIstante(r.istante),
          daCompilare(r.tipologia),
          daCompilare(r.speaker),
        ]
      }),
    ],
    convalide: [
      { intervallo: `A2:A${ultima}`, elenco: 'VIDEOGAMES' },
      { intervallo: `D2:D${ultima}`, elenco: 'TIPOLOGIE' },
      { intervallo: `E2:E${ultima}`, elenco: 'SPEAKERS' },
    ],
  }

  // «elenchi»: riga 1 con le intestazioni, poi una voce per riga in ciascuna colonna.
  const colonneElenchi = [videogame.map(voceVideogame), TIPOLOGIE, SPEAKERS]
  const lunghezza = Math.max(...colonneElenchi.map((c) => c.length))
  const elenchi: Foglio = {
    nome: FOGLIO_ELENCHI,
    nascosto: true,
    colonne: [
      { col: 0, larghezza: 48 },
      { col: 1, larghezza: 28 },
      { col: 2, larghezza: 30 },
    ],
    righe: [
      ['VIDEOGAMES', 'TIPOLOGIE', 'SPEAKERS'].map((h) => testo(h, STILE.intestazione)),
      ...Array.from({ length: lunghezza }, (_, i) => colonneElenchi.map((c) => testo(c[i]))),
    ],
  }

  // Ogni nome copre dalla riga 2 all'ultima voce. Con l'elenco vuoto copre comunque la sola
  // riga 2, vuota: «$A$2:$A$1» comprenderebbe l'intestazione.
  const intervallo = (col: string, voci: number) => `${FOGLIO_ELENCHI}!$${col}$2:$${col}$${Math.max(voci, 1) + 1}`
  return scriviXlsx(
    [minutaggi, elenchi],
    [
      { nome: 'VIDEOGAMES', riferimento: intervallo('A', videogame.length) },
      { nome: 'TIPOLOGIE', riferimento: intervallo('B', TIPOLOGIE.length) },
      { nome: 'SPEAKERS', riferimento: intervallo('C', SPEAKERS.length) },
    ],
  )
}
