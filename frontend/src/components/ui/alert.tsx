// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tabella «Alert → alert» di docs/ui.md. L'icona è un glifo a pixel (pixel-art.tsx) passato
// come `icona`, centrato in verticale sull'Alert come nei PNG; il messaggio è il contenuto.
// Interlinea `leading-titolo` nel `destructive` · `default`: nei PNG del login le due righe
// del messaggio distano 16 px (ui.md non la dà).
const alertVariants = cva('flex w-full items-start font-ui', {
  variants: {
    variant: {
      destructive: 'border-rosso bg-rosa',
      warning: 'border-2 border-inchiostro bg-giallo-100 px-12 py-10 gap-10 text-sm font-extrabold text-inchiostro',
    },
    size: {
      default: '',
      sm: '',
    },
  },
  compoundVariants: [
    {
      variant: 'destructive',
      size: 'default',
      className: 'border-3 px-12 py-10 gap-10 text-md leading-titolo font-bold text-inchiostro',
    },
    {
      variant: 'destructive',
      size: 'sm',
      className: 'border-2 px-10 py-8 gap-8 text-sm font-extrabold uppercase tracking-wide text-rosso',
    },
  ],
  defaultVariants: {
    variant: 'destructive',
    size: 'default',
  },
})

function Alert({
  className,
  variant,
  size,
  icona,
  children,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants> & { icona?: React.ReactNode }) {
  return (
    <div data-slot="alert" role="alert" className={cn(alertVariants({ variant, size }), className)} {...props}>
      {icona != null && (
        <span
          aria-hidden="true"
          className={cn('flex shrink-0 self-center px-2', variant !== 'warning' && 'text-rosso')}
        >
          {icona}
        </span>
      )}
      <div data-slot="alert-description">{children}</div>
    </div>
  )
}

export { Alert }
