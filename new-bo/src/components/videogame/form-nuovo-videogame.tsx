import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BarraAzioni } from '@/components/barra-azioni'
import { Campo } from '@/components/campi'
import { GlifoAvviso } from '@/components/pixel-art'
import { Alert } from '@/components/ui/alert'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { chiudiErrori, mostraErrore } from '@/components/ui/sonner'
import { Textarea } from '@/components/ui/textarea'
import { useDesktop } from '@/lib/formato'
import { eErroreApi } from '@/lib/graphql'
import { creaVideogame, type Videogame } from '@/lib/videogame'
import { cn } from '@/lib/utils'

// «Nuovo videogame» (F-VG-05, nuovo-videogame-*.png): serve solo lo slug RAWG; titolo,
// descrizioni e cover arrivano sempre da RAWG, quindi i loro campi sono disattivati con
// «arriva da RAWG». Gli errori del server (RAWG compreso) vanno nel Toast.
//
// Il componente non naviga: a creazione riuscita chiama `onCreato` con il videogame creato, e
// ANNULLA chiama `onAnnulla`. Decide chi lo usa (la route apre la modifica; in futuro un Dialog
// dentro la modifica episodio).
//
// Proposte (non disegnate):
// - lo slug è rosso (Input `errore`) dopo un BAD_USER_INPUT, cioè gioco non trovato, slug già
//   usato o non valido; torna normale appena si cambia;
// - placeholder dello slug «es. chrono-trigger»; il prefisso «rawg.io/games/» c'è solo su
//   desktop, come nei PNG.

export type PropsFormNuovoVideogame = {
  onCreato: (v: Videogame) => void
  onAnnulla: () => void
}

export function FormNuovoVideogame({ onCreato, onAnnulla }: PropsFormNuovoVideogame) {
  const desktop = useDesktop()
  const queryClient = useQueryClient()
  const [slug, setSlug] = React.useState('')
  const [slugErrato, setSlugErrato] = React.useState(false)
  // id unici: il form potrà stare in un Dialog dentro la modifica episodio, che ha già «titolo»
  const id = React.useId()
  const ids = {
    slug: `${id}-rawg_slug`,
    aiuto: `${id}-rawg_slug-aiuto`,
    titolo: `${id}-titolo`,
    descrizioneRaw: `${id}-descrizione_raw`,
    descrizioneHtml: `${id}-descrizione_html`,
    cover: `${id}-cover`,
  }

  const crea = useMutation({
    mutationFn: (rawg_slug: string) => creaVideogame({ rawg_slug }),
    onSuccess: async (v) => {
      // elenco e scelta del videogame di un'associazione devono vedere il nuovo videogame
      await queryClient.invalidateQueries({ queryKey: ['videogame'] })
      onCreato(v)
    },
    onError: (e) => {
      if (eErroreApi(e, 'UNAUTHENTICATED')) return
      setSlugErrato(eErroreApi(e, 'BAD_USER_INPUT'))
      mostraErrore(e.message)
    },
  })

  const campoSlug = (
    <div
      className={cn(
        'flex h-44 items-center border-3 border-inchiostro bg-bianco px-12 font-ui text-lg focus-within:border-viola',
        slugErrato && 'border-rosso focus-within:border-rosso',
      )}
    >
      {desktop && (
        <span aria-hidden="true" className="shrink-0 text-inchiostro-400">
          rawg.io/games/
        </span>
      )}
      <input
        id={ids.slug}
        name="rawg_slug"
        autoComplete="off"
        spellCheck={false}
        aria-required="true"
        aria-invalid={slugErrato || undefined}
        aria-describedby={ids.aiuto}
        placeholder="es. chrono-trigger"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value)
          setSlugErrato(false)
        }}
        className="h-full min-w-0 flex-1 bg-transparent font-bold text-inchiostro outline-none placeholder:font-normal placeholder:text-inchiostro-300"
      />
    </div>
  )

  const pannelloRawg = (
    <Card>
      <CardTitle>Gioco su RAWG</CardTitle>
      <CardContent className="mt-14 gap-12">
        <Campo etichetta="RAWG slug" htmlFor={ids.slug} obbligatorio>
          {campoSlug}
        </Campo>
        <p id={ids.aiuto} className="text-sm leading-compatta">
          Solo lettere, cifre, - e _. È l'ultima parte dell'indirizzo del gioco su rawg.io.
        </p>
      </CardContent>
    </Card>
  )

  const questLog = (
    <Card variant="sezione-scura">
      <CardTitle scura>Quest log</CardTitle>
      <ol className="flex flex-col text-sm leading-ariosa">
        <li>1. Scrivi lo slug del gioco su RAWG.</li>
        <li>
          2. Premi «Crea da RAWG»: titolo, descrizioni e cover arrivano da RAWG e sostituiscono quello che c'è nei
          campi.
        </li>
        <li>3. Si apre la modifica del nuovo videogame.</li>
      </ol>
    </Card>
  )

  const daRawg = 'arriva da RAWG'
  const pannelloDati = (
    <Card>
      <CardTitle>Dati del gioco</CardTitle>
      <CardContent className="mt-14 gap-16">
        <Alert variant="warning" icona={<GlifoAvviso />} role="note">
          <span className="uppercase">Non compilare manualmente:</span> viene preso da RAWG
        </Alert>
        <Campo etichetta="Titolo" htmlFor={ids.titolo}>
          <Input id={ids.titolo} disabled placeholder={daRawg} />
        </Campo>
        <Campo etichetta="Descrizione (TXT)" htmlFor={ids.descrizioneRaw}>
          <Textarea id={ids.descrizioneRaw} disabled placeholder={daRawg} className="h-104" />
        </Campo>
        <Campo etichetta="Descrizione (HTML)" htmlFor={ids.descrizioneHtml}>
          <Textarea id={ids.descrizioneHtml} disabled placeholder={daRawg} className="h-104" />
        </Campo>
        <Campo etichetta="Cover (URL)" htmlFor={ids.cover}>
          <Input id={ids.cover} disabled placeholder={daRawg} />
        </Campo>
      </CardContent>
    </Card>
  )

  const barra = (
    <BarraAzioni
      desktop={desktop}
      invio={crea.isPending}
      inCorso="salva"
      annulla={{ onClick: onAnnulla }}
      etichettaSalva="Crea da RAWG"
    />
  )

  return (
    <form
      noValidate
      className="flex flex-col gap-18 lg:gap-20"
      onSubmit={(e) => {
        e.preventDefault()
        // in un Dialog (portal) l'evento risalirebbe fino al form che lo contiene
        e.stopPropagation()
        if (crea.isPending) return
        chiudiErrori()
        crea.mutate(slug.trim())
      }}
    >
      {desktop ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-24">
              {pannelloRawg}
              {pannelloDati}
            </div>
            {questLog}
          </div>
          {barra}
        </>
      ) : (
        <>
          {pannelloRawg}
          {questLog}
          {pannelloDati}
          {barra}
        </>
      )}
    </form>
  )
}
