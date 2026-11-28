// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import { GlifoPlay } from '@/components/pixel-art'
import { Alert } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// «Dialog → alert-dialog» di docs/ui.md: `default` 460 px su desktop (lg), `sm` 342 px a 390,
// sempre centrato sopra il velo, con dissolvenza di 120 ms (prototipo). Dall'alto: occhiello
// «▶ GAME OVER?», titolo, spiegazione, Alert «NON SI PUÒ ANNULLARE», azioni ANNULLA (focus
// iniziale: Radix lo dà a Cancel) ed ELIMINA.
function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay
        data-slot="alert-dialog-overlay"
        className="fixed inset-0 z-50 bg-velo duration-120 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 flex w-342 max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-14 border-3 border-inchiostro bg-crema p-20 font-ui text-inchiostro shadow-pixel-xl shadow-rosso duration-120 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:w-460 lg:p-24',
          className,
        )}
        {...props}
      >
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogOcchiello({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-10 text-md font-extrabold uppercase tracking-wide text-rosso">
      <GlifoPlay misura="voce" />
      {children}
    </p>
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn('-mt-4 font-titolo text-4xl leading-titolo font-bold', className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn('text-base leading-testo', className)}
      {...props}
    />
  )
}

function AlertDialogIrreversibile() {
  return (
    <Alert size="sm" className="uppercase">
      Non si può annullare
    </Alert>
  )
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-footer" className={cn('mt-6 grid grid-cols-2 gap-12', className)} {...props} />
}

function AlertDialogCancel({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Cancel>) {
  return (
    <AlertDialogPrimitive.Cancel
      className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Action>) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant: 'destructive-pieno', size: 'lg' }), className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogOcchiello,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogIrreversibile,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
}
