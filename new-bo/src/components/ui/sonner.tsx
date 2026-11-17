// stile C: adattato secondo docs/ui.md
import { Toaster as Sonner, toast } from 'sonner'
import { GlifoChiudi } from '@/components/pixel-art'

// «Toast → sonner» di docs/ui.md: una sola variante, `destructive`. Ogni Toast è un toast.custom
// con il disegno dello stile C (i colori di sonner non si usano).
// - Desktop: in alto a destra, 24 px dal bordo e 20 px sotto la barra app (64 + 20), 420 px.
// - 390: ui.md lo vuole nel flusso, in cima al contenuto. sonner lo tiene fisso: qui sta in alto,
//   16 px sotto la Barra app mobile (56 + 16) e a tutta larghezza meno i margini di 16 px.
//   È uno scostamento da approvare.
// Durata (non disegnata, proposta): resta finché non si chiude con «✕» o non si invia di nuovo.
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

function Toast({ id, messaggio }: { id: string | number; messaggio: string }) {
  return (
    <div
      role="alert"
      data-slot="toast"
      className="flex w-full items-start gap-12 border-3 border-rosso bg-rosa p-14 font-ui text-inchiostro shadow-pixel-lg sm:w-420"
    >
      <span aria-hidden="true" className="flex h-20 shrink-0 items-center text-rosso">
        <GlifoChiudi misura="piccolo" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <p className="text-xs font-extrabold uppercase tracking-wide text-rosso">Missione fallita</p>
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
  toast.custom((id) => <Toast id={id} messaggio={messaggio} />, { duration: Infinity })
}

function chiudiErrori() {
  toast.dismiss()
}

export { Toaster, mostraErrore, chiudiErrori }
