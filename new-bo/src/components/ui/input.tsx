// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

// Tabella «Input → input» di docs/ui.md. Qui ci sono le misure semplici; le varianti
// composte (data, url, slug, ricerca, con icona o prefisso) si aggiungono con gli elenchi
// e i form. Focus: bordo viola su fondo bianco (variante `ricerca-focus`), lo spessore del
// bordo resta quello della misura. Disattivato: testo inchiostro-400 (variante `disabled`).
// Errore: bordo rosso con aria-invalid (variante `errore`).
const inputVariants = cva(
  'w-full min-w-0 border-inchiostro bg-bianco font-ui text-inchiostro outline-none placeholder:text-inchiostro-300 focus-visible:border-viola focus-visible:bg-bianco disabled:cursor-not-allowed disabled:text-inchiostro-400 aria-invalid:border-rosso',
  {
    variants: {
      inputSize: {
        default: 'h-44 border-3 px-12 text-lg',
        sm: 'h-40 border-2 bg-crema px-10 text-base focus-visible:border-3',
        lg: 'h-46 border-3 px-16 text-lg',
      },
    },
    defaultVariants: {
      inputSize: 'default',
    },
  },
)

function Input({
  className,
  type,
  inputSize,
  ...props
}: React.ComponentProps<'input'> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(inputVariants({ inputSize }), className)}
      {...props}
    />
  )
}

export { Input, inputVariants }
