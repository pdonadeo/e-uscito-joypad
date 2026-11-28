// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Select as SelectPrimitive } from 'radix-ui'
import { GlifoChiudi, GlifoSpunta, GlifoTendina } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// Tabella «Select → select» di docs/ui.md.
// - SelectTrigger: `default` · `sm` (tipologia e speaker a 390), `tabella` · `sm` (nella tabella
//   delle associazioni), `default` · `xs` («Righe per pagina»).
// - SelectConEtichetta: `con-etichetta` · `default`/`sm` (filtro «Pubblicato», ORDINA), con
//   l'etichetta viola a sinistra e, nei filtri, «✕» per togliere il filtro.
// Il menu che si apre non è disegnato. Proposta: fondo bianco, bordo inchiostro di 2 px e ombra
// pixel-md viola, voci text-md; la voce evidenziata è viola con il testo bianco (come
// ComboboxItem `evidenziato`), quella scelta ha «✔».
const selectTriggerVariants = cva(
  'flex w-full min-w-0 items-center justify-between border-inchiostro font-ui text-inchiostro outline-none focus-visible:border-viola focus-visible:bg-bianco disabled:cursor-not-allowed disabled:text-inchiostro-400 data-[placeholder]:text-inchiostro-300 [&>span]:truncate',
  {
    variants: {
      variant: {
        default: 'h-40 gap-6 border-2 bg-crema px-10 text-md',
        tabella: 'h-40 gap-6 border-2 bg-crema px-10 text-base',
        xs: 'h-32 w-auto gap-8 border-2 bg-bianco px-10 text-base',
        nuda: 'h-full w-auto gap-8 border-0 bg-transparent p-0',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Select(props: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue(props: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  variant,
  children,
  freccia = 'normale',
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger> &
  VariantProps<typeof selectTriggerVariants> & { freccia?: 'normale' | 'piccola' }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(selectTriggerVariants({ variant }), className)}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <span className={cn('flex shrink-0', freccia === 'piccola' ? 'text-inchiostro' : 'text-viola')}>
          <GlifoTendina misura={freccia} />
        </span>
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position="popper"
        sideOffset={4}
        className={cn(
          'relative z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-y-auto border-2 border-inchiostro bg-bianco p-4 font-ui text-inchiostro shadow-pixel-md shadow-viola',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="flex flex-col gap-2">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'flex cursor-pointer items-center justify-between gap-12 px-10 py-8 text-md outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:text-inchiostro-300 data-[highlighted]:bg-viola data-[highlighted]:text-bianco',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="flex">
        <GlifoSpunta misura="casella" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

const conEtichettaVariants = cva('flex w-fit shrink-0 items-center border-inchiostro bg-bianco font-ui text-inchiostro', {
  variants: {
    size: {
      default: 'h-44 gap-10 border-3 px-12 text-base [&_[data-slot=etichetta]]:text-xs',
      sm: 'h-40 gap-8 border-2 px-10 text-md [&_[data-slot=etichetta]]:text-2xs',
    },
  },
  defaultVariants: { size: 'default' },
})

// Select `con-etichetta`: il bordo sta sul contenitore, che tiene insieme il Select e, se c'è
// `onRimuovi`, il bottone «✕» che toglie il filtro. Focus (proposta): il contenitore prende il
// bordo viola quando il Select ha il focus.
function SelectConEtichetta({
  etichetta,
  onRimuovi,
  etichettaRimuovi,
  size,
  className,
  valoreClassName,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Root> &
  VariantProps<typeof conEtichettaVariants> & {
    etichetta: string
    onRimuovi?: () => void
    etichettaRimuovi?: string
    className?: string
    valoreClassName?: string
  }) {
  return (
    <div data-slot="select-con-etichetta" className={cn(conEtichettaVariants({ size }), 'focus-within:border-viola', className)}>
      <Select {...props}>
        <SelectTrigger variant="nuda" freccia="piccola" aria-label={etichetta} className={valoreClassName}>
          <span data-slot="etichetta" className="font-extrabold uppercase tracking-wide text-viola">
            {etichetta}
          </span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {onRimuovi && (
        <button
          type="button"
          aria-label={etichettaRimuovi ?? `Togli il filtro ${etichetta}`}
          onClick={onRimuovi}
          className="flex size-16 items-center justify-center text-rosso outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
        >
          <GlifoChiudi misura="piccolo" />
        </button>
      )}
    </div>
  )
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem, SelectConEtichetta }
