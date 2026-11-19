import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { GlifoIndietro, GlifoPlay } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// Intestazione delle pagine (PNG degli elenchi e delle modifiche, docs/ui.md):
// - occhiello «▶ LIVELLO …» oppure il ritorno «◀ EPISODI» all'elenco;
// - titolo in font-titolo, con accanto un eventuale badge (`stato`);
// - a destra le `azioni` («+ NUOVO EPISODIO»), allineate in basso con il titolo.
export function IntestazionePagina({
  occhiello,
  indietro,
  titolo,
  stato,
  azioni,
  className,
}: {
  occhiello?: string
  indietro?: { to: string; etichetta: string }
  titolo: string
  stato?: React.ReactNode
  azioni?: React.ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex items-end justify-between gap-16', className)}>
      <div className={cn('flex min-w-0 flex-col', indietro ? 'gap-20 lg:gap-17' : 'gap-0 lg:gap-6')}>
        {occhiello && (
          <p className="flex items-center gap-12 text-sm font-extrabold uppercase tracking-wider text-viola">
            <GlifoPlay misura="occhiello" />
            {occhiello}
          </p>
        )}
        {indietro && (
          <Link
            to={indietro.to}
            className="flex w-fit items-center gap-10 text-sm font-extrabold uppercase tracking-wider text-inchiostro outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
          >
            <GlifoIndietro />
            {indietro.etichetta}
          </Link>
        )}
        <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:gap-18">
          <h1 className="font-titolo text-5xl font-bold text-inchiostro wrap-anywhere lg:text-6xl">{titolo}</h1>
          {stato}
        </div>
      </div>
      {azioni}
    </header>
  )
}
