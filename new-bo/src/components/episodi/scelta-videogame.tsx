import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { GlifoFrecce, GlifoLente } from '@/components/pixel-art'
import { Button } from '@/components/ui/button'
import { Command, CommandBox, CommandEmpty, CommandFooter, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { sceltaVideogame } from '@/lib/episodi'
import { nomeVideogame } from '@/lib/videogame'
import { cn } from '@/lib/utils'

// Scelta del videogame di un'associazione (F-EP-09): Input `ricerca` · `sm` che apre il Combobox
// (docs/ui.md, «Combobox → command dentro popover»). La ricerca è `cercaVideogame` (3.6c.4b),
// fatta dal server sul solo titolo con le regole del sito pubblico: per titolo sotto i 6
// caratteri, per somiglianza dai 6 in su (trova anche i titoli scritti con un errore di battitura).
// Comportamento (proposta): il campo mostra il titolo scelto; scrivendo si apre l'elenco (anche con
// ↓); INVIO o un clic scelgono, ESC o l'uscita dal campo rimettono il titolo di prima.
// Finché i risultati non sono quelli del testo scritto (attesa della ricerca, o dati della
// ricerca precedente tenuti a schermo da keepPreviousData) l'elenco dice «Cerco «…»…», le voci
// sono attenuate e disattivate e nessuna è evidenziata: INVIO non sceglie nulla.
// «+ CREALO QUI» nel piede chiude l'elenco e chiama `onCrea`
// con il testo cercato: chi usa il componente apre il Dialog «Nuovo videogame».
// Da tastiera (proposta): con l'elenco aperto TAB dal campo porta a «+ CREALO QUI» del piede, ESC
// da lì chiude l'elenco e torna al campo; un altro TAB esce ed è come uscire dal campo.

export type VideogameScelto = { id: number; titolo: string }

export function SceltaVideogame({
  valore,
  onScegli,
  etichetta,
  apriSubito,
  invalido,
  onCrea,
  chiave,
}: {
  valore: VideogameScelto | null
  onScegli: (v: VideogameScelto) => void
  etichetta: string
  apriSubito?: boolean
  invalido?: boolean
  onCrea: (testoCercato: string) => void
  // chiave della riga, sul campo come data-chiave (per ridargli il focus da fuori)
  chiave?: string
}) {
  const [aperto, setAperto] = React.useState(false)
  const [testo, setTesto] = React.useState(valore?.titolo ?? '')
  const [cerca, setCerca] = React.useState('')
  const campo = React.useRef<HTMLInputElement>(null)
  const creaNelPiede = React.useRef<HTMLButtonElement>(null)
  const tornaAlCampo = React.useRef(false)
  const ancora = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => setTesto(valore?.titolo ?? ''), [valore?.titolo])
  // testo da cercare: vuoto se il campo mostra ancora il titolo scelto (si vedono tutti)
  const daCercare = testo === valore?.titolo ? '' : testo
  React.useEffect(() => {
    const t = window.setTimeout(() => setCerca(daCercare), 200)
    return () => window.clearTimeout(t)
  }, [daCercare])
  React.useEffect(() => {
    if (apriSubito) campo.current?.focus()
  }, [apriSubito])

  const { data, isPlaceholderData } = useQuery({ ...sceltaVideogame(cerca), enabled: aperto })
  const elementi = data ?? []
  const aggiornati = data !== undefined && !isPlaceholderData && cerca === daCercare

  // Voce evidenziata, tenuta qui: quando arrivano risultati nuovi si riparte dalla prima
  // (cmdk da solo la perde se la voce evidenziata sparisce, e INVIO non sceglierebbe nulla).
  const [evidenziata, setEvidenziata] = React.useState('')
  React.useEffect(() => {
    if (!aggiornati) setEvidenziata('')
    else if (!elementi.some((v) => String(v.id) === evidenziata)) setEvidenziata(elementi[0] ? String(elementi[0].id) : '')
  }, [aggiornati, elementi, evidenziata])

  const chiudi = () => {
    setAperto(false)
    setTesto(valore?.titolo ?? '')
  }

  const bottoneCrea = (
    <Button
      ref={creaNelPiede}
      type="button"
      variant="dashed"
      size="xs"
      className="h-28 w-fit"
      onClick={() => {
        const cercato = daCercare.trim()
        chiudi()
        onCrea(cercato)
      }}
      onKeyDown={(e) => {
        // INVIO e SPAZIO premono il bottone: cmdk (più su) non deve trattarli come la scelta di una voce
        if (e.key === 'Enter' || e.key === ' ') e.stopPropagation()
        if (e.key === 'Escape') {
          e.preventDefault()
          // il focus torna al campo quando l'elenco ha finito di chiudersi (onCloseAutoFocus)
          tornaAlCampo.current = true
          chiudi()
        }
      }}
      onBlur={(e) => {
        const verso = e.relatedTarget as Node | null
        if (verso && (verso === campo.current || document.querySelector('[data-slot=command-box]')?.contains(verso))) return
        chiudi()
      }}
    >
      + Crealo qui
    </Button>
  )

  return (
    <Command shouldFilter={false} loop value={evidenziata} onValueChange={setEvidenziata} className="min-w-0 flex-1">
      <Popover open={aperto} onOpenChange={(v) => (v ? setAperto(true) : chiudi())}>
        <PopoverAnchor asChild>
          <div
            ref={ancora}
            className={cn(
              'flex h-40 min-w-0 items-center gap-8 border-inchiostro px-10 text-viola',
              aperto ? 'border-3 border-viola bg-bianco' : 'border-2 bg-crema',
              !aperto && invalido && 'border-rosso',
            )}
          >
            <GlifoLente />
            <CommandInput
              ref={campo}
              aria-label={etichetta}
              data-chiave={chiave}
              aria-invalid={invalido || undefined}
              placeholder="Cerca un videogame"
              value={testo}
              onValueChange={(v) => {
                setTesto(v)
                setAperto(true)
              }}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={(e) => {
                const verso = e.relatedTarget as Node | null
                if (verso && document.querySelector('[data-slot=command-box]')?.contains(verso)) return
                chiudi()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  chiudi()
                } else if (e.key === 'ArrowDown' && !aperto) {
                  setAperto(true)
                } else if (e.key === 'Tab' && !e.shiftKey && aperto && creaNelPiede.current) {
                  e.preventDefault()
                  creaNelPiede.current.focus()
                }
              }}
              className="h-full font-ui text-base font-bold text-inchiostro placeholder:font-normal placeholder:text-inchiostro-400"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={() => {
            // ESC su «+ CREALO QUI»: Radix chiude l'elenco prima del keydown del bottone
            if (document.activeElement === creaNelPiede.current) tornaAlCampo.current = true
          }}
          onCloseAutoFocus={(e) => {
            if (!tornaAlCampo.current) return
            tornaAlCampo.current = false
            e.preventDefault()
            campo.current?.focus()
          }}
          onInteractOutside={(e) => {
            if (ancora.current?.contains(e.target as Node)) e.preventDefault()
          }}
          collisionPadding={20}
          className="w-[calc(100vw-40px)] lg:w-460"
        >
          {/* il clic su una voce non deve togliere il focus al campo (che chiuderebbe l'elenco) */}
          <CommandBox onMouseDown={(e) => e.preventDefault()}>
          {!aggiornati && (
            <div role="status" className="truncate px-10 py-6 text-xs text-inchiostro-500">
              {daCercare.trim() ? `Cerco «${daCercare.trim()}»…` : 'Cerco…'}
            </div>
          )}
          <CommandList aria-label="Videogame trovati" aria-busy={!aggiornati}>
            {elementi.map((v) => (
              <CommandItem
                key={v.id}
                value={String(v.id)}
                disabled={!aggiornati}
                onSelect={() => {
                  if (!aggiornati) return
                  onScegli({ id: v.id, titolo: nomeVideogame(v) })
                  setTesto(nomeVideogame(v))
                  setAperto(false)
                }}
              >
                <span className="flex h-28 w-40 shrink-0 overflow-hidden border-2 border-inchiostro bg-viola-100">
                  {v.cover && <img src={v.cover} alt="" className="size-full object-cover" />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-md font-bold">{nomeVideogame(v)}</span>
                  <span className="truncate text-xs text-inchiostro-500 group-data-[selected=true]:text-viola-100">
                    {v.rawg_slug}
                  </span>
                </span>
              </CommandItem>
            ))}
            {aggiornati && <CommandEmpty>Nessun videogame trovato.</CommandEmpty>}
          </CommandList>
            <CommandFooter>
              <span className="flex items-center gap-6 text-inchiostro">
                <GlifoFrecce /> scegli · INVIO conferma · ESC chiudi
              </span>
              <span className="flex items-center gap-8 text-viola">
                Il gioco non c'è? {bottoneCrea}
              </span>
            </CommandFooter>
          </CommandBox>
        </PopoverContent>
      </Popover>
    </Command>
  )
}
