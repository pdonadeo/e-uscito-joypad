// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { GlifoPlay, GlifoStella } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// Tabella «Card → card» di docs/ui.md.
// - `sezione`: i pannelli dei form, con CardTitle «▶ …» e lo slot del contenuto (CardContent);
//   il gap tra titolo e contenuto cambia da pannello a pannello e si passa con className.
// - `sezione-scura`: «★ QUEST LOG», «★ DATI RAWG GIÀ PRESENTI»; CardTitle con `scura` mette «★»
//   e il testo giallo, il contenuto è crema.
// - `scheda`: le schede degli elenchi a 390 (`scheda-episodio`, `scheda-videogame`), bianche o
//   viola-100 da selezionate (data-selezionata).
const cardVariants = cva('flex flex-col', {
  variants: {
    variant: {
      sezione: 'border-3 border-inchiostro bg-crema p-16 shadow-pixel-lg',
      'sezione-scura': 'gap-12 bg-inchiostro p-18 font-ui text-crema shadow-pixel-lg shadow-rosa-acceso',
      scheda:
        'border-2 border-inchiostro bg-bianco p-12 shadow-pixel-md data-[selezionata=true]:bg-viola-100',
    },
  },
  defaultVariants: { variant: 'sezione' },
})

function Card({ className, variant, ...props }: React.ComponentProps<'section'> & VariantProps<typeof cardVariants>) {
  return <section data-slot="card" className={cn(cardVariants({ variant }), className)} {...props} />
}

function CardTitle({ className, children, scura, ...props }: React.ComponentProps<'h2'> & { scura?: boolean }) {
  return (
    <h2
      data-slot="card-title"
      className={cn(
        'flex items-center gap-12 font-ui text-md font-extrabold uppercase tracking-wide',
        scura ? 'gap-10 text-giallo' : 'text-viola',
        className,
      )}
      {...props}
    >
      {scura ? <GlifoStella misura="titolo" /> : <GlifoPlay misura="voce" />}
      <span>{children}</span>
    </h2>
  )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('flex flex-col', className)} {...props} />
}

export { Card, CardTitle, CardContent }
