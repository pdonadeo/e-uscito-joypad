// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

// Varianti e misure della tabella «Button → button» di docs/ui.md.
// Stati non disegnati (proposte da approvare, elencate nel resoconto del gate 3.6c):
// - focus: contorno viola di 2 px staccato di 2 px (proposta già scritta in ui.md);
// - premuto (active): i bottoni con l'ombra «pixel» scendono sull'ombra, che sparisce;
// - hover: fondo viola-100 su outline/secondary, rosa-200 su destructive, viola-50 su
//   dashed, crema su outline-su-scuro, sottolineatura sui ghost; nessun cambio sui pieni.
const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-8 whitespace-nowrap font-ui font-extrabold uppercase tracking-wide outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola disabled:cursor-not-allowed disabled:border-2 disabled:border-inchiostro-200 disabled:bg-transparent disabled:text-inchiostro-200 disabled:shadow-none',
  {
    variants: {
      variant: {
        default:
          'border-2 border-inchiostro bg-viola text-bianco shadow-pixel-md active:translate-x-3 active:translate-y-3 active:shadow-none',
        'default-su-scuro':
          'border-2 border-crema bg-viola text-bianco tracking-wider shadow-pixel-md active:translate-x-3 active:translate-y-3 active:shadow-none',
        secondary: 'bg-crema text-inchiostro hover:bg-viola-100',
        outline: 'border-2 border-inchiostro bg-bianco text-inchiostro hover:bg-viola-100',
        'outline-ombra':
          'border-2 border-inchiostro bg-bianco text-inchiostro tracking-normal shadow-pixel-sm hover:bg-viola-100 active:translate-x-2 active:translate-y-2 active:shadow-none',
        'outline-su-scuro': 'border-2 border-crema bg-transparent text-crema hover:bg-crema hover:text-inchiostro',
        destructive: 'border-2 border-rosso bg-rosa text-rosso hover:bg-rosa-200',
        'destructive-pieno':
          'border-2 border-inchiostro bg-rosso text-bianco shadow-pixel-md active:translate-x-3 active:translate-y-3 active:shadow-none',
        ghost: 'text-viola hover:underline',
        'ghost-destructive': 'text-rosso hover:underline',
        dashed: 'border-2 border-dashed border-viola bg-transparent text-viola hover:bg-viola-50',
        retro:
          'h-52 border-3 border-inchiostro bg-viola text-bianco tracking-wider shadow-pixel-2xl active:translate-x-6 active:translate-y-6 active:shadow-none',
      },
      size: {
        xs: 'px-10 py-8 text-xs',
        sm: 'px-14 py-10 text-md',
        default: 'px-18 py-12 text-md',
        lg: 'px-16 py-14 text-md',
        xl: 'px-16 text-2xl',
        icon: 'size-40 p-0 text-base',
      },
    },
    compoundVariants: [
      { variant: 'default-su-scuro', size: 'lg', className: 'text-lg' },
      { variant: 'outline', size: 'default', className: 'px-14' },
      { variant: 'outline-su-scuro', size: 'sm', className: 'px-12 py-7 text-sm' },
      { variant: 'destructive', size: 'default', className: 'px-16 text-sm' },
      { variant: 'destructive', size: 'sm', className: 'px-12 py-8 text-sm' },
      { variant: 'destructive', size: 'xs', className: 'py-7' },
      { variant: 'destructive', size: 'icon', className: 'border-inchiostro' },
      { variant: 'ghost', size: 'sm', className: 'px-10 py-6 text-sm' },
      { variant: 'dashed', size: 'default', className: 'p-12 text-sm' },
      { variant: 'dashed', size: 'sm', className: 'py-0 text-sm' },
      { variant: 'dashed', size: 'xs', className: 'px-12 py-0' },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
