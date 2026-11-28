// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { GlifoChiudi, GlifoPlay } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// Dialog modale grande (docs/ui.md, «Nuovo videogame dal form dell'episodio»): le conferme
// restano su alert-dialog. Sopra il velo `bg-velo`; su desktop (lg) occupa la viewport con 32 px
// di margine per lato, a 390 tutto lo schermo. Testata con l'occhiello «▶ …» (è il titolo del
// dialogo) e «✕» per chiudere; il corpo scorre dentro il Dialog, con lo stesso fondo dell'area
// principale. Dissolvenza di 120 ms come gli altri dialoghi.
// Un clic su un Toast (che sta sopra il Dialog) non conta come clic fuori: non chiude il Dialog.

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

const dentroUnToast = (e: Event) => e.target instanceof Element && e.target.closest('[data-sonner-toaster]') != null

function DialogContent({
  className,
  children,
  titolo,
  descrizione,
  onPointerDownOutside,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { titolo: string; descrizione: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay
        data-slot="dialog-overlay"
        className="fixed inset-0 z-50 bg-velo duration-120 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          'fixed inset-0 z-50 flex flex-col bg-crema font-ui text-inchiostro outline-none duration-120 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:inset-32 lg:border-3 lg:border-inchiostro lg:shadow-pixel-xl lg:shadow-viola',
          className,
        )}
        onPointerDownOutside={(e) => {
          if (dentroUnToast(e.detail.originalEvent)) e.preventDefault()
          else onPointerDownOutside?.(e)
        }}
        {...props}
      >
        <div className="flex h-56 shrink-0 items-center justify-between gap-16 border-b-3 border-inchiostro bg-crema pr-12 pl-16 lg:h-64 lg:pr-16 lg:pl-24">
          <DialogPrimitive.Title className="flex items-center gap-12 text-md font-extrabold uppercase tracking-wide text-viola">
            <GlifoPlay misura="voce" />
            {titolo}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{descrizione}</DialogPrimitive.Description>
          <DialogPrimitive.Close
            aria-label="Chiudi"
            className="flex size-40 shrink-0 items-center justify-center border-2 border-inchiostro bg-bianco text-inchiostro outline-none hover:bg-viola-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
          >
            <GlifoChiudi misura="bottone" />
          </DialogPrimitive.Close>
        </div>
        <div
          data-slot="dialog-body"
          className="min-h-0 flex-1 overflow-y-auto bg-linear-to-b from-cielo to-rosa px-16 pt-16 pb-24 lg:px-24 lg:pt-24"
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export { Dialog, DialogContent }
