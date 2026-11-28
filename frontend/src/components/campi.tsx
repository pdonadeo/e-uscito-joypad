import * as React from 'react'
import { GlifoCalendario, GlifoLente } from '@/components/pixel-art'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

// Campi dei form e degli elenchi costruiti sui componenti di ui/ (docs/ui.md, «Input → input»).

// Etichetta sopra il campo. `obbligatorio` aggiunge « *» come nei PNG.
export function Campo({
  etichetta,
  htmlFor,
  obbligatorio,
  className,
  children,
}: {
  etichetta: string
  htmlFor: string
  obbligatorio?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-8', className)}>
      <Label htmlFor={htmlFor} className="text-xs leading-none">
        {obbligatorio ? `${etichetta} *` : etichetta}
      </Label>
      {children}
    </div>
  )
}

// Input `ricerca` · `default` (elenchi): icona «⌕» viola, gap 8, placeholder inchiostro-400
// text-base. Il bordo e il fondo stanno sul contenitore, che prende il focus del campo.
export function InputRicerca({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <div
      className={cn(
        'flex h-44 items-center gap-8 border-3 border-inchiostro bg-bianco px-12 text-viola focus-within:border-viola',
        className,
      )}
    >
      <GlifoLente />
      <input
        type="search"
        className="h-full min-w-0 flex-1 bg-transparent font-ui text-lg text-inchiostro outline-none placeholder:text-base placeholder:text-inchiostro-400 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
    </div>
  )
}

// Input `data` · `default`: il valore si scrive come AAAA-MM-GG (come nei PNG e nel contratto) e
// «▦» apre il calendario del browser (proposta: un input type=date nascosto con showPicker).
export function InputData({
  value,
  onChange,
  id,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & { value: string; onChange: (v: string) => void }) {
  const calendario = React.useRef<HTMLInputElement>(null)
  return (
    <div className="relative">
      <Input
        id={id}
        inputMode="numeric"
        placeholder="AAAA-MM-GG"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-40"
        {...props}
      />
      <input
        ref={calendario}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''}
        onChange={(e) => e.target.value && onChange(e.target.value)}
        className="pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
      />
      <button
        type="button"
        aria-label="Apri il calendario"
        onClick={() => calendario.current?.showPicker?.()}
        className="absolute top-1/2 right-14 flex -translate-y-1/2 text-viola outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
      >
        <GlifoCalendario />
      </button>
    </div>
  )
}
