import * as React from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BarraAzioni } from '@/components/barra-azioni'
import { Campo, InputData } from '@/components/campi'
import { ConfermaEliminazione } from '@/components/conferma-eliminazione'
import { PannelloCover, type SceltaCover } from '@/components/episodi/cover'
import { SceltaVideogame } from '@/components/episodi/scelta-videogame'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { GlifoChiudi, GlifoOrdine, GlifoSpunta } from '@/components/pixel-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { chiudiErrori, mostraErrore, mostraSuccesso } from '@/components/ui/sonner'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  aggiornaEpisodio,
  caricaCover,
  episodio as dettaglio,
  creaEpisodio,
  durataBreve,
  eliminaEpisodio,
  nomeEpisodio,
  rimuoviCover,
  SPEAKER,
  TIPOLOGIA,
  type Episodio,
  type Speaker,
  type Tipologia,
} from '@/lib/episodi'
import { useDesktop } from '@/lib/formato'
import { eErroreApi, ErroreApi } from '@/lib/graphql'
import { cn } from '@/lib/utils'

// «Modifica episodio» (F-EP-05, F-EP-07, F-EP-09, F-EP-10, F-EP-11, F-AS-03) e «Nuovo episodio»
// (F-EP-06), che è la stessa schermata con le differenze di docs/ui.md («Schermate non
// disegnate»). Il salvataggio è pessimistico: aspetta il server, poi carica o toglie la cover.
// «Salva e continua» (solo nella modifica) salva come «Salva» ma resta sulla pagina: il form si
// reimposta con i dati restituiti dal server e torna «non modificato».

type Riga = {
  chiave: string
  id: number | null
  videogame_id: number | null
  videogame_titolo: string
  istante: string
  speaker: Speaker
  tipologia: Tipologia
  nuova: boolean
}

type Valori = {
  titolo: string
  episodio_numero: string
  durata: string
  data_uscita: string
  pubblicato: boolean
  url: string
  url_post: string
  url_video: string
  descrizione_txt: string
  descrizione_html: string
  note: string
  associazioni: Riga[]
}

// Quale bottone ha inviato il form: «Salva»/«Crea» (anche con INVIO) o «Salva e continua».
type Invio = { continua: boolean }
type Salvataggio = { v: Valori; cover: SceltaCover; continua: boolean }

let contatore = 0
const nuovaChiave = () => `r${++contatore}`

// Una riga nuova ha istante 0:00:00, speaker «Tutti» e tipologia «Chiacchiera libera» (F-EP-09).
const rigaNuova = (): Riga => ({
  chiave: nuovaChiave(),
  id: null,
  videogame_id: null,
  videogame_titolo: '',
  istante: '0:00:00',
  speaker: 'TUTT',
  tipologia: 'FREE',
  nuova: true,
})

function valoriIniziali(e: Episodio | null): Valori {
  if (!e)
    // F-EP-06: durata 0:30:00, pubblicato spento, il resto vuoto
    return {
      titolo: '',
      episodio_numero: '',
      durata: '0:30:00',
      data_uscita: '',
      pubblicato: false,
      url: '',
      url_post: '',
      url_video: '',
      descrizione_txt: '',
      descrizione_html: '',
      note: '',
      associazioni: [],
    }
  return {
    titolo: e.titolo,
    episodio_numero: e.episodio_numero ?? '',
    durata: durataBreve(e.durata),
    data_uscita: e.data_uscita,
    pubblicato: e.pubblicato,
    url: e.url ?? '',
    url_post: e.url_post ?? '',
    url_video: e.url_video ?? '',
    descrizione_txt: e.descrizione_txt ?? '',
    descrizione_html: e.descrizione_html ?? '',
    note: e.note ?? '',
    // chiave stabile per le righe salvate: gli stessi dati danno gli stessi valori iniziali
    associazioni: e.associazioni.map((a) => ({
      chiave: `a${a.id}`,
      id: a.id,
      videogame_id: a.videogame_id,
      videogame_titolo: a.videogame_titolo ?? '',
      istante: durataBreve(a.istante),
      speaker: a.speaker,
      tipologia: a.tipologia,
      nuova: false,
    })),
  }
}

