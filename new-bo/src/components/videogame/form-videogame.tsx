import * as React from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BarraAzioni } from '@/components/barra-azioni'
import { Campo } from '@/components/campi'
import { ConfermaEliminazione } from '@/components/conferma-eliminazione'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { GlifoChiudi } from '@/components/pixel-art'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { chiudiErrori, mostraErrore, mostraSuccesso } from '@/components/ui/sonner'
import { Textarea } from '@/components/ui/textarea'
import { EpisodiCitati } from '@/components/videogame/episodi-citati'
import { useDesktop } from '@/lib/formato'
import { eErroreApi, ErroreApi } from '@/lib/graphql'
import { cn } from '@/lib/utils'
import {
  aggiornaVideogame,
  eliminaVideogame,
  episodiCitati,
  jsonLeggibile,
  nomeVideogame,
  videogame as dettaglio,
  type Videogame,
} from '@/lib/videogame'

// «Modifica videogame» (F-VG-04, F-VG-06, F-VG-07, F-VG-08; modifica-videogame-*.png).
// - Si modificano slug, titolo, descrizioni e cover; rawg_json è in sola lettura, formattato, alto
//   al massimo 400 px con scorrimento e senza allargare la pagina.
// - «Salva e continua» come nella modifica episodio (docs/ui.md): resta sulla pagina e il form
//   riparte dai dati restituiti dal server.
// Proposte (non disegnate):
// - senza rawg_json il pannello scuro diventa «★ DATI RAWG ASSENTI» e spiega che salvando si
//   interroga RAWG (F-VG-06); il pannello «RAWG JSON» non c'è;
// - la cover mostrata è quella salvata (non l'URL che si sta scrivendo); senza cover, o se
//   l'immagine non si carica, c'è un riquadro tratteggiato con «Nessuna cover» / «Anteprima non
//   disponibile».

type Valori = {
  rawg_slug: string
  titolo: string
  descrizione_raw: string
  descrizione_html: string
  cover: string
}

type Invio = { continua: boolean }
type Salvataggio = { v: Valori; continua: boolean }

function valoriIniziali(v: Videogame): Valori {
  return {
    rawg_slug: v.rawg_slug,
    titolo: v.titolo ?? '',
    descrizione_raw: v.descrizione_raw ?? '',
    descrizione_html: v.descrizione_html ?? '',
    cover: v.cover ?? '',
  }
}

const oNull = (v: string) => (v.trim() === '' ? null : v)

function dati(v: Valori) {
  return {
    rawg_slug: v.rawg_slug.trim(),
    titolo: oNull(v.titolo),
    descrizione_raw: oNull(v.descrizione_raw),
    descrizione_html: oNull(v.descrizione_html),
    cover: oNull(v.cover),
  }
}

