// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { GlifoMeno, GlifoSpunta } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// Tabella «Checkbox → checkbox» di docs/ui.md: 18 × 18 (`default`) e 20 × 20 (`lg`, a 390),
// fondo bianco e bordo inchiostro; selezionata viola con «✔» bianco; `indeterminate` con
// bordo crema e «–» viola («seleziona tutti» nell'intestazione scura).
// Stati non disegnati (proposte): focus con il contorno viola dei bottoni; nell'intestazione
// scura (`suScuro`) il bordo è crema anche da vuota e da selezionata.
const checkboxVariants = cva(
  'peer inline-flex shrink-0 items-center justify-center border-2 border-inchiostro bg-bianco text-bianco outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola disabled:cursor-not-allowed data-[state=checked]:bg-viola data-[state=indeterminate]:border-crema data-[state=indeterminate]:text-viola',
  {
    variants: {
      size: {
        default: 'size-18',
        lg: 'size-20',
      },
      suScuro: {
        true: 'border-crema',
        false: '',
      },
    },
    defaultVariants: { size: 'default', suScuro: false },
  },
)

function Checkbox({
  className,
  size,
  suScuro,
  checked,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root> & VariantProps<typeof checkboxVariants>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      checked={checked}
      className={cn(checkboxVariants({ size, suScuro }), className)}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center">
        {checked === 'indeterminate' ? <GlifoMeno /> : <GlifoSpunta misura="casella" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
