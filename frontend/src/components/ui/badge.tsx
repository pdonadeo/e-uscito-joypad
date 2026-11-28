// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tabella «Badge → badge» di docs/ui.md. Il glifo («✔», «·», «★») è un figlio: un glifo a pixel
// di pixel-art.tsx oppure testo.
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-6 whitespace-nowrap border-2 font-ui font-extrabold uppercase tracking-wide',
  {
    variants: {
      variant: {
        success: 'border-inchiostro bg-verde text-inchiostro',
        destructive: 'border-rosso bg-rosa text-rosso',
        warning: 'border-inchiostro bg-giallo text-inchiostro',
        'success-tenue': 'border-verde-600 bg-verde-100 text-verde-700',
        'outline-tratteggiato': 'border-dashed border-inchiostro-200 bg-transparent text-inchiostro-400',
      },
      size: {
        lg: 'px-8 py-4 text-xs',
        default: 'px-8 py-3 text-xs',
        sm: 'px-8 py-3 text-2xs',
      },
    },
    compoundVariants: [
      { variant: 'success-tenue', size: 'sm', className: 'px-6' },
      { variant: 'outline-tratteggiato', size: 'sm', className: 'px-6' },
    ],
    defaultVariants: { variant: 'success', size: 'default' },
  },
)

function Badge({ className, variant, size, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }
