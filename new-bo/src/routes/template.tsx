import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { GlifoChiudi, GlifoPlay, NuvolaGrande, NuvolaMedia, NuvolaPiccola, Prato } from '@/components/pixel-art'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Template Excel dei minutaggi (docs/ui.md, «Template dei minutaggi»). Pagina pubblica: è sorella
// di login.tsx, quindi fuori dal guard di _app.tsx, e non chiama /api/graphql. Il file si genera
// nel browser al clic, non all'apertura: con lo StrictMode di main.tsx partirebbe due volte.

export const Route = createFileRoute('/template')({
  component: PaginaTemplate,
})

// Due errori diversi: l'elenco che non arriva (si riprova) e il generatore che non si carica o
// non funziona, per esempio una pagina aperta prima di un aggiornamento del sito (si ricarica).
const ERRORE_ELENCO = "Non riesco a scaricare l'elenco dei videogame. Riprova tra poco."
const ERRORE_FILE = 'Non riesco a preparare il file. Ricarica la pagina e riprova.'

class ErroreElenco extends Error {}

// I canali ufficiali per contattare lo staff.
const ISSUE_GITHUB = 'https://github.com/pdonadeo/e-uscito-joypad/issues'
const DISCORD = 'https://discord.gg/abQEbvuBrt'
const LINK =
  'font-extrabold text-viola underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola'

type Videogame = { id: number; titolo: string }

async function elencoVideogame(): Promise<Videogame[]> {
  try {
    const risposta = await fetch('/api/template/videogame', { cache: 'no-store' })
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status}`)
    const corpo = (await risposta.json()) as { status: string; result?: Videogame[] }
    if (corpo.status !== 'ok' || !Array.isArray(corpo.result)) throw new Error('risposta inattesa')
    return corpo.result
  } catch (e) {
    throw new ErroreElenco(String(e))
  }
}

async function scaricaTemplate() {
  const videogame = await elencoVideogame()
  // fflate e il generatore si caricano solo qui, in un pezzo di bundle a parte
  const { creaTemplate, NOME_FILE, TIPO_MIME } = await import('@/lib/excel/template')
  const dati = creaTemplate(videogame)
  const url = URL.createObjectURL(new Blob([dati.slice()], { type: TIPO_MIME }))
  const link = document.createElement('a')
  link.href = url
  link.download = NOME_FILE
  document.body.append(link)
  link.click()
  link.remove()
  // l'indirizzo temporaneo si libera dopo 40 s: alcuni browser (Safari, Firefox vecchi) leggono
  // il file solo qualche istante dopo il clic
  setTimeout(() => URL.revokeObjectURL(url), 40_000)
}

function Paesaggio() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <NuvolaGrande className="absolute top-36 -left-40 w-150 lg:top-130 lg:left-[6%] lg:w-192" />
      <NuvolaMedia className="absolute top-18 -right-24 w-144 lg:top-96 lg:right-auto lg:left-[80%]" />
      <NuvolaPiccola className="absolute top-300 left-[84%] hidden opacity-80 lg:block" />
      <Prato />
    </div>
  )
}

function PaginaTemplate() {
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function alClic() {
    if (inCorso) return
    setInCorso(true)
    setErrore(null)
    try {
      await scaricaTemplate()
    } catch (e) {
      setErrore(e instanceof ErroreElenco ? ERRORE_ELENCO : ERRORE_FILE)
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className="relative flex min-h-dvh justify-center bg-linear-to-b from-cielo to-rosa px-16 pt-80 pb-160 lg:items-center lg:pt-40">
      <Paesaggio />

      {/* Dialog `retro` del login: cornice inchiostro > bianco > crema */}
      <main className="relative h-fit w-full max-w-640 bg-inchiostro p-8 shadow-pixel-3xl shadow-inchiostro/30">
        <div className="bg-bianco p-6">
          <div className="flex flex-col bg-crema px-10 pt-27 pb-36 lg:px-24 lg:pt-31 lg:pb-32">
            <h1 className="text-center font-titolo text-7xl font-bold text-inchiostro max-[390px]:text-[length:clamp(22px,calc((100vw_-_80px)/7.2),32px)]">
              MINUTAGGI
            </h1>
            <p className="mt-8 text-center font-testo text-base text-inchiostro-600 lg:mt-10">di «È uscito Joypad?»</p>

            <p className="mt-24 text-lg leading-ariosa text-inchiostro lg:mt-28">
              Aiutaci a segnare in quale punto di un episodio si parla di ogni videogame.
            </p>

            <ol className="mt-16 flex list-decimal flex-col gap-10 pl-24 text-base leading-ariosa text-inchiostro">
              <li>Scarica il template e aprilo con Excel, LibreOffice Calc o Google Sheets.</li>
              <li>
                Una riga per ogni videogame: sceglilo dal menu di VIDEOGAME. Se non c&apos;è, scrivi in RAWG SLUG la
                parte finale del suo indirizzo su rawg.io (per esempio <span className="font-ui">hades-2</span>).
              </li>
              <li>
                In ISTANTE scrivi quando se ne comincia a parlare: <span className="font-ui">1:02:03</span> oppure{' '}
                <span className="font-ui">12:30</span>.
              </li>
              <li>
                TIPOLOGIA e SPEAKER si scelgono dal menu. Se li lasci vuoti valgono «Chiacchiera libera» e «Tutti».
              </li>
              <li>
                Salva il file in formato .xlsx e mandalo allo staff: allegalo a una{' '}
                <a href={ISSUE_GITHUB} target="_blank" rel="noreferrer" className={LINK}>
                  issue su GitHub
                </a>{' '}
                oppure scrivici sul{' '}
                <a href={DISCORD} target="_blank" rel="noreferrer" className={LINK}>
                  server Discord
                </a>
                .
              </li>
            </ol>

            {errore !== null && (
              <Alert icona={<GlifoChiudi misura="piccolo" />} className="mt-20 lg:mt-22">
                {errore}
              </Alert>
            )}

            <Button
              type="button"
              variant="retro"
              size="xl"
              aria-busy={inCorso}
              onClick={() => void alClic()}
              className="mt-24 gap-17 aria-busy:cursor-wait lg:mt-28"
            >
              <GlifoPlay misura="grande" /> {inCorso ? 'Attendi…' : 'Scarica il template'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
