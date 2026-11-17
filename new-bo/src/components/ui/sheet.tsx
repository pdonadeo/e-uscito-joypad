// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

// «Sheet → sheet (side="left")»: 304 px, alto quanto lo schermo, fondo crema, bordo destro
// di 3 px, ombra viola. Entra da sinistra in 150 ms sopra il velo, che si dissolve in 120 ms
// (docs/ui.md, «Prototipo»). Solo il lato sinistro: il disegno non usa gli altri.
// La chiusura «✕» sta nella testata scura ed è un SheetClose del chiamante.

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        'fixed inset-0 z-50 bg-velo data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-120 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-120',
        className,
      )}
      {...props}
    />
  )
}

function SheetContent({ className, children, ...props }: React.ComponentProps<typeof SheetPrimitive.Content>) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-full w-304 max-w-full flex-col border-r-3 border-inchiostro bg-crema shadow-pixel-2xl shadow-viola outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=closed]:duration-150 data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=open]:duration-150',
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn('flex h-56 shrink-0 items-center justify-between bg-inchiostro px-16', className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-8 p-16 pb-24', className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn('font-titolo text-3xl font-bold text-crema', className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn('font-ui text-sm text-inchiostro-500', className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription }
