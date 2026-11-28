// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/lib/utils'

// «Sidebar → sidebar» di docs/ui.md. Dal componente shadcn si tengono i nomi e la
// struttura (Sidebar, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton
// con asChild). Non si tengono SidebarProvider, useIsMobile e lo stato «collapsed»: qui
// rotaia ed espansa dipendono solo dai breakpoint (lg = rotaia, xl = espansa, docs/ui.md
// «Comportamento responsive») e sotto lg il menu è lo Sheet.
//
// layout:
// - `responsive`: nascosta sotto lg, rotaia da lg (88 px), espansa da xl (232 px);
// - `espansa`: sempre espansa, per il contenuto dello Sheet a 390.
//
// Voce attiva: TanStack Router mette aria-current="page" sul Link attivo.
// Stato non disegnato (proposta): hover delle voci non attive con fondo viola-100
// (il token --sidebar-accent di ui.md).

const sidebarVariants = cva('flex flex-col bg-crema', {
  variants: {
    layout: {
      responsive: 'hidden w-88 shrink-0 gap-10 px-10 pt-20 lg:flex xl:w-232 xl:gap-8 xl:px-16 xl:pt-24',
      espansa: 'gap-8 px-16',
    },
  },
  defaultVariants: { layout: 'responsive' },
})

type Layout = NonNullable<VariantProps<typeof sidebarVariants>['layout']>
const LayoutContext = React.createContext<Layout>('responsive')

function Sidebar({
  className,
  layout = 'responsive',
  ...props
}: React.ComponentProps<'nav'> & VariantProps<typeof sidebarVariants>) {
  const l = layout ?? 'responsive'
  return (
    <LayoutContext.Provider value={l}>
      <nav data-slot="sidebar" data-layout={l} className={cn(sidebarVariants({ layout: l }), className)} {...props} />
    </LayoutContext.Provider>
  )
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<'div'>) {
  const layout = React.useContext(LayoutContext)
  return (
    <div
      data-slot="sidebar-group-label"
      className={cn(
        'font-ui text-xs font-extrabold uppercase tracking-wide text-inchiostro-500',
        layout === 'responsive' && 'hidden xl:block',
        className,
      )}
      {...props}
    />
  )
}

function SidebarMenu({ className, ...props }: React.ComponentProps<'ul'>) {
  const layout = React.useContext(LayoutContext)
  return (
    <ul
      data-slot="sidebar-menu"
      className={cn('flex flex-col', layout === 'responsive' ? 'gap-10 xl:gap-8' : 'gap-8', className)}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li data-slot="sidebar-menu-item" className={cn('flex', className)} {...props} />
}

const voceEspansa = 'h-44 flex-row justify-start gap-10 px-16 text-md'
const voceRotaia = 'h-64 flex-col justify-center gap-6 px-0 text-2xs'
const voceEspansaDaXl = 'xl:h-44 xl:flex-row xl:justify-start xl:gap-10 xl:px-16 xl:text-md'

function SidebarMenuButton({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'a'> & { asChild?: boolean }) {
  const layout = React.useContext(LayoutContext)
  const Comp = asChild ? Slot.Root : 'a'
  return (
    <Comp
      data-slot="sidebar-menu-button"
      className={cn(
        'flex w-full items-center border-2 border-trasparente font-ui font-extrabold uppercase tracking-wide text-inchiostro outline-none hover:bg-viola-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola',
        '[&_[data-slot=icona]]:text-viola',
        'aria-[current=page]:border-inchiostro aria-[current=page]:bg-viola aria-[current=page]:text-bianco aria-[current=page]:shadow-pixel-md aria-[current=page]:[&_[data-slot=icona]]:text-bianco',
        layout === 'responsive' ? [voceRotaia, voceEspansaDaXl] : voceEspansa,
        className,
      )}
      {...props}
    />
  )
}

// Icona della voce: glifo a pixel (pixel-art.tsx) in due misure, `rotaia` (lg) ed `espansa`
// (xl e Sheet). Nella Sidebar espansa sta in una colonna di 12 px centrata, così le etichette
// partono tutte alla stessa x come nei PNG.
function SidebarMenuIcon({
  rotaia,
  espansa,
  className,
}: {
  rotaia: React.ReactNode
  espansa: React.ReactNode
  className?: string
}) {
  const layout = React.useContext(LayoutContext)
  return (
    <span
      data-slot="icona"
      aria-hidden="true"
      className={cn('flex shrink-0 justify-center', layout === 'responsive' ? 'xl:w-12' : 'w-12', className)}
    >
      {layout === 'responsive' ? (
        <>
          <span className="flex xl:hidden">{rotaia}</span>
          <span className="hidden xl:flex">{espansa}</span>
        </>
      ) : (
        espansa
      )}
    </span>
  )
}

export { Sidebar, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuIcon }
