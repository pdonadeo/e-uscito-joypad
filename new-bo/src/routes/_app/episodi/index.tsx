import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { InputRicerca } from '@/components/campi'
import { BarraSelezione, IntestazioneOrdinabile, useRicercaDifferita, Vuoto } from '@/components/elenco'
import { ConfermaEliminazione } from '@/components/conferma-eliminazione'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { Paginazione } from '@/components/paginazione'
import { GlifoSpunta } from '@/components/pixel-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectConEtichetta, SelectItem } from '@/components/ui/select'
import { chiudiErrori, mostraErrore } from '@/components/ui/sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  durataBreve,
  elencoEpisodi,
  eliminaEpisodi,
  presente,
  type Direzione,
  type EpisodioInElenco,
  type OrdinamentoEpisodi,
  type ParametriElenco,
} from '@/lib/episodi'
import { useDesktop } from '@/lib/formato'
import { cn } from '@/lib/utils'

// Elenco episodi (docs/ui.md, «Elenco episodi»): F-EP-01 elenco paginato, F-EP-02 ordinamento,
// F-EP-03 ricerca, F-EP-04 filtro «Pubblicato», F-EP-08 eliminazione in blocco.
// Lo stato dell'elenco (pagina, righe, ricerca, filtro, ordinamento) sta nell'indirizzo, così
// «◀ EPISODI» e il tasto indietro tornano allo stesso punto.

const RIGHE = [5, 10, 20, 25, 50] as const
const RIGHE_DEFAULT = 20

const COLONNE: Record<string, OrdinamentoEpisodi> = {
  numero: 'EPISODIO_NUMERO',
  titolo: 'TITOLO',
  data: 'DATA_USCITA',
  durata: 'DURATA',
  pubblicato: 'PUBBLICATO',
}
type Colonna = keyof typeof COLONNE

type Ricerca = {
  pagina?: number
  righe?: number
  ricerca?: string
  pubblicato?: 'tutti' | 'si' | 'no'
  ordina?: Colonna
  verso?: 'asc' | 'desc'
}

// ORDINA a 390 (proposta: le combinazioni colonna + verso, con un nome leggibile).
const ORDINAMENTI_390: { valore: string; etichetta: string }[] = [
  { valore: 'data-desc', etichetta: 'Data uscita, recenti' },
  { valore: 'data-asc', etichetta: 'Data uscita, meno recenti' },
  { valore: 'numero-desc', etichetta: 'Numero, decrescente' },
  { valore: 'numero-asc', etichetta: 'Numero, crescente' },
  { valore: 'titolo-asc', etichetta: 'Titolo, A → Z' },
  { valore: 'titolo-desc', etichetta: 'Titolo, Z → A' },
  { valore: 'durata-desc', etichetta: 'Durata, più lunghi' },
  { valore: 'durata-asc', etichetta: 'Durata, più corti' },
  { valore: 'pubblicato-asc', etichetta: 'Pubblicato, prima i no' },
  { valore: 'pubblicato-desc', etichetta: 'Pubblicato, prima i sì' },
]

export const Route = createFileRoute('/_app/episodi/')({
  validateSearch: (s: Record<string, unknown>): Ricerca => {
    const intero = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)
    const pagina = intero(s.pagina)
    const righe = intero(s.righe)
    return {
      pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
      righe: (RIGHE as readonly number[]).includes(righe) && righe !== RIGHE_DEFAULT ? righe : undefined,
      ricerca: typeof s.ricerca === 'string' && s.ricerca !== '' ? s.ricerca : undefined,
      pubblicato: s.pubblicato === 'tutti' || s.pubblicato === 'si' || s.pubblicato === 'no' ? s.pubblicato : undefined,
      ordina: typeof s.ordina === 'string' && Object.hasOwn(COLONNE, s.ordina) ? (s.ordina as Colonna) : undefined,
      verso: s.verso === 'asc' || s.verso === 'desc' ? s.verso : undefined,
    }
  },
  component: ElencoEpisodi,
})

