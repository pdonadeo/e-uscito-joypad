// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tabella «Textarea → textarea» di docs/ui.md: `default` text-base, `sm` text-md; altezza fissa
// (104 px, 80 per le note) con scorrimento, quindi niente ridimensionamento a mano.
// Focus come i campi (bordo viola), placeholder inchiostro-300, disattivata inchiostro-400.
const textareaVariants = cva(
  'block w-full resize-none overflow-y-auto border-3 border-inchiostro bg-bianco px-12 py-10 font-ui leading-testo text-inchiostro outline-none placeholder:text-inchiostro-300 focus-visible:border-viola disabled:cursor-not-allowed disabled:text-inchiostro-400 aria-invalid:border-rosso',
  {
    variants: {
      size: {
        default: 'text-base',
        sm: 'text-md',
      },
    },
    defaultVariants: { size: 'default' },
  },
)

function Textarea({ className, size, ...props }: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>) {
  return <textarea data-slot="textarea" className={cn(textareaVariants({ size }), className)} {...props} />
}

export { Textarea }
