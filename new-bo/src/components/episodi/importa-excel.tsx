import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogOcchiello,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { chiudiErrori, mostraSuccesso } from '@/components/ui/sonner'
import type { ErroreRiga, RigaLetta } from '@/lib/excel/importa'
import { type RigaRisolta, risolviGiochi } from '@/lib/excel/risolvi'
import { eErroreApi } from '@/lib/graphql'
import { creaVideogame, elencoCompletoVideogame } from '@/lib/videogame'
import { cn } from '@/lib/utils'

// «IMPORTA DA EXCEL» nel form dell'episodio (docs/ui.md, «Import dei minutaggi da Excel»): legge
// un template dei minutaggi compilato (/bo/template) e sostituisce le righe di «Videogiochi
// citati», senza salvare. L'ordine è quello della decisione D4 del piano:
// 1. lettura e controllo di tutto il file, senza rete (importa.ts);
// 2. se il form ha già delle righe, la conferma, prima di qualsiasi chiamata al DB o a RAWG;
// 3. ricerca dei giochi nel DB e creazione da RAWG degli slug nuovi (risolvi.ts);
// 4. le righe nel form e il riepilogo.
// Tutto o niente: con un errore, in qualunque passo, il form resta com'era. Durante il passo 3
// un Dialog di avanzamento copre il form, così nessuno lo modifica mentre arrivano le righe.
// Le librerie Excel si caricano solo al primo import, in un pezzo di bundle a parte.

// «file»: l'errore è nel file o nella durata del form, e va corretto lì. «altro»: rete, server,
// RAWG che non risponde, pagina da ricaricare; il file non c'entra.
type Causa = 'file' | 'altro'

type Stato =
  | { fase: 'riposo' }
  | { fase: 'lettura' }
  | { fase: 'conferma'; righe: RigaLetta[]; presenti: number }
  | { fase: 'risoluzione'; provati: number; totale: number }
  | { fase: 'errori'; errori: ErroreRiga[]; creati: number; causa: Causa }

const ERRORE_CARICAMENTO = "non riesco a caricare l'import: ricarica la pagina e riprova"

const plurale = (n: number, uno: string, molti: string) => (n === 1 ? `1 ${uno}` : `${n} ${molti}`)
const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const messaggio = (e: unknown) => (e instanceof Error ? e.message : String(e))
const unico = (motivo: string, causa: Causa): Stato => ({ fase: 'errori', errori: [{ riga: null, motivo }], creati: 0, causa })

export function ImportaExcel({
  durata,
  presenti,
  onImporta,
  className,
}: {
  durata: () => string // la durata scritta ora nel form: il riferimento per gli istanti (P4)
  presenti: () => number // le righe ora nel form
  onImporta: (righe: RigaRisolta[]) => void
  className?: string
}) {
  const queryClient = useQueryClient()
  const input = React.useRef<HTMLInputElement>(null)
  const [stato, setStato] = React.useState<Stato>({ fase: 'riposo' })
  // Se si lascia la pagina mentre RAWG lavora, alla fine non si tocca più niente: né il form né
  // il Toast. I giochi già creati restano nel DB, come dopo un errore.
  const montato = React.useRef(true)
  React.useEffect(() => {
    montato.current = true
    return () => {
      montato.current = false
    }
  }, [])
  const aggiorna = (s: Stato) => montato.current && setStato(s)

  // Passo 3 come mutation: un 401 riporta al login come nel resto del /bo (main.tsx).
  const risolvi = useMutation({
    mutationFn: async (righe: RigaLetta[]) =>
      risolviGiochi(righe, {
        elenco: await elencoCompletoVideogame(),
        crea: (slug) => creaVideogame({ rawg_slug: slug }),
        // sulla riga solo gli errori dello slug («Gioco … non trovato su RAWG»); gli altri fermano tutto
        erroreDiRiga: (e) => eErroreApi(e, 'BAD_USER_INPUT'),
        onAvanzamento: (provati, totale) => aggiorna({ fase: 'risoluzione', provati, totale }),
      }),
  })

  async function passoRisoluzione(righe: RigaLetta[]) {
    aggiorna({ fase: 'risoluzione', provati: 0, totale: 0 })
    try {
      const esito = await risolvi.mutateAsync(righe)
      const creati = esito.creati.length
      if (creati > 0) await queryClient.invalidateQueries({ queryKey: ['videogame'] })
      if (!montato.current) return
      if (esito.errori.length > 0) {
        setStato({ fase: 'errori', errori: esito.errori, creati, causa: 'file' })
        return
      }
      onImporta(esito.righe)
      setStato({ fase: 'riposo' })
      const daRawg = creati > 0 ? `, ${plurale(creati, 'videogame creato', 'videogame creati')} da RAWG` : ''
      mostraSuccesso(`${plurale(esito.righe.length, 'riga importata', 'righe importate')}${daRawg}: ricordati di salvare`)
    } catch (e) {
      // sessione scaduta: main.tsx porta già al login, un Dialog sarebbe solo un lampo
      if (eErroreApi(e, 'UNAUTHENTICATED')) aggiorna({ fase: 'riposo' })
      else aggiorna(unico(messaggio(e), 'altro'))
    }
  }

  async function scelto(file: File) {
    chiudiErrori()
    setStato({ fase: 'lettura' })
    let modulo: typeof import('@/lib/excel/importa')
    try {
      modulo = await import('@/lib/excel/importa')
    } catch {
      aggiorna(unico(ERRORE_CARICAMENTO, 'altro')) // per esempio una pagina aperta prima di un aggiornamento
      return
    }
    let esito
    try {
      esito = modulo.validaRighe(await modulo.leggiFoglio(await file.arrayBuffer()), { durataEpisodio: durata() })
    } catch (e) {
      aggiorna(unico(messaggio(e), 'file'))
      return
    }
    if (esito.errori.length > 0) {
      aggiorna({ fase: 'errori', errori: esito.errori, creati: 0, causa: 'file' })
      return
    }
    const n = presenti()
    if (n > 0) aggiorna({ fase: 'conferma', righe: esito.righe, presenti: n })
    else await passoRisoluzione(esito.righe)
  }

  const occupato = stato.fase === 'lettura' || stato.fase === 'risoluzione'

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        data-testid="file-excel"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = '' // così lo stesso file si può scegliere di nuovo
          if (file) void scelto(file)
        }}
      />
      <Button
        type="button"
        variant="dashed"
        aria-busy={occupato}
        aria-disabled={occupato}
        className={cn('aria-busy:cursor-wait', className)}
        onClick={() => !occupato && input.current?.click()}
      >
        {occupato ? 'Attendi…' : 'Importa da Excel'}
      </Button>

      {stato.fase === 'conferma' && (
        <ConfermaSostituzione
          presenti={stato.presenti}
          dalFile={stato.righe.length}
          onAnnulla={() => setStato({ fase: 'riposo' })}
          onConferma={() => void passoRisoluzione(stato.righe)}
        />
      )}
      {stato.fase === 'risoluzione' && <Avanzamento provati={stato.provati} totale={stato.totale} />}
      {stato.fase === 'errori' && (
        <ErroriImport
          errori={stato.errori}
          creati={stato.creati}
          causa={stato.causa}
          onChiudi={() => setStato({ fase: 'riposo' })}
        />
      )}
    </>
  )
}

