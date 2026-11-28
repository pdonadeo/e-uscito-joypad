import * as React from 'react'
import { useIsMutating } from '@tanstack/react-query'
import { chiudiErrori } from '@/components/ui/sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { CHIAVE_CREA_VIDEOGAME, FormNuovoVideogame } from '@/components/videogame/form-nuovo-videogame'
import { slugDa, type Videogame } from '@/lib/videogame'

// «Nuovo videogame dal form dell'episodio» (docs/ui.md, «Schermate non disegnate»): il Dialog
// grande con dentro FormNuovoVideogame così com'è. Lo slug parte dal testo cercato nel Combobox.
// - ANNULLA, «✕», ESC e il clic sul velo chiudono senza creare nulla, e tolgono l'eventuale
//   Toast d'errore (che senza il Dialog non avrebbe più contesto). Mentre CREA DA RAWG è in corso
//   il Dialog non si chiude: la risposta deve trovare la riga da cui era partito.
// - All'apertura il focus va sullo slug; dopo la chiusura dove dice `onFocusDopo` (il campo
//   videogame della riga), non sul bottone che l'ha aperto, che stava nel Combobox ormai chiuso.

// `n` distingue due aperture di fila: il form riparte da capo anche se il Dialog si riapre
// durante la dissolvenza di chiusura.
export type RichiestaNuovoVideogame = { n: number; testo: string }

export function DialogNuovoVideogame({
  richiesta,
  onCreato,
  onChiudi,
  onFocusDopo,
}: {
  richiesta: RichiestaNuovoVideogame | null
  onCreato: (v: Videogame) => void
  onChiudi: () => void
  onFocusDopo: () => void
}) {
  // durante la dissolvenza di chiusura il contenuto resta quello di prima
  const [ultima, setUltima] = React.useState(richiesta)
  if (richiesta != null && richiesta !== ultima) setUltima(richiesta)
  const mostrata = richiesta ?? ultima
  const inCorso = useIsMutating({ mutationKey: CHIAVE_CREA_VIDEOGAME }) > 0

  const annulla = () => {
    if (inCorso) return
    chiudiErrori()
    onChiudi()
  }

  return (
    <Dialog open={richiesta != null} onOpenChange={(aperto) => !aperto && annulla()}>
      <DialogContent
        titolo="Nuovo videogame"
        descrizione="Crea un videogame da RAWG senza lasciare l'episodio."
        onOpenAutoFocus={(e) => {
          const slug = document.querySelector<HTMLInputElement>('[data-slot=dialog-content] input[name=rawg_slug]')
          if (slug) {
            e.preventDefault()
            slug.focus()
          }
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          onFocusDopo()
        }}
      >
        {mostrata && (
          <FormNuovoVideogame
            key={mostrata.n}
            slugIniziale={slugDa(mostrata.testo)}
            passoFinale="Il videogame finisce nella riga dell'episodio, che resta da salvare."
            onCreato={onCreato}
            onAnnulla={annulla}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
