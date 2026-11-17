// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Etichetta dei campi: maiuscolo, font-extrabold, tracking-wide (docs/ui.md, «Regole comuni»).
// La dimensione (text-sm, 12 px) è misurata sui PNG del login.
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-8 font-ui text-sm font-extrabold uppercase tracking-wide text-inchiostro select-none peer-disabled:cursor-not-allowed',
        className,
      )}
      {...props}
    />
  )
}

export { Label }
