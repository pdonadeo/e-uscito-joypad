import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { GlifoPlay } from '@/components/pixel-art'
import { Button } from '@/components/ui/button'

// Barra delle azioni dei form (docs/ui.md, «Comportamento responsive» e «SALVA E CONTINUA»).
// - Desktop: in fondo al contenuto; `elimina` a sinistra, a destra ANNULLA, l'eventuale
//   SALVA E CONTINUA e «▶ SALVA» (o «▶ CREA», «▶ CREA DA RAWG»).
// - 390: fissa in basso; con SALVA E CONTINUA ha due righe (sopra SALVA E CONTINUA a tutta
//   larghezza, sotto ANNULLA + SALVA). ELIMINA a 390 sta nel contenuto: lo mette il form.
// «▶ SALVA» è il submit del form (anche INVIO in un campo); SALVA E CONTINUA è un bottone a sé.
// Durante l'invio il bottone premuto dice «Attendi…».

export type Annulla = { to: '/bo/episodi' | '/bo/videogame' | '/bo/utenti' } | { onClick: () => void }

export function BarraAzioni({
  desktop,
  invio,
  inCorso,
  elimina,
  annulla,
  etichettaSalva,
  onContinua,
}: {
  desktop: boolean
  // un invio è in corso; `inCorso` dice quale bottone l'ha fatto partire
  invio: boolean
  inCorso: 'salva' | 'continua'
  elimina?: React.ReactNode
  annulla: Annulla
  etichettaSalva: string
  // se c'è, mostra SALVA E CONTINUA
  onContinua?: () => void
}) {
  const bottoneAnnulla =
    'to' in annulla ? (
      <Button asChild variant="secondary" size="lg" className="max-[390px]:px-12">
        <Link to={annulla.to}>Annulla</Link>
      </Button>
    ) : (
      <Button type="button" variant="secondary" size="lg" className="max-[390px]:px-12" onClick={annulla.onClick}>
        Annulla
      </Button>
    )

  const bottoneContinua = onContinua && (
    <Button
      type="button"
      variant="secondary"
      size="lg"
      aria-busy={invio}
      className="aria-busy:cursor-wait max-lg:w-full"
      onClick={onContinua}
    >
      {invio && inCorso === 'continua' ? 'Attendi…' : 'Salva e continua'}
    </Button>
  )

  const azioni = (
    <>
      {bottoneAnnulla}
      {desktop && bottoneContinua}
      <Button
        type="submit"
        variant="default-su-scuro"
        size="lg"
        aria-busy={invio}
        className="gap-14 aria-busy:cursor-wait max-lg:flex-1 max-[390px]:gap-8 max-[390px]:px-10 max-[390px]:tracking-wide lg:min-w-200"
      >
        <GlifoPlay misura="medio" /> {invio && inCorso === 'salva' ? 'Attendi…' : etichettaSalva}
      </Button>
    </>
  )

  if (desktop)
    return (
      <div data-testid="barra-azioni" className="flex items-center justify-between gap-16 bg-inchiostro px-16 py-12">
        <div>{elimina}</div>
        <div className="flex items-center gap-12">{azioni}</div>
      </div>
    )

  return (
    <div
      data-testid="barra-azioni"
      className="sticky bottom-0 z-30 -mx-16 -mb-24 flex flex-col gap-12 bg-inchiostro px-16 pt-12 pb-20"
    >
      {bottoneContinua}
      <div className="flex items-center gap-12">{azioni}</div>
    </div>
  )
}
