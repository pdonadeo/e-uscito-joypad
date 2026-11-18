import * as React from 'react'
import { GlifoChiudi, GlifoOrdine } from '@/components/pixel-art'
import { Button } from '@/components/ui/button'
import { TableHead } from '@/components/ui/table'

// Pezzi comuni agli elenchi (episodi, videogame): intestazioni ordinabili, barra della selezione
// per l'eliminazione in blocco, testo al posto delle righe e ricerca con pausa.

// Intestazione di una colonna ordinabile (F-EP-02, F-VG-02): un bottone; la colonna ordinata è
// gialla con «▲/▼» (aria-sort sul th).
export function IntestazioneOrdinabile({
  attiva,
  ascendente,
  onOrdina,
  className,
  children,
}: {
  attiva: boolean
  ascendente: boolean
  onOrdina: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <TableHead aria-sort={attiva ? (ascendente ? 'ascending' : 'descending') : undefined} className={className}>
      <button
        type="button"
        onClick={onOrdina}
        className="inline-flex items-center gap-8 uppercase outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
      >
        {children}
        {attiva && <GlifoOrdine verso={ascendente ? 'su' : 'giu'} />}
      </button>
    </TableHead>
  )
}

// Barra della selezione: su desktop sopra la tabella («N … SELEZIONATI», DESELEZIONA, ✕ ELIMINA
// SELEZIONATI), a 390 sopra le schede («N SELEZIONATI», ✕ ELIMINA).
export function BarraSelezione({
  desktop,
  testo,
  onDeseleziona,
  onElimina,
}: {
  desktop: boolean
  testo: string
  onDeseleziona: () => void
  onElimina: () => void
}) {
  if (!desktop)
    return (
      <div className="flex items-center justify-between border-2 border-inchiostro bg-viola-100 py-6 pr-6 pl-12 shadow-pixel-md">
        <span className="text-sm font-extrabold uppercase tracking-wide">{testo}</span>
        <Button variant="destructive" size="xs" onClick={onElimina}>
          <GlifoChiudi misura="bottone" /> Elimina
        </Button>
      </div>
    )
  return (
    <div className="flex h-49 items-center justify-between bg-viola-100 pr-8 pl-16">
      <span className="text-sm font-extrabold uppercase tracking-wide">{testo}</span>
      <div className="flex items-center gap-24">
        <Button variant="ghost" size="sm" onClick={onDeseleziona}>
          Deseleziona
        </Button>
        <Button variant="destructive" size="sm" onClick={onElimina}>
          <GlifoChiudi misura="bottone" /> Elimina selezionati
        </Button>
      </div>
    </div>
  )
}

// Stati non disegnati (proposta): testi semplici al posto delle righe.
export function Vuoto({
  caricamento,
  errore,
  testi,
}: {
  caricamento: boolean
  errore: boolean
  testi: { nessuno: string; errore: string }
}) {
  if (caricamento) return <>Caricamento…</>
  if (errore) return <>{testi.errore}</>
  return <>{testi.nessuno}</>
}

// Ricerca degli elenchi (F-EP-03, F-VG-03): il campo è immediato, `onCambia` (che aggiorna
// l'indirizzo) parte dopo 300 ms di pausa.
export function useRicercaDifferita(valore: string | undefined, onCambia: (v: string | undefined) => void) {
  const [testo, setTesto] = React.useState(valore ?? '')
  const cambia = React.useRef(onCambia)
  React.useEffect(() => {
    cambia.current = onCambia
  })
  React.useEffect(() => {
    const t = window.setTimeout(() => {
      if ((valore ?? '') !== testo) cambia.current(testo === '' ? undefined : testo)
    }, 300)
    return () => window.clearTimeout(t)
  }, [testo])
  return [testo, setTesto] as const
}
