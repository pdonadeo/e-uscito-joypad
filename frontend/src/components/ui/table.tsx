// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cn } from '@/lib/utils'

// «Table → table» di docs/ui.md.
// - TableHeader: fondo inchiostro; TableHead in text-xs extrabold crema, alta 40 px (36 nelle
//   associazioni, con `bassa`). La colonna ordinata è gialla (aria-sort), le colonne
//   «presente» sono viola-300 (className della pagina).
// - TableRow: bordo linea, testo text-base, righe a zebra bianco/crema; selezionata viola-100
//   (data-state=selected), nuova viola-50 (data-nuova). Hover (non disegnato, proposta): viola-50
//   sulle righe cliccabili (data-cliccabile). La zebra sta sulla riga (`even:`), non sul tbody:
//   così selezionata, nuova e hover vincono anche sulle righe pari. Una tabella senza zebra passa
//   `even:bg-bianco` alle righe.
// Le larghezze delle colonne le dà la pagina con <colgroup>.
function Table({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <table
      data-slot="table"
      className={cn('w-full table-fixed border-collapse font-ui text-inchiostro', className)}
      {...props}
    />
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('bg-inchiostro', className)} {...props} />
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return <tbody data-slot="table-body" className={className} {...props} />
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-linea bg-bianco text-base last:border-b-0 even:bg-crema data-[cliccabile=true]:cursor-pointer data-[cliccabile=true]:hover:bg-viola-50 data-[nuova=true]:bg-viola-50 data-[state=selected]:bg-viola-100 data-[state=selected]:hover:bg-viola-100',
        className,
      )}
      {...props}
    />
  )
}

function TableHead({ className, bassa, ...props }: React.ComponentProps<'th'> & { bassa?: boolean }) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        'whitespace-nowrap text-left align-middle text-xs font-extrabold uppercase tracking-wide text-crema aria-[sort=ascending]:text-giallo aria-[sort=descending]:text-giallo',
        bassa ? 'h-36' : 'h-40',
        className,
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  return <td data-slot="table-cell" className={cn('align-middle', className)} {...props} />
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }
