import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { GlifoFrecce, GlifoLente } from '@/components/pixel-art'
import { Command, CommandBox, CommandEmpty, CommandFooter, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { sceltaVideogame } from '@/lib/episodi'
import { cn } from '@/lib/utils'

// Scelta del videogame di un'associazione (F-EP-09): Input `ricerca` · `sm` che apre il Combobox
// (docs/ui.md, «Combobox → command dentro popover»). La ricerca è quella di F-VG-03, fatta dal
// server, con le opzioni ordinate per titolo.
// Comportamento (proposta): il campo mostra il titolo scelto; scrivendo si apre l'elenco (anche con
// ↓); INVIO o un clic scelgono, ESC o l'uscita dal campo rimettono il titolo di prima.
// Finché i risultati non sono quelli del testo scritto (attesa della ricerca, o dati della
// ricerca precedente tenuti a schermo da keepPreviousData) l'elenco dice «Cerco «…»…», le voci
// sono attenuate e disattivate e nessuna è evidenziata: INVIO non sceglie nulla.

export type VideogameScelto = { id: number; titolo: string }

export function SceltaVideogame({
  valore,
  onScegli,
  etichetta,
  apriSubito,
  invalido,
}: {
  valore: VideogameScelto | null
  onScegli: (v: VideogameScelto) => void
  etichetta: string
  apriSubito?: boolean
  invalido?: boolean
}) {
  const [aperto, setAperto] = React.useState(false)
  const [testo, setTesto] = React.useState(valore?.titolo ?? '')
  const [cerca, setCerca] = React.useState('')
  const campo = React.useRef<HTMLInputElement>(null)
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
  const elementi = data?.elementi ?? []
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
                }
              }}
              className="h-full font-ui text-base font-bold text-inchiostro placeholder:font-normal placeholder:text-inchiostro-400"
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          onOpenAutoFocus={(e) => e.preventDefault()}
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
                  onScegli({ id: v.id, titolo: v.titolo ?? v.rawg_slug })
                  setTesto(v.titolo ?? v.rawg_slug)
                  setAperto(false)
                }}
              >
                <span className="flex h-28 w-40 shrink-0 overflow-hidden border-2 border-inchiostro bg-viola-100">
                  {v.cover && <img src={v.cover} alt="" className="size-full object-cover" />}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-md font-bold">{v.titolo ?? v.rawg_slug}</span>
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
              <span className="text-viola">
                Il gioco non c'è? Crealo prima da{' '}
                <Link to="/videogame" className="font-extrabold underline">
                  VIDEOGAME
                </Link>
                .
              </span>
            </CommandFooter>
          </CommandBox>
        </PopoverContent>
      </Popover>
    </Command>
  )
}