export function FormVideogame({ videogame }: { videogame: Videogame }) {
  const desktop = useDesktop()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [conferma, setConferma] = React.useState(false)
  const [continua, setContinua] = React.useState(false)
  // il numero dei collegamenti è il totale di «Episodi in cui è citato» (stessa query, pagina 1)
  const citati = useQuery(episodiCitati(videogame.id, 1))

  const salva = useMutation({
    mutationFn: ({ v }: Salvataggio) => aggiornaVideogame(videogame.id, dati(v)),
    onSuccess: async (esito, inviato) => {
      if (inviato.continua) {
        // il dettaglio in cache diventa quello salvato (intestazione, cover, RAWG); gli elenchi e
        // gli episodi (che mostrano il titolo del gioco) si rileggeranno quando si riaprono
        const chiave = dettaglio(esito.id).queryKey
        await queryClient.invalidateQueries({ queryKey: ['videogame'], refetchType: 'none' })
        await queryClient.invalidateQueries({ queryKey: ['episodi'], refetchType: 'none' })
        await queryClient.cancelQueries({ queryKey: chiave })
        queryClient.setQueryData(chiave, esito)
        // le modifiche fatte durante l'invio restano, da salvare col prossimo invio
        if (form.state.values === inviato.v) form.reset(valoriIniziali(esito))
        mostraSuccesso('Modifiche salvate')
      } else {
        // si rilegge all'apertura dell'elenco, non qui: la pagina si sta lasciando
        await queryClient.invalidateQueries({ queryKey: ['videogame'], refetchType: 'none' })
        await queryClient.invalidateQueries({ queryKey: ['episodi'], refetchType: 'none' })
        await navigate({ to: '/videogame' })
      }
    },
    onError: (e) => {
      if (!eErroreApi(e, 'UNAUTHENTICATED')) mostraErrore(e.message)
    },
  })

  const elimina = useMutation({
    mutationFn: () => eliminaVideogame(videogame.id),
    onSuccess: async () => {
      setConferma(false)
      queryClient.removeQueries({ queryKey: dettaglio(videogame.id).queryKey })
      queryClient.removeQueries({ queryKey: ['videogame', 'citati', videogame.id] })
      await queryClient.invalidateQueries({ queryKey: ['videogame'], refetchType: 'none' })
      await queryClient.invalidateQueries({ queryKey: ['episodi'], refetchType: 'none' })
      await navigate({ to: '/videogame' })
    },
    onError: (e) => {
      setConferma(false)
      if (!eErroreApi(e, 'UNAUTHENTICATED')) mostraErrore(e.message)
    },
  })

  const form = useForm({
    defaultValues: valoriIniziali(videogame),
    onSubmitMeta: { continua: false } as Invio,
    onSubmit: async ({ value, meta }) => {
      chiudiErrori()
      await salva.mutateAsync({ v: value, continua: meta.continua }).catch((e: unknown) => {
        if (!(e instanceof ErroreApi)) throw e
      })
    },
  })
  const modificato = useStore(form.store, (s) => s.isDirty)

  const invia = (meta: Invio) => {
    if (form.state.isSubmitting) return
    setContinua(meta.continua)
    void form.handleSubmit(meta)
  }

  const testo = (nome: 'rawg_slug' | 'titolo' | 'cover', props: React.ComponentProps<typeof Input> = {}) => (
    <form.Field name={nome}>
      {(f) => (
        <Input
          id={nome}
          name={nome}
          value={f.state.value}
          onChange={(e) => f.handleChange(e.target.value)}
          onBlur={f.handleBlur}
          {...props}
        />
      )}
    </form.Field>
  )

  const areaTesto = (nome: 'descrizione_raw' | 'descrizione_html', size: 'default' | 'sm') => (
    <form.Field name={nome}>
      {(f) => (
        <Textarea
          id={nome}
          size={size}
          className="h-104"
          value={f.state.value}
          onChange={(e) => f.handleChange(e.target.value)}
        />
      )}
    </form.Field>
  )

  const pannelloDati = (
    <Card>
      <CardTitle>Dati del gioco</CardTitle>
      <CardContent className="mt-14 gap-16">
        <Campo etichetta="RAWG slug" htmlFor="rawg_slug" obbligatorio>
          {testo('rawg_slug', { autoComplete: 'off', spellCheck: false, 'aria-required': true })}
        </Campo>
        <Campo etichetta="Titolo" htmlFor="titolo">
          {testo('titolo')}
        </Campo>
        <Campo etichetta="Descrizione (TXT)" htmlFor="descrizione_raw">
          {areaTesto('descrizione_raw', 'default')}
        </Campo>
        <Campo etichetta="Descrizione (HTML)" htmlFor="descrizione_html">
          {areaTesto('descrizione_html', 'sm')}
        </Campo>
        <Campo etichetta="Cover (URL)" htmlFor="cover">
          {testo('cover', { type: 'url', placeholder: 'https://… (facoltativo)' })}
        </Campo>
      </CardContent>
    </Card>
  )

  const pannelloCover = (
    <Card>
      <CardTitle>Cover</CardTitle>
      <CardContent className="mt-14">
        <AnteprimaCover src={videogame.cover} />
      </CardContent>
    </Card>
  )

  const conRawg = videogame.rawg_json != null
  const pannelloStatoRawg = (
    <Card variant="sezione-scura" data-testid="stato-rawg">
      <CardTitle scura>{conRawg ? 'Dati RAWG già presenti' : 'Dati RAWG assenti'}</CardTitle>
      <p className="text-sm leading-ariosa">
        {conRawg
          ? 'Salvando non si interroga RAWG, nemmeno se cambi lo slug: titolo, descrizioni e cover restano quelli scritti qui.'
          : 'Salvando si interroga RAWG con lo slug: titolo, descrizioni e cover arrivano da lì e sostituiscono quelli scritti qui.'}
      </p>
    </Card>
  )

  const pannelloJson = conRawg && (
    <Card className="min-w-0">
      <CardTitle>RAWG JSON · sola lettura</CardTitle>
      <CardContent className="mt-14 gap-10">
        <pre
          role="region"
          tabIndex={0}
          aria-label="RAWG JSON, sola lettura"
          data-testid="rawg-json"
          className="max-h-400 overflow-y-auto border-2 border-inchiostro bg-inchiostro-900 px-14 py-12 font-ui text-xs leading-ariosa break-words whitespace-pre-wrap text-verde-200 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-viola"
        >
          {jsonLeggibile(videogame.rawg_json!)}
        </pre>
        <p className="text-xs text-inchiostro-500">Scorri per leggere tutto. Non si modifica.</p>
      </CardContent>
    </Card>
  )

  const bottoneElimina = (larga: boolean) => (
    <Button
      type="button"
      variant="destructive"
      className={cn(larga && 'w-full')}
      onClick={() => {
        chiudiErrori()
        setConferma(true)
      }}
    >
      <GlifoChiudi misura="bottone" /> Elimina videogame
    </Button>
  )

  // «Salva e continua» non è un submit: INVIO in un campo resta «Salva».
  const barra = (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(invio) => (
        <BarraAzioni
          desktop={desktop}
          invio={invio}
          inCorso={continua ? 'continua' : 'salva'}
          elimina={bottoneElimina(false)}
          annulla={{ to: '/videogame' }}
          etichettaSalva="Salva"
          onContinua={() => invia({ continua: true })}
        />
      )}
    </form.Subscribe>
  )

  return (
    <form
      noValidate
      data-modificato={modificato}
      className="flex min-w-0 flex-col gap-18 lg:gap-20"
      onSubmit={(e) => {
        e.preventDefault()
        invia({ continua: false })
      }}
    >
      <IntestazionePagina
        className="lg:-mb-2"
        indietro={{ to: '/videogame', etichetta: 'Videogame' }}
        titolo={nomeVideogame(videogame)}
      />

      {desktop ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
            {pannelloDati}
            <div className="flex min-w-0 flex-col gap-24">
              {pannelloCover}
              {pannelloStatoRawg}
              {pannelloJson}
            </div>
          </div>
          <EpisodiCitati videogameId={videogame.id} desktop />
          {barra}
        </>
      ) : (
        <>
          {pannelloCover}
          {pannelloStatoRawg}
          {pannelloDati}
          {pannelloJson}
          <EpisodiCitati videogameId={videogame.id} desktop={false} />
          {bottoneElimina(true)}
          {barra}
        </>
      )}

      <ConfermaEliminazione
        aperto={conferma}
        onApertoChange={setConferma}
        titolo="Eliminare il videogame?"
        inCorso={elimina.isPending}
        onConferma={() => elimina.mutate()}
      >
        {testoEliminazione(nomeVideogame(videogame), citati.data?.totale)}
      </ConfermaEliminazione>
    </form>
  )
}

