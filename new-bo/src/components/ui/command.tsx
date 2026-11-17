// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { GlifoInvio } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// «Combobox → command dentro popover» di docs/ui.md.
// - CommandBox: riquadro bianco con bordo 3 px inchiostro, ombra pixel-xl viola, p-6 gap-2;
//   dentro, CommandList scorre (proposta: alta al massimo quattro voci, come nei PNG) e
//   CommandFooter resta fermo in fondo.
// - CommandItem: miniatura, titolo text-md bold e slug text-xs inchiostro-500; evidenziato
//   viola con i testi bianco e viola-100 e «↵» a destra.
// - CommandItem disattivato (proposta): opacity-30, senza evidenziazione, finché i risultati non
//   corrispondono al testo scritto.
// - CommandFooter: fondo crema con bordo linea (aiuti per la tastiera e rimando a VIDEOGAME).
// Il filtro lo fa il server (F-VG-03): Command si usa con shouldFilter={false}.
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return <CommandPrimitive data-slot="command" className={cn('flex flex-col', className)} {...props} />
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return <CommandPrimitive.Input data-slot="command-input" className={cn('min-w-0 flex-1 bg-transparent outline-none', className)} {...props} />
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        'max-h-180 overflow-y-auto [&>[cmdk-list-sizer]]:flex [&>[cmdk-list-sizer]]:flex-col [&>[cmdk-list-sizer]]:gap-2',
        className,
      )}
      {...props}
    />
  )
}

function CommandBox({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="command-box"
      className={cn(
        'flex flex-col gap-2 border-3 border-inchiostro bg-bianco p-6 font-ui text-inchiostro shadow-pixel-xl shadow-viola',
        className,
      )}
      {...props}
    />
  )
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return <CommandPrimitive.Empty data-slot="command-empty" className={cn('px-10 py-12 text-md text-inchiostro-500', className)} {...props} />
}

function CommandItem({ className, children, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        'group flex cursor-pointer items-center gap-12 px-10 py-6 outline-none select-none data-[selected=true]:bg-viola data-[selected=true]:text-bianco data-[disabled=true]:cursor-default data-[disabled=true]:opacity-30',
        className,
      )}
      {...props}
    >
      {children}
      <span aria-hidden="true" className="ml-auto hidden shrink-0 group-data-[selected=true]:flex">
        <GlifoInvio />
      </span>
    </CommandPrimitive.Item>
  )
}

function CommandFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="command-footer"
      className={cn('mt-2 flex flex-col gap-4 border border-linea bg-crema px-10 py-6 text-xs', className)}
      {...props}
    />
  )
}

export { Command, CommandInput, CommandBox, CommandList, CommandEmpty, CommandItem, CommandFooter }