// Conferma prima di sostituire le righe presenti (criterio I2).
function ConfermaSostituzione({
  presenti,
  dalFile,
  onAnnulla,
  onConferma,
}: {
  presenti: number
  dalFile: number
  onAnnulla: () => void
  onConferma: () => void
}) {
  const quali = presenti === 1 ? "l'associazione presente" : `le ${presenti} associazioni presenti`
  const conCosa = dalFile === 1 ? 'con quella del file' : `con le ${dalFile} del file`
  return (
    <AlertDialog open onOpenChange={(aperto) => !aperto && onAnnulla()}>
      <AlertDialogContent>
        <AlertDialogOcchiello>Import da Excel</AlertDialogOcchiello>
        <AlertDialogTitle>{`Sostituire ${quali} ${conCosa}?`}</AlertDialogTitle>
        <AlertDialogDescription>
          Le righe di «Videogiochi citati» lasciano il posto a quelle del file. L&apos;episodio non si salva finché
          non premi SALVA.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              // il Dialog non si chiude da solo (sarebbe un «annulla»): sparisce quando l'import va avanti
              e.preventDefault()
              onConferma()
            }}
          >
            Sostituisci
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Avanzamento del passo 3: copre il form finché i giochi non sono tutti trovati o creati. Non ha
// azioni e non si chiude con ESC: una richiesta a RAWG può durare fino a 15 secondi.
function Avanzamento({ provati, totale }: { provati: number; totale: number }) {
  return (
    <AlertDialog open>
      <AlertDialogContent onEscapeKeyDown={(e) => e.preventDefault()} aria-busy>
        <AlertDialogOcchiello>Import da Excel</AlertDialogOcchiello>
        <AlertDialogTitle>Attendi…</AlertDialogTitle>
        <AlertDialogDescription aria-live="polite">
          {totale > 0
            ? `Creo i videogame nuovi da RAWG: ${provati} di ${totale}.`
            : 'Cerco i videogame del file nel DB.'}
        </AlertDialogDescription>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// Elenco degli errori, con il numero di riga del foglio (criterio I7). Il form non è cambiato.
function ErroriImport({
  errori,
  creati,
  causa,
  onChiudi,
}: {
  errori: ErroreRiga[]
  creati: number
  causa: Causa
  onChiudi: () => void
}) {
  const titolo =
    causa === 'altro'
      ? 'Qualcosa è andato storto'
      : errori.length === 1 && errori[0].riga === null
        ? 'Il file non si può importare'
        : `${plurale(errori.length, 'errore', 'errori')} nel file`
  return (
    <AlertDialog open onOpenChange={(aperto) => !aperto && onChiudi()}>
      <AlertDialogContent>
        <AlertDialogOcchiello>Import non riuscito</AlertDialogOcchiello>
        <AlertDialogTitle>{titolo}</AlertDialogTitle>
        {/* la descrizione del Dialog comprende l'elenco: chi usa uno screen reader sente anche gli errori */}
        <AlertDialogDescription asChild>
          <div className="flex flex-col gap-14">
            <p>
              {causa === 'altro'
                ? 'Il form non è cambiato.'
                : 'Il form non è cambiato: correggi il file e riprova.'}
              {creati > 0 &&
                ` ${creati === 1 ? 'Il videogame creato' : `I ${creati} videogame creati`} da RAWG nel frattempo ${creati === 1 ? 'resta' : 'restano'} nel DB.`}
            </p>
            <ul
              aria-label="Errori"
              className="flex max-h-240 flex-col gap-6 overflow-y-auto border-2 border-inchiostro bg-bianco p-12 text-sm leading-testo wrap-anywhere"
            >
              {errori.map((e, i) => (
                <li key={i}>
                  {e.riga === null ? (
                    maiuscola(e.motivo)
                  ) : (
                    <>
                      <span className="font-extrabold">Riga {e.riga}:</span> {e.motivo}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter className="grid-cols-1">
          <AlertDialogCancel>Chiudi</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