// Testo della conferma (docs/ui.md, «Conferme di eliminazione»): il numero dei collegamenti è
// il totale di «Episodi in cui è citato»; con 0 la frase finisce dopo il titolo. Proposte: con 1
// il singolare; se il totale non è ancora arrivato, «tutti i suoi collegamenti».
function testoEliminazione(nome: string, n: number | undefined): string {
  const titolo = `«${nome}»`
  if (n === 0) return `Stai per eliminare ${titolo}.`
  if (n === 1)
    return `Stai per eliminare ${titolo} e il suo collegamento all'episodio in cui è citato. L'episodio resta nell'archivio.`
  const collegamenti = n == null ? 'tutti i suoi collegamenti' : `i suoi ${n} collegamenti`
  return `Stai per eliminare ${titolo} e ${collegamenti} agli episodi in cui è citato. Gli episodi restano nell'archivio.`
}

// Anteprima della cover nel pannello COVER (proporzioni dei PNG: 340 × 180 circa).
function AnteprimaCover({ src }: { src: string | null | undefined }) {
  // l'immagine che non si è caricata: un altro src riparte da capo
  const [rottaSrc, setRottaSrc] = React.useState<string | null>(null)
  const rotta = src != null && rottaSrc === src
  if (!src || rotta)
    return (
      <div
        data-testid="anteprima-cover"
        className="flex aspect-[17/9] w-full items-center justify-center border-3 border-dashed border-inchiostro-200 bg-bianco"
      >
        <span className="text-xs font-extrabold uppercase tracking-wide text-inchiostro-400">
          {src ? 'Anteprima non disponibile' : 'Nessuna cover'}
        </span>
      </div>
    )
  return (
    <div data-testid="anteprima-cover" className="aspect-[17/9] w-full overflow-hidden border-3 border-inchiostro bg-rosa-200">
      <img src={src} alt="" className="size-full object-cover" onError={() => setRottaSrc(src)} />
    </div>
  )
}