const oNull = (v: string) => (v.trim() === '' ? null : v)

// I campi vuoti diventano null (URL, numero, descrizioni, note, istante); le associazioni si
// mandano sempre, così la lista sostituisce quella salvata (F-EP-09).
function dati(v: Valori) {
  return {
    titolo: v.titolo,
    episodio_numero: oNull(v.episodio_numero),
    durata: v.durata,
    data_uscita: v.data_uscita,
    pubblicato: v.pubblicato,
    url: oNull(v.url),
    url_post: oNull(v.url_post),
    url_video: oNull(v.url_video),
    descrizione_txt: oNull(v.descrizione_txt),
    descrizione_html: oNull(v.descrizione_html),
    note: oNull(v.note),
    associazioni: v.associazioni.map((a) => ({
      id: a.id,
      videogame_id: a.videogame_id as number,
      istante: oNull(a.istante),
      speaker: a.speaker,
      tipologia: a.tipologia,
    })),
  }
}

// Messaggio (proposta) quando una riga di «Videogiochi citati» non ha il videogame: il contratto
// lo vuole obbligatorio (videogame_id: Int!), quindi il controllo si fa prima dell'invio.
const MANCA_VIDEOGAME = 'Campo «videogame»: scegli il videogame in ogni riga di «Videogiochi citati»'