function parametri(r: Ricerca): ParametriElenco {
  // Default di F-EP-02: data di uscita decrescente. Con la sola colonna il verso è crescente.
  const ordina: Colonna = r.ordina ?? 'data'
  const verso: Direzione = r.verso ? (r.verso === 'asc' ? 'ASC' : 'DESC') : r.ordina ? 'ASC' : 'DESC'
  return {
    pagina: r.pagina ?? 1,
    righe: r.righe ?? RIGHE_DEFAULT,
    ricerca: r.ricerca ?? '',
    pubblicato: r.pubblicato === 'si' ? true : r.pubblicato === 'no' ? false : null,
    ordinamento: COLONNE[ordina],
    direzione: verso,
  }
}

function ElencoEpisodi() {
  const ricerca = Route.useSearch()
  const navigate = useNavigate({ from: '/episodi/' })
  const desktop = useDesktop()
  const queryClient = useQueryClient()
  const p = parametri(ricerca)
  const { data, isPending, isError } = useQuery(elencoEpisodi(p))

  // Selezione per l'eliminazione in blocco (F-EP-08). Proposta: vale per la pagina che si vede;
  // cambiando pagina, filtri o ordinamento si azzera.
  const [selezione, setSelezione] = React.useState<ReadonlySet<number>>(new Set())
  const chiave = JSON.stringify(p)
  React.useEffect(() => setSelezione(new Set()), [chiave])
  const [conferma, setConferma] = React.useState(false)

  const elimina = useMutation({
    mutationFn: (ids: number[]) => eliminaEpisodi(ids),
    onSuccess: async (errori) => {
      setConferma(false)
      setSelezione(new Set())
      await queryClient.invalidateQueries({ queryKey: ['episodi'] })
      if (errori.length > 0) mostraErrore(errori[0].message)
    },
    onError: (e) => {
      setConferma(false)
      mostraErrore(e.message)
    },
  })

  const vai = (cambia: Partial<Ricerca>, azzeraPagina = true) =>
    navigate({
      search: (prev) => ({ ...prev, ...(azzeraPagina ? { pagina: undefined } : {}), ...cambia }),
      replace: true,
    })

  // Ricerca (F-EP-03): il campo è immediato, l'indirizzo si aggiorna dopo 300 ms di pausa.
  const [testo, setTesto] = useRicercaDifferita(ricerca.ricerca, (v) => void vai({ ricerca: v }))

  const elementi = data?.elementi ?? []
  const totale = data?.totale ?? 0
  const tutti = elementi.length > 0 && elementi.every((e) => selezione.has(e.id))
  const qualcuno = elementi.some((e) => selezione.has(e.id))
  const commuta = (id: number) =>
    setSelezione((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const apri = (id: number) => navigate({ to: '/episodi/$id', params: { id } })

  const ordinaPer = (c: Colonna) => {
    const attuale = ricerca.ordina ?? 'data'
    const versoAttuale = p.direzione === 'ASC' ? 'asc' : 'desc'
    const verso = attuale === c ? (versoAttuale === 'asc' ? 'desc' : 'asc') : 'asc'
    void vai({ ordina: c, verso })
  }

  const filtroPubblicato = (
    <SelectConEtichetta
      etichetta="Pubblicato"
      size={desktop ? 'default' : 'sm'}
      value={ricerca.pubblicato}
      onValueChange={(v) => void vai({ pubblicato: v as Ricerca['pubblicato'] })}
      onRimuovi={() => void vai({ pubblicato: undefined })}
    >
      <SelectItem value="tutti">Tutti</SelectItem>
      <SelectItem value="si">Sì</SelectItem>
      <SelectItem value="no">No</SelectItem>
    </SelectConEtichetta>
  )
  // «+ AGGIUNGI FILTRO» (F-EP-04): l'unico filtro è «Pubblicato». Proposta: se c'è già, il bottone
  // resta (come nel PNG) e porta il focus sul filtro.
  const aggiungiFiltro = () => {
    if (ricerca.pubblicato) {
      document.querySelector<HTMLButtonElement>('[data-slot=select-con-etichetta] button')?.focus()
    } else {
      void vai({ pubblicato: 'tutti' })
    }
  }

  const nSel = selezione.size
  const conteggioSelezione = (breve: boolean) =>
    breve ? `${nSel} ${nSel === 1 ? 'selezionato' : 'selezionati'}` : `${nSel} ${nSel === 1 ? 'episodio selezionato' : 'episodi selezionati'}`

  return (
    <div className="flex flex-col gap-14 lg:gap-20">
      <IntestazionePagina
        occhiello="Livello 1"
        titolo="Episodi"
        azioni={
          <Button asChild size={desktop ? 'default' : 'sm'}>
            <Link to="/episodi/nuovo">{desktop ? '+ Nuovo episodio' : '+ Nuovo'}</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-14 lg:flex-row lg:items-center">
        <InputRicerca
          aria-label="Cerca per numero o titolo"
          placeholder="Cerca per numero o titolo"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          className="lg:w-378"
        />
        <div className="flex flex-col items-start gap-8 lg:contents">
        {!desktop && (
          <SelectConEtichetta
            etichetta="Ordina"
            size="sm"
            value={`${ricerca.ordina ?? 'data'}-${p.direzione === 'ASC' ? 'asc' : 'desc'}`}
            onValueChange={(v) => {
              const [c, verso] = v.split('-') as [Colonna, 'asc' | 'desc']
              void vai({ ordina: c, verso })
            }}
          >
            {ORDINAMENTI_390.map((o) => (
              <SelectItem key={o.valore} value={o.valore}>
                {o.etichetta}
              </SelectItem>
            ))}
          </SelectConEtichetta>
        )}
        <div className="flex items-center gap-8 max-[390px]:flex-wrap lg:gap-14">
          {ricerca.pubblicato && filtroPubblicato}
          <Button
            variant="dashed"
            size={desktop ? 'sm' : 'xs'}
            className={desktop ? 'h-44' : 'h-40'}
            onClick={aggiungiFiltro}
          >
            {desktop ? '+ Aggiungi filtro' : '+ Filtro'}
          </Button>
        </div>
        </div>
      </div>

      {!desktop && nSel > 0 && (
        <BarraSelezione
          desktop={false}
          testo={conteggioSelezione(true)}
          onDeseleziona={() => setSelezione(new Set())}
          onElimina={() => setConferma(true)}
        />
      )}

      {desktop ? (
        <div className="border-3 border-inchiostro bg-bianco shadow-pixel-lg">
          {nSel > 0 && (
            <BarraSelezione
              desktop
              testo={conteggioSelezione(false)}
              onDeseleziona={() => setSelezione(new Set())}
              onElimina={() => setConferma(true)}
            />
          )}
          <Table>
            <colgroup>
              <col className="w-64" />
              <col className="w-72" />
              <col />
              <col className="w-129" />
              <col className="w-86" />
              <col className="w-68" />
              <col className="w-68" />
              <col className="w-68" />
              <col className="w-68" />
              <col className="w-126" />
            </colgroup>
            <TableHeader>
              <tr>
                <TableHead className="pl-16">
                  <Checkbox
                    suScuro
                    aria-label="Seleziona tutti"
                    checked={tutti ? true : qualcuno ? 'indeterminate' : false}
                    onCheckedChange={() => setSelezione(tutti ? new Set() : new Set(elementi.map((e) => e.id)))}
                    className="align-middle"
                  />
                </TableHead>
                <Intestazione colonna="numero" ricerca={ricerca} p={p} onOrdina={ordinaPer}>
                  N°
                </Intestazione>
                <Intestazione colonna="titolo" ricerca={ricerca} p={p} onOrdina={ordinaPer}>
                  Titolo
                </Intestazione>
                <Intestazione colonna="data" ricerca={ricerca} p={p} onOrdina={ordinaPer}>
                  Data uscita
                </Intestazione>
                <Intestazione colonna="durata" ricerca={ricerca} p={p} onOrdina={ordinaPer}>
                  Durata
                </Intestazione>
                <TableHead className="text-center text-viola-300">Cover</TableHead>
                <TableHead className="text-center text-viola-300">Audio</TableHead>
                <TableHead className="text-center text-viola-300">Post</TableHead>
                <TableHead className="text-center text-viola-300">Video</TableHead>
                <Intestazione colonna="pubblicato" ricerca={ricerca} p={p} onOrdina={ordinaPer} className="pr-16 text-center">
                  Pubblicato
                </Intestazione>
              </tr>
            </TableHeader>
            <TableBody>
              {elementi.map((e) => (
                <TableRow
                  key={e.id}
                  data-cliccabile="true"
                  data-state={selezione.has(e.id) ? 'selected' : undefined}
                  className="h-48"
                  onClick={() => void apri(e.id)}
                >
                  <TableCell className="pl-16" onClick={(ev) => ev.stopPropagation()}>
                    <Checkbox
                      aria-label={`Seleziona l'episodio ${e.titolo}`}
                      checked={selezione.has(e.id)}
                      onCheckedChange={() => commuta(e.id)}
                      className="align-middle"
                    />
                  </TableCell>
                  <TableCell className="truncate font-bold">{e.episodio_numero}</TableCell>
                  <TableCell className="truncate pr-16">
                    <Link
                      to="/episodi/$id"
                      params={{ id: e.id }}
                      onClick={(ev) => ev.stopPropagation()}
                      className="outline-none focus-visible:underline"
                    >
                      {e.titolo}
                    </Link>
                  </TableCell>
                  <TableCell>{e.data_uscita}</TableCell>
                  <TableCell>{durataBreve(e.durata)}</TableCell>
                  <Presenza valore={e.cover} nome="Cover" />
                  <Presenza valore={e.url} nome="Audio" />
                  <Presenza valore={e.url_post} nome="Post" />
                  <Presenza valore={e.url_video} nome="Video" />
                  <TableCell className="pr-16 text-center">
                    <Badge variant={e.pubblicato ? 'success' : 'destructive'}>{e.pubblicato ? 'Sì' : 'No'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {elementi.length === 0 && (
                <tr>
                  <td colSpan={10} className="h-48 px-16 text-md text-inchiostro-500">
                    <Vuoto caricamento={isPending} errore={isError} testi={TESTI_VUOTO} />
                  </td>
                </tr>
              )}
            </TableBody>
          </Table>
          <Paginazione
            formato="desktop"
            pagina={p.pagina}
            righe={p.righe}
            totale={totale}
            opzioniRighe={RIGHE}
            onPagina={(n) => void vai({ pagina: n > 1 ? n : undefined }, false)}
            onRighe={(n) => void vai({ righe: n === RIGHE_DEFAULT ? undefined : n })}
          />
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-16">
            {elementi.map((e) => (
              <li key={e.id}>
                <SchedaEpisodio
                  e={e}
                  selezionata={selezione.has(e.id)}
                  onSeleziona={() => commuta(e.id)}
                  onApri={() => void apri(e.id)}
                />
              </li>
            ))}
            {elementi.length === 0 && (
              <li className="border-2 border-inchiostro bg-bianco p-12 text-md text-inchiostro-500">
                <Vuoto caricamento={isPending} errore={isError} testi={TESTI_VUOTO} />
              </li>
            )}
          </ul>
          <Paginazione
            formato="mobile"
            pagina={p.pagina}
            righe={p.righe}
            totale={totale}
            opzioniRighe={RIGHE}
            onPagina={(n) => void vai({ pagina: n > 1 ? n : undefined }, false)}
            onRighe={(n) => void vai({ righe: n === RIGHE_DEFAULT ? undefined : n })}
          />
        </>
      )}

      <ConfermaEliminazione
        aperto={conferma}
        onApertoChange={setConferma}
        titolo={nSel === 1 ? 'Eliminare 1 episodio?' : `Eliminare ${nSel} episodi?`}
        inCorso={elimina.isPending}
        onConferma={() => {
          chiudiErrori()
          elimina.mutate([...selezione])
        }}
      >
        {nSel === 1
          ? 'Stai per eliminare 1 episodio e tutti i suoi collegamenti ai videogiochi citati. I videogiochi restano nel catalogo e il file della cover resta sul server.'
          : `Stai per eliminare ${nSel} episodi e tutti i loro collegamenti ai videogiochi citati. I videogiochi restano nel catalogo e i file delle cover restano sul server.`}
      </ConfermaEliminazione>
    </div>
  )
}

// Intestazione di una colonna ordinabile (F-EP-02).
function Intestazione({
  colonna,
  ricerca,
  p,
  onOrdina,
  className,
  children,
}: {
  colonna: Colonna
  ricerca: Ricerca
  p: ParametriElenco
  onOrdina: (c: Colonna) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <IntestazioneOrdinabile
      attiva={(ricerca.ordina ?? 'data') === colonna}
      ascendente={p.direzione === 'ASC'}
      onOrdina={() => onOrdina(colonna)}
      className={className}
    >
      {children}
    </IntestazioneOrdinabile>
  )
}

function Presenza({ valore, nome }: { valore: string | null | undefined; nome: string }) {
  const si = presente(valore)
  return (
    <TableCell className="text-center">
      <span className={cn('inline-flex align-middle', si ? 'text-verde-600' : 'text-inchiostro-200')}>
        {si ? <GlifoSpunta misura="riga" /> : <span className="text-lg font-extrabold">·</span>}
      </span>
      <span className="sr-only">{si ? `${nome} presente` : `${nome} assente`}</span>
    </TableCell>
  )
}

const TESTI_VUOTO = {
  nessuno: 'Nessun episodio trovato.',
  errore: 'Non è stato possibile leggere gli episodi.',
}

// Card `scheda-episodio` (390): checkbox, numero, badge pubblicato, titolo, data · durata e i badge
// delle presenze. Tutta la scheda apre la modifica.
function SchedaEpisodio({
  e,
  selezionata,
  onSeleziona,
  onApri,
}: {
  e: EpisodioInElenco
  selezionata: boolean
  onSeleziona: () => void
  onApri: () => void
}) {
  return (
    <Card
      variant="scheda"
      data-selezionata={selezionata}
      onClick={onApri}
      className="cursor-pointer gap-10"
      aria-label={e.titolo}
    >
      <div className="flex items-center gap-10">
        <span onClick={(ev) => ev.stopPropagation()} className="flex">
          <Checkbox
            size="lg"
            aria-label={`Seleziona l'episodio ${e.titolo}`}
            checked={selezionata}
            onCheckedChange={onSeleziona}
          />
        </span>
        <span className="text-md font-extrabold text-viola">{e.episodio_numero ? `N° ${e.episodio_numero}` : ''}</span>
        <Badge variant={e.pubblicato ? 'success' : 'destructive'} size="sm" className="ml-auto">
          {e.pubblicato ? (
            <>
              <GlifoSpunta misura="badge" /> Pubblicato
            </>
          ) : (
            'Non pubblicato'
          )}
        </Badge>
      </div>
      <Link
        to="/episodi/$id"
        params={{ id: e.id }}
        onClick={(ev) => ev.stopPropagation()}
        className="text-lg font-bold outline-none focus-visible:underline"
      >
        {e.titolo}
      </Link>
      <p className="text-md text-inchiostro-600">
        {e.data_uscita} · {durataBreve(e.durata)}
      </p>
      <div className="flex flex-wrap gap-6">
        <BadgePresenza valore={e.cover} nome="Cover" />
        <BadgePresenza valore={e.url} nome="Audio" />
        <BadgePresenza valore={e.url_post} nome="Post" />
        <BadgePresenza valore={e.url_video} nome="Video" />
      </div>
    </Card>
  )
}

function BadgePresenza({ valore, nome }: { valore: string | null | undefined; nome: string }) {
  return presente(valore) ? (
    <Badge variant="success-tenue" size="sm">
      <GlifoSpunta misura="badge" /> {nome}
      <span className="sr-only"> presente</span>
    </Badge>
  ) : (
    <Badge variant="outline-tratteggiato" size="sm">
      · {nome}
      <span className="sr-only"> assente</span>
    </Badge>
  )
}
