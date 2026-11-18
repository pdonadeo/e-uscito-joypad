import * as React from 'react'
import { cn } from '@/lib/utils'

// Miniatura della cover di un videogame (docs/ui.md, «Table»: 60 × 40 con `border-2`; senza
// cover è tratteggiata `inchiostro-200`). A 390 la scheda la vuole 64 × 44.
// Proposta: se l'immagine non si carica, resta il riquadro pieno `viola-100` con il bordo.
export function MiniaturaCover({ src, className }: { src: string | null | undefined; className?: string }) {
  // l'immagine che non si è caricata: un altro src riparte da capo
  const [rottaSrc, setRottaSrc] = React.useState<string | null>(null)
  const rotta = src != null && rottaSrc === src
  if (!src)
    return (
      <span
        data-testid="miniatura-vuota"
        className={cn('block h-40 w-60 shrink-0 border-2 border-dashed border-inchiostro-200', className)}
      />
    )
  return (
    <span className={cn('block h-40 w-60 shrink-0 overflow-hidden border-2 border-inchiostro bg-viola-100', className)}>
      {!rotta && <img src={src} alt="" className="size-full object-cover" onError={() => setRottaSrc(src)} />}
    </span>
  )
}