export function FormEpisodio({ episodio }: { episodio: Episodio | null }) {
  const nuovo = episodio == null
  const desktop = useDesktop()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [cover, setCover] = React.useState<SceltaCover>({ file: null, rimuovi: false })
  const [conferma, setConferma] = React.useState(false)
  const [mostraInvalidi, setMostraInvalidi] = React.useState(false)
  const [daAprire, setDaAprire] = React.useState<string | null>(null)
  const [continua, setContinua] = React.useState(false)

  const salva = useMutation({
    mutationFn: async ({ v, cover, continua }: Salvataggio): Promise<Episodio | number> => {
      if (episodio == null) {
        const id = await creaEpisodio(dati(v))
        if (cover.file) {
          try {
            await caricaCover(id, cover.file)
          } catch (e) {
            // F-EP-10: se l'upload fallisce l'episodio appena creato si cancella, così un nuovo
            // salvataggio non crea un doppione
            await eliminaEpisodio(id).catch(() => undefined)
            throw e
          }
        }
        return id
      }
      const salvato = await aggiornaEpisodio(episodio.id, dati(v))
      const conCover = cover.file != null || (cover.rimuovi && episodio.cover != null)
      if (cover.file) await caricaCover(episodio.id, cover.file)
      else if (cover.rimuovi && episodio.cover) await rimuoviCover(episodio.id)
      if (!continua) return episodio.id
      // la cover cambia dopo la mutation: in quel caso il dettaglio si rilegge
      return conCover ? await queryClient.fetchQuery(dettaglio(episodio.id)) : salvato
    },
    onSuccess: async (esito, inviato) => {
      if (nuovo) {
        // Dopo «Crea» si apre la modifica (F-EP-06).
        await queryClient.invalidateQueries({ queryKey: ['episodi'] })
        await navigate({ to: '/episodi/$id', params: { id: esito as number } })
      } else if (typeof esito === 'object') {
        // «Salva e continua»: gli elenchi si rileggeranno quando si riaprono; il dettaglio in
        // cache diventa quello salvato (intestazione e cover), senza che una rilettura già
        // partita lo sovrascriva con dati vecchi.
        const chiave = dettaglio(esito.id).queryKey
        await queryClient.invalidateQueries({ queryKey: ['episodi'], refetchType: 'none' })
        await queryClient.cancelQueries({ queryKey: chiave })
        queryClient.setQueryData(chiave, esito)
        // Il form riparte dai dati salvati solo se durante l'invio non è cambiato nulla: le
        // modifiche fatte nel frattempo restano, da salvare col prossimo invio (le righe ancora
        // senza id si reinseriscono, il server non le duplica).
        if (form.state.values === inviato.v) {
          form.reset(valoriIniziali(esito))
          setMostraInvalidi(false)
          setDaAprire(null)
        }
        setCover((c) => (c === inviato.cover ? { file: null, rimuovi: false } : c))
        mostraSuccesso('Modifiche salvate')
      } else {
        // Dopo «Salva» si torna all'elenco (prototipo).
        await queryClient.invalidateQueries({ queryKey: ['episodi'] })
        await navigate({ to: '/episodi' })
      }
    },
    onError: (e) => {
      if (!eErroreApi(e, 'UNAUTHENTICATED')) mostraErrore(e.message)
    },
  })

  const elimina = useMutation({
    mutationFn: () => eliminaEpisodio(episodio!.id),
    onSuccess: async () => {
      setConferma(false)
      queryClient.removeQueries({ queryKey: ['episodi', 'dettaglio', episodio!.id] })
      await queryClient.invalidateQueries({ queryKey: ['episodi'] })
      await navigate({ to: '/episodi' })
    },
    onError: (e) => {
      setConferma(false)
      if (!eErroreApi(e, 'UNAUTHENTICATED')) mostraErrore(e.message)
    },
  })

  const form = useForm({
    defaultValues: valoriIniziali(episodio),
    onSubmitMeta: { continua: false } as Invio,
    onSubmit: async ({ value, meta }) => {
      chiudiErrori()
      if (value.associazioni.some((a) => a.videogame_id == null)) {
        setMostraInvalidi(true)
        mostraErrore(MANCA_VIDEOGAME)
        return
      }
      await salva.mutateAsync({ v: value, cover, continua: meta.continua }).catch((e: unknown) => {
        if (!(e instanceof ErroreApi)) throw e
      })
    },
  })
  // «non modificato»: nessun campo toccato dall'ultimo caricamento o salvataggio, cover compresa
  const modificato = useStore(form.store, (s) => s.isDirty) || cover.file != null || cover.rimuovi

  const invia = (meta: Invio) => {
    if (form.state.isSubmitting) return
    setContinua(meta.continua)
    void form.handleSubmit(meta)
  }

  const testoCampo = (
    nome: 'titolo' | 'episodio_numero' | 'durata' | 'url' | 'url_post' | 'url_video',
    props: React.ComponentProps<typeof Input> = {},
  ) => (
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

  const pannelloDati = (
    <Card>
      <CardTitle>Dati episodio</CardTitle>
      <CardContent className="mt-16 gap-16">
        <Campo etichetta="Titolo" htmlFor="titolo" obbligatorio>
          {testoCampo('titolo')}
        </Campo>
        <div className="grid grid-cols-2 gap-12 lg:grid-cols-3">
          <Campo etichetta="Numero" htmlFor="episodio_numero">
            {testoCampo('episodio_numero')}
          </Campo>
          <Campo etichetta="Durata" htmlFor="durata" obbligatorio>
            {testoCampo('durata', { placeholder: 'H:MM:SS', inputMode: 'numeric' })}
          </Campo>
          <Campo etichetta="Data uscita" htmlFor="data_uscita" obbligatorio className="col-span-2 lg:col-span-1">
            <form.Field name="data_uscita">
              {(f) => <InputData id="data_uscita" name="data_uscita" value={f.state.value} onChange={f.handleChange} />}
            </form.Field>
          </Campo>
        </div>
        <form.Field name="pubblicato">
          {(f) => (
            <div className="flex items-center gap-12">
              <Switch id="pubblicato" checked={f.state.value} onCheckedChange={f.handleChange} />
              <Label htmlFor="pubblicato" className="text-xs">
                Pubblicato
              </Label>
            </div>
          )}
        </form.Field>
      </CardContent>
    </Card>
  )

  const pannelloDescrizioni = (
    <Card>
      <CardTitle>Descrizioni e note</CardTitle>
      <CardContent className="mt-16 gap-16">
        <Campo etichetta="Descrizione (TXT)" htmlFor="descrizione_txt">
          <form.Field name="descrizione_txt">
            {(f) => (
              <Textarea
                id="descrizione_txt"
                className="h-104"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </Campo>
        <Campo etichetta="Descrizione (HTML)" htmlFor="descrizione_html">
          <form.Field name="descrizione_html">
            {(f) => (
              <Textarea
                id="descrizione_html"
                size="sm"
                className="h-104"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </Campo>
        <Campo etichetta="Note libere" htmlFor="note">
          <form.Field name="note">
            {(f) => (
              <Textarea
                id="note"
                size="sm"
                className="h-80"
                placeholder="Per i redattori: non compaiono sul sito"
                value={f.state.value}
                onChange={(e) => f.handleChange(e.target.value)}
              />
            )}
          </form.Field>
        </Campo>
      </CardContent>
    </Card>
  )

  const pannelloCover = (
    <Card>
      <CardTitle>Cover</CardTitle>
      <CardContent className="mt-16">
        <PannelloCover
          cover={episodio?.cover ?? null}
          coverUrl={episodio?.cover_url ?? null}
          scelta={cover}
          onScelta={setCover}
          nuovo={nuovo}
        />
      </CardContent>
    </Card>
  )

  const pannelloLink = (
    <Card>
      <CardTitle>Link</CardTitle>
      <CardContent className="mt-16 gap-16">
        {(
          [
            ['url', 'URL audio'],
            ['url_post', 'URL post'],
            ['url_video', 'URL video'],
          ] as const
        ).map(([nome, etichetta]) => (
          <Campo key={nome} etichetta={etichetta} htmlFor={nome}>
            {testoCampo(nome, { type: 'url', placeholder: 'https://… (facoltativo)', className: 'text-base' })}
          </Campo>
        ))}
      </CardContent>
    </Card>
  )

  const pannelloAssociazioni = (
    <form.Field name="associazioni" mode="array">
      {(campo) => (
        <Card>
          <CardTitle>Videogiochi citati · {campo.state.value.length}</CardTitle>
          <CardContent className="mt-16 gap-14">
            {desktop ? (
              campo.state.value.length > 0 && (
                <div className="border-2 border-inchiostro">
                  <Table>
                    <colgroup>
                      <col />
                      <col className="w-122 xl:w-132" />
                      <col className="w-272 xl:w-282" />
                      <col className="w-292 xl:w-312" />
                      <col className="w-64" />
                    </colgroup>
                    <TableHeader>
                      <tr>
                        <TableHead bassa className="pl-12">
                          Videogame *
                        </TableHead>
                        <TableHead bassa aria-sort="ascending" className="pl-12">
                          <span className="inline-flex items-center gap-8">
                            Istante <GlifoOrdine verso="su" />
                          </span>
                        </TableHead>
                        <TableHead bassa className="pl-12">
                          Tipologia
                        </TableHead>
                        <TableHead bassa className="pl-12">
                          Speaker
                        </TableHead>
                        <TableHead bassa>
                          <span className="sr-only">Azioni</span>
                        </TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {campo.state.value.map((riga, i) => (
                        <TableRow key={riga.chiave} data-nuova={riga.nuova} className="h-60 even:bg-bianco">
                          <TableCell className="pl-12">{cellaVideogame(i, riga)}</TableCell>
                          <TableCell className="pl-12">{cellaIstante(i)}</TableCell>
                          <TableCell className="pl-12">{cellaScelta(i, 'tipologia', 'tabella')}</TableCell>
                          <TableCell className="pl-12">{cellaScelta(i, 'speaker', 'tabella')}</TableCell>
                          <TableCell className="px-12">{bottoneRimuovi(i, riga, () => campo.removeValue(i))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              <ul className="flex flex-col gap-14">
                {campo.state.value.map((riga, i) => (
                  <li
                    key={riga.chiave}
                    data-testid="scheda-associazione"
                    className={cn('flex flex-col gap-12 border-2 border-inchiostro p-12', riga.nuova ? 'bg-viola-50' : 'bg-bianco')}
                  >
                    <div className="flex flex-col gap-8">
                      <span className="text-xs font-extrabold uppercase tracking-wide">Videogame *</span>
                      <div className="flex items-center gap-8">
                        {cellaVideogame(i, riga)}
                        {bottoneRimuovi(i, riga, () => campo.removeValue(i))}
                      </div>
                    </div>
                    <Campo etichetta="Istante" htmlFor={`istante-${riga.chiave}`}>
                      {cellaIstante(i, `istante-${riga.chiave}`, 'w-96')}
                    </Campo>
                    <Campo etichetta="Tipologia" htmlFor={`tipologia-${riga.chiave}`}>
                      {cellaScelta(i, 'tipologia', 'default', `tipologia-${riga.chiave}`)}
                    </Campo>
                    <Campo etichetta="Speaker" htmlFor={`speaker-${riga.chiave}`}>
                      {cellaScelta(i, 'speaker', 'default', `speaker-${riga.chiave}`)}
                    </Campo>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="dashed"
              className="w-full"
              onClick={() => {
                const r = rigaNuova()
                campo.pushValue(r)
                setDaAprire(r.chiave)
              }}
            >
              + Aggiungi videogame
            </Button>
          </CardContent>
        </Card>
      )}
    </form.Field>
  )

  // Celle di una riga delle associazioni: le stesse a 390 (scheda) e su desktop (tabella).
  function cellaVideogame(i: number, riga: Riga) {
    return (
      <form.Field name={`associazioni[${i}].videogame_titolo`}>
        {(t) => (
          <form.Field name={`associazioni[${i}].videogame_id`}>
            {(f) => (
              <SceltaVideogame
                etichetta={`Videogame, riga ${i + 1}`}
                valore={f.state.value == null ? null : { id: f.state.value, titolo: t.state.value }}
                invalido={mostraInvalidi && f.state.value == null}
                apriSubito={daAprire === riga.chiave}
                onScegli={(v) => {
                  t.handleChange(v.titolo)
                  f.handleChange(v.id)
                }}
              />
            )}
          </form.Field>
        )}
      </form.Field>
    )
  }

  function cellaIstante(i: number, id?: string, className?: string) {
    return (
      <form.Field name={`associazioni[${i}].istante`}>
        {(f) => (
          <Input
            id={id}
            inputSize="sm"
            aria-label={id ? undefined : `Istante, riga ${i + 1}`}
            placeholder="H:MM:SS"
            inputMode="numeric"
            className={className}
            value={f.state.value}
            onChange={(e) => f.handleChange(e.target.value)}
          />
        )}
      </form.Field>
    )
  }

  function cellaScelta(i: number, tipo: 'speaker' | 'tipologia', variant: 'default' | 'tabella', id?: string) {
    const voci = tipo === 'speaker' ? SPEAKER : TIPOLOGIA
    const nome = tipo === 'speaker' ? 'Speaker' : 'Tipologia'
    return (
      <form.Field name={`associazioni[${i}].${tipo}`}>
        {(f) => (
          <Select value={f.state.value} onValueChange={(v) => f.handleChange(v as Speaker & Tipologia)}>
            <SelectTrigger id={id} variant={variant} aria-label={id ? undefined : `${nome}, riga ${i + 1}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {voci.map((o) => (
                <SelectItem key={o.valore} value={o.valore}>
                  {o.etichetta}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </form.Field>
    )
  }

  function bottoneRimuovi(i: number, riga: Riga, rimuovi: () => void) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="icon"
        aria-label={`Rimuovi ${riga.videogame_titolo || `la riga ${i + 1}`}`}
        onClick={rimuovi}
      >
        <GlifoChiudi misura="piccolo" />
      </Button>
    )
  }

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
      <GlifoChiudi misura="bottone" /> Elimina episodio
    </Button>
  )

  // «Salva e continua» non è un submit: INVIO in un campo resta «Salva» (il primo submit del form).
  const barra = (
    <form.Subscribe selector={(s) => s.isSubmitting}>
      {(invio) => (
        <BarraAzioni
          desktop={desktop}
          invio={invio}
          inCorso={continua ? 'continua' : 'salva'}
          elimina={!nuovo && bottoneElimina(false)}
          annulla={{ to: '/episodi' }}
          etichettaSalva={nuovo ? 'Crea' : 'Salva'}
          onContinua={nuovo ? undefined : () => invia({ continua: true })}
        />
      )}
    </form.Subscribe>
  )

  return (
    <form
      noValidate
      data-modificato={modificato}
      className="flex flex-col gap-18 lg:gap-20"
      onSubmit={(e) => {
        e.preventDefault()
        invia({ continua: false })
      }}
    >
      <IntestazionePagina
        className="lg:-mb-2"
        indietro={{ to: '/episodi', etichetta: 'Episodi' }}
        titolo={episodio ? nomeEpisodio(episodio) : 'Nuovo episodio'}
        stato={
          episodio &&
          (episodio.pubblicato ? (
            <Badge size="lg">
              <GlifoSpunta misura="badge" /> Pubblicato
            </Badge>
          ) : (
            <Badge size="lg" variant="destructive">
              Non pubblicato
            </Badge>
          ))
        }
      />

      {desktop ? (
        <>
          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-24 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-24">
              {pannelloDati}
              {pannelloDescrizioni}
            </div>
            <div className="flex flex-col gap-24">
              {pannelloCover}
              {pannelloLink}
            </div>
          </div>
          {pannelloAssociazioni}
          {barra}
        </>
      ) : (
        <>
          {pannelloDati}
          {pannelloCover}
          {pannelloLink}
          {pannelloAssociazioni}
          {pannelloDescrizioni}
          {!nuovo && bottoneElimina(true)}
          {barra}
        </>
      )}

      {episodio && (
        <ConfermaEliminazione
          aperto={conferma}
          onApertoChange={setConferma}
          titolo="Eliminare l'episodio?"
          inCorso={elimina.isPending}
          onConferma={() => elimina.mutate()}
        >
          {testoEliminazione(episodio)}
        </ConfermaEliminazione>
      )}
    </form>
  )
}

// Testo della conferma (docs/ui.md, «Conferme di eliminazione»): i collegamenti sono quelli
// salvati. Proposta per i casi che il disegno non mostra: con 1 collegamento il singolare; con 0
// la frase finisce dopo il nome; senza cover non si parla del file.
function testoEliminazione(e: Episodio): string {
  const n = e.associazioni.length
  const nome = `«${nomeEpisodio(e)}»`
  const file = e.cover ? 'il file della cover resta sul server' : null
  if (n === 0) return `Stai per eliminare ${nome}.${file ? ` Il file della cover resta sul server.` : ''}`
  const collegamenti =
    n === 1 ? 'il suo collegamento al videogioco citato' : `i suoi ${n} collegamenti ai videogiochi citati`
  const resta = n === 1 ? 'Il videogioco resta nel catalogo' : 'I videogiochi restano nel catalogo'
  return `Stai per eliminare ${nome} e ${collegamenti}. ${resta}${file ? ` e ${file}` : ''}.`
}
