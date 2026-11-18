// stile C: adattato secondo docs/ui.md
import { Toaster as Sonner, toast } from 'sonner'
import { GlifoChiudi, GlifoSpunta } from '@/components/pixel-art'
import { cn } from '@/lib/utils'

// «Toast → sonner» di docs/ui.md: varianti `destructive` (errori) e `success` (conferma di
// «Salva e continua», proposta). Ogni Toast è un toast.custom con il disegno dello stile C
// (i colori di sonner non si usano).
// - Desktop: in alto a destra, 24 px dal bordo e 20 px sotto la barra app (64 + 20), 420 px.
// - 390: ui.md lo vuole nel flusso, in cima al contenuto. sonner lo tiene fisso: qui sta in alto,
//   16 px sotto la Barra app mobile (56 + 16) e a tutta larghezza meno i margini di 16 px.
//   È uno scostamento da approvare.
// Durata (non disegnata, proposta): `destructive` resta finché non si chiude con «✕» o non si
// invia di nuovo; `success` si chiude da solo dopo DURATA_SUCCESSO (sonner ferma il conto alla
// rovescia mentre il puntatore è sopra il Toast o la scheda è nascosta), oppure con «✕».
const DURATA_SUCCESSO = 4000

function Toaster() {
  return (
    <Sonner
      position="top-right"
      offset={{ top: 84, right: 24 }}
      mobileOffset={{ top: 72, left: 16, right: 16 }}
      gap={12}
      visibleToasts={3}
      toastOptions={{ unstyled: true }}
      style={{ ['--width' as string]: '420px' }}
    />
  )
}

type Variante = 'destructive' | 'success'

const VARIANTI = {
  destructive: {
    ruolo: 'alert',
    contenitore: 'border-rosso bg-rosa',
    colore: 'text-rosso',
    occhiello: 'Missione fallita',
    glifo: <GlifoChiudi misura="piccolo" />,
  },
  success: {
    ruolo: 'status',
    contenitore: 'border-verde-600 bg-verde-100',
    colore: 'text-verde-700',
    occhiello: 'Checkpoint',
    glifo: <GlifoSpunta misura="riga" className="text-verde-600" />,
  },
} as const

function Toast({ id, messaggio, variante }: { id: string | number; messaggio: string; variante: Variante }) {
  const v = VARIANTI[variante]
  return (
    <div
      role={v.ruolo}
      data-slot="toast"
      data-variant={variante}
      className={cn(
        'flex w-full items-start gap-12 border-3 p-14 font-ui text-inchiostro shadow-pixel-lg sm:w-420',
        v.contenitore,
      )}
    >
      <span aria-hidden="true" className={cn('flex h-20 shrink-0 items-center', v.colore)}>
        {v.glifo}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className={cn('text-xs font-extrabold uppercase tracking-wide', v.colore)}>{v.occhiello}</p>
        <p className="text-base font-bold leading-titolo">{messaggio}</p>
      </div>
      <button
        type="button"
        aria-label="Chiudi l'avviso"
        onClick={() => toast.dismiss(id)}
        className="flex size-20 shrink-0 items-center justify-center text-inchiostro outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
      >
        <GlifoChiudi misura="bottone" />
      </button>
    </div>
  )
}

// Mostra un errore del server nel Toast. Un nuovo errore sostituisce il precedente.
function mostraErrore(messaggio: string) {
  toast.dismiss()
  toast.custom((id) => <Toast id={id} messaggio={messaggio} variante="destructive" />, { duration: Infinity })
}

// Conferma di un salvataggio riuscito, nella stessa posizione. Sostituisce l'avviso precedente.
function mostraSuccesso(messaggio: string) {
  toast.dismiss()
  toast.custom((id) => <Toast id={id} messaggio={messaggio} variante="success" />, { duration: DURATA_SUCCESSO })
}

function chiudiErrori() {
  toast.dismiss()
}

export { Toaster, mostraErrore, mostraSuccesso, chiudiErrori }
