// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// Tabella «Switch → switch» di docs/ui.md: 52 × 28, bordo 3 px, padding 3 px, levetta quadrata
// 16 × 16. Acceso: fondo verde, levetta bianca a destra. Spento: fondo viola-100, levetta
// inchiostro-200 a sinistra. Focus (non disegnato, proposta): contorno viola dei bottoni.
function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-28 w-52 shrink-0 items-center border-3 border-inchiostro bg-viola-100 p-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola disabled:cursor-not-allowed data-[state=checked]:bg-verde',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-16 border-2 border-inchiostro bg-inchiostro-200 data-[state=checked]:translate-x-24 data-[state=checked]:bg-bianco"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
