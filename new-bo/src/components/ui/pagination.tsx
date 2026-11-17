// stile C: adattato secondo docs/ui.md
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { GlifoIndietro, GlifoPlay } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// «Pagination → pagination» di docs/ui.md: PaginationLink `link` (32 × 32, bianco), `link-attivo`
// (viola), `freccia` («◀ ▶»), `freccia-disattiva` (senza fondo, bordo e testo inchiostro-200);
// in `lg` 40 × 40, con `freccia-primaria` viola (successiva a 390). I link sono bottoni: la
// pagina sta nello stato della route, non in un href.
// Hover (non disegnato, proposta): viola-100 sui link non attivi.
const paginationLinkVariants = cva(
  'inline-flex shrink-0 items-center justify-center border-2 font-ui outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola',
  {
    variants: {
      variant: {
        link: 'border-inchiostro bg-bianco font-bold text-inchiostro hover:bg-viola-100',
        'link-attivo': 'border-inchiostro bg-viola font-extrabold text-bianco',
        freccia: 'border-inchiostro bg-bianco text-inchiostro hover:bg-viola-100',
        'freccia-disattiva': 'cursor-not-allowed border-inchiostro-200 bg-transparent text-inchiostro-200',
        'freccia-primaria': 'border-inchiostro bg-viola text-bianco',
      },
      size: {
        default: 'size-32 text-md',
        lg: 'size-40 text-md',
      },
    },
    defaultVariants: { variant: 'link', size: 'default' },
  },
)

function Pagination({ className, ...props }: React.ComponentProps<'nav'>) {
  return <nav data-slot="pagination" aria-label="Paginazione" className={cn('flex', className)} {...props} />
}

function PaginationContent({ className, ...props }: React.ComponentProps<'ul'>) {
  return <ul data-slot="pagination-content" className={cn('flex items-center gap-6', className)} {...props} />
}

function PaginationItem(props: React.ComponentProps<'li'>) {
  return <li data-slot="pagination-item" {...props} />
}

function PaginationLink({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof paginationLinkVariants>) {
  return (
    <button
      type="button"
      data-slot="pagination-link"
      aria-current={variant === 'link-attivo' ? 'page' : undefined}
      disabled={variant === 'freccia-disattiva' || props.disabled}
      className={cn(paginationLinkVariants({ variant, size }), className)}
      {...props}
    />
  )
}

function PaginationPrevious({ disabled, size, ...props }: React.ComponentProps<'button'> & { size?: 'default' | 'lg' }) {
  return (
    <PaginationLink aria-label="Pagina precedente" variant={disabled ? 'freccia-disattiva' : 'freccia'} size={size} disabled={disabled} {...props}>
      <GlifoIndietro />
    </PaginationLink>
  )
}

function PaginationNext({
  disabled,
  size,
  primaria,
  ...props
}: React.ComponentProps<'button'> & { size?: 'default' | 'lg'; primaria?: boolean }) {
  return (
    <PaginationLink
      aria-label="Pagina successiva"
      variant={disabled ? 'freccia-disattiva' : primaria ? 'freccia-primaria' : 'freccia'}
      size={size}
      disabled={disabled}
      {...props}
    >
      <GlifoPlay misura="occhiello" />
    </PaginationLink>
  )
}

function PaginationEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span data-slot="pagination-ellipsis" aria-hidden="true" className={cn('px-2 text-md font-bold', className)} {...props}>
      …
    </span>
  )
}

export {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
}
