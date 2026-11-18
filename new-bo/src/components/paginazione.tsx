import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

// Pagination `desktop`, `mobile` e `compatta` di docs/ui.md (F-EP-01: righe per pagina e totale).
// Pagine mostrate (proposta): la prima, l'ultima e quelle vicine alla corrente, con «…» nei buchi.

function pagineVisibili(corrente: number, ultima: number): (number | '…')[] {
  const s = new Set([1, ultima, corrente - 1, corrente, corrente + 1])
  if (corrente <= 3) [2, 3].forEach((n) => s.add(n))
  if (corrente >= ultima - 2) [ultima - 1, ultima - 2].forEach((n) => s.add(n))
  const pagine = [...s].filter((n) => n >= 1 && n <= ultima).sort((a, b) => a - b)
  const out: (number | '…')[] = []
  pagine.forEach((n, i) => {
    if (i > 0 && n - pagine[i - 1] > 1) out.push('…')
    out.push(n)
  })
  return out
}

function SelettoreRighe({
  righe,
  opzioni,
  onRighe,
}: {
  righe: number
  opzioni: readonly number[]
  onRighe: (n: number) => void
}) {
  return (
    <Select value={String(righe)} onValueChange={(v) => onRighe(Number(v))}>
      <SelectTrigger variant="xs" aria-label="Righe per pagina">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opzioni.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Paginazione({
  formato,
  pagina,
  righe,
  totale,
  opzioniRighe,
  onPagina,
  onRighe,
}: {
  formato: 'desktop' | 'mobile'
  pagina: number
  righe: number
  totale: number
  opzioniRighe: readonly number[]
  onPagina: (n: number) => void
  onRighe: (n: number) => void
}) {
  const ultima = Math.max(1, Math.ceil(totale / righe))
  const da = totale === 0 ? 0 : (pagina - 1) * righe + 1
  const a = Math.min(totale, pagina * righe)
  const intervallo = `${da}–${a}`

  if (formato === 'mobile') {
    return (
      <div className="flex flex-col gap-10 border-2 border-inchiostro bg-crema p-12">
        <Pagination className="items-center justify-between">
          <PaginationPrevious size="lg" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} />
          <span className="text-sm font-extrabold uppercase tracking-wide">
            Pagina {pagina} di {ultima}
          </span>
          <PaginationNext size="lg" primaria disabled={pagina >= ultima} onClick={() => onPagina(pagina + 1)} />
        </Pagination>
        <div className="flex items-center justify-between gap-8 text-sm text-inchiostro-600">
          <span>
            {intervallo} di {totale} · righe per pagina
          </span>
          <SelettoreRighe righe={righe} opzioni={opzioniRighe} onRighe={onRighe} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-60 items-center justify-between border-t-2 border-inchiostro bg-crema px-16">
      <div className="flex items-center gap-12">
        <span className="text-xs font-extrabold uppercase tracking-wide">Righe per pagina</span>
        <SelettoreRighe righe={righe} opzioni={opzioniRighe} onRighe={onRighe} />
      </div>
      <div className="flex items-center gap-8">
        <span className="text-xs font-extrabold uppercase tracking-wide">
          {intervallo} di {totale}
        </span>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} />
            </PaginationItem>
            {pagineVisibili(pagina, ultima).map((n, i) =>
              n === '…' ? (
                <PaginationItem key={`e${i}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={n}>
                  <PaginationLink
                    variant={n === pagina ? 'link-attivo' : 'link'}
                    aria-label={`Pagina ${n}`}
                    onClick={() => onPagina(n)}
                  >
                    {n}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}
            <PaginationItem>
              <PaginationNext disabled={pagina >= ultima} onClick={() => onPagina(pagina + 1)} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}

// Pagination `compatta` (episodi citati, F-VG-08): solo «1–4 DI 4 · 25 PER PAGINA».
// Proposta: con più di una pagina compaiono anche «◀ ▶» per scorrere le pagine.
export function PaginazioneCompatta({
  pagina,
  righe,
  totale,
  onPagina,
}: {
  pagina: number
  righe: number
  totale: number
  onPagina: (n: number) => void
}) {
  const ultima = Math.max(1, Math.ceil(totale / righe))
  const da = totale === 0 ? 0 : (pagina - 1) * righe + 1
  const a = Math.min(totale, pagina * righe)
  return (
    <div className="flex items-center justify-end gap-8">
      <span className="text-xs font-extrabold uppercase tracking-wide">
        {da}–{a} di {totale} · {righe} per pagina
      </span>
      {ultima > 1 && (
        <Pagination className="w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext disabled={pagina >= ultima} onClick={() => onPagina(pagina + 1)} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  )
}
