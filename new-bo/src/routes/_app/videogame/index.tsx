import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { InputRicerca } from '@/components/campi'
import { ConfermaEliminazione } from '@/components/conferma-eliminazione'
import { BarraSelezione, IntestazioneOrdinabile, useRicercaDifferita, Vuoto } from '@/components/elenco'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { Paginazione } from '@/components/paginazione'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectConEtichetta, SelectItem } from '@/components/ui/select'
import { chiudiErrori, mostraErrore } from '@/components/ui/sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MiniaturaCover } from '@/components/videogame/miniatura'
import { useDesktop } from '@/lib/formato'
import {
  elencoVideogame,
  eliminaVideogameInBlocco,
  nomeVideogame,
  type OrdinamentoVideogame,
  type ParametriElencoVideogame,
  type VideogameInElenco,
} from '@/lib/videogame'

// Elenco videogame (elenco-videogame-*.png): F-VG-01 elenco paginato con la miniatura della
// cover, F-VG-02 ordinamento (titolo, slug), F-VG-03 ricerca, F-VG-07 eliminazione in blocco.
// Come per gli episodi, lo stato dell'elenco sta nell'indirizzo.

const RIGHE = [5, 10, 20, 25, 50] as const
// F-VG-01: 10 righe per pagina
const RIGHE_DEFAULT = 10

const COLONNE: Record<string, OrdinamentoVideogame> = {
  titolo: 'TITOLO',
  slug: 'RAWG_SLUG',
}
type Colonna = keyof typeof COLONNE

type Ricerca = {
  pagina?: number
  righe?: number
  ricerca?: string
  ordina?: Colonna
  verso?: 'asc' | 'desc'
}

// ORDINA a 390 (proposta, come per gli episodi).
const ORDINAMENTI_390: { valore: string; etichetta: string }[] = [
  { valore: 'titolo-asc', etichetta: 'Titolo, A → Z' },
  { valore: 'titolo-desc', etichetta: 'Titolo, Z → A' },
  { valore: 'slug-asc', etichetta: 'Slug, A → Z' },
  { valore: 'slug-desc', etichetta: 'Slug, Z → A' },
]

const TESTI_VUOTO = {
  nessuno: 'Nessun videogame trovato.',
  errore: 'Non è stato possibile leggere i videogame.',
}

export const Route = createFileRoute('/_app/videogame/')({
  validateSearch: (s: Record<string, unknown>): Ricerca => {
    const intero = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)
    const pagina = intero(s.pagina)
    const righe = intero(s.righe)
    return {
      pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
      righe: (RIGHE as readonly number[]).includes(righe) && righe !== RIGHE_DEFAULT ? righe : undefined,
      ricerca: typeof s.ricerca === 'string' && s.ricerca !== '' ? s.ricerca : undefined,
      ordina: typeof s.ordina === 'string' && s.ordina in COLONNE ? (s.ordina as Colonna) : undefined,
      verso: s.verso === 'asc' || s.verso === 'desc' ? s.verso : undefined,
    }
  },
  component: ElencoVideogame,
})

// Default di F-VG-02: titolo crescente; con la sola colonna il verso è crescente.
function parametri(r: Ricerca): ParametriElencoVideogame {
  return {
    pagina: r.pagina ?? 1,
    righe: r.righe ?? RIGHE_DEFAULT,
    ricerca: r.ricerca ?? '',
    ordinamento: COLONNE[r.ordina ?? 'titolo'],
    direzione: r.verso === 'desc' ? 'DESC' : 'ASC',
  }
}

function ElencoVideogame() {
  const ricerca = Route.useSearch()
  const navigate = useNavigate({ from: '/videogame/' })
  const desktop = useDesktop()
  const queryClient = useQueryClient()
  const p = parametri(ricerca)
  const { data, isPending, isError } = useQuery(elencoVideogame(p))

  // Selezione per l'eliminazione in blocco (F-VG-07), come per gli episodi: vale per la pagina
  // che si vede e si azzera cambiando pagina, ricerca o ordinamento.
  const [selezione, setSelezione] = React.useState<ReadonlySet<number>>(new Set())
  const chiave = JSON.stringify(p)
  React.useEffect(() => setSelezione(new Set()), [chiave])
  const [conferma, setConferma] = React.useState(false)

  const elimina = useMutation({
    mutationFn: (ids: number[]) => eliminaVideogameInBlocco(ids),
    onSuccess: async (errori) => {
      setConferma(false)
      setSelezione(new Set())
      await queryClient.invalidateQueries({ queryKey: ['videogame'] })
      await queryClient.invalidateQueries({ queryKey: ['episodi'], refetchType: 'none' })
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

  // Ricerca (F-VG-03): la stessa di oggi, sottostringa su titolo, descrizione e slug.
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
  const apri = (id: number) => navigate({ to: '/videogame/$id', params: { id } })

  const colonnaAttiva = ricerca.ordina ?? 'titolo'
  const ascendente = p.direzione === 'ASC'
  const ordinaPer = (c: Colonna) =>
    void vai({ ordina: c, verso: colonnaAttiva === c ? (ascendente ? 'desc' : 'asc') : 'asc' })

  const nSel = selezione.size
  const conteggio = (breve: boolean) =>
    breve
      ? `${nSel} ${nSel === 1 ? 'selezionato' : 'selezionati'}`
      : `${nSel} videogame ${nSel === 1 ? 'selezionato' : 'selezionati'}`

  const paginazione = (formato: 'desktop' | 'mobile') => (
    <Paginazione
      formato={formato}
      pagina={p.pagina}
      righe={p.righe}
      totale={totale}
      opzioniRighe={RIGHE}
      onPagina={(n) => void vai({ pagina: n > 1 ? n : undefined }, false)}
      onRighe={(n) => void vai({ righe: n === RIGHE_DEFAULT ? undefined : n })}
    />
  )

  return (
    <div className="flex flex-col gap-14 lg:gap-20">
      <IntestazionePagina
        occhiello="Livello 2"
        titolo="Videogame"
        azioni={
          <Button asChild size={desktop ? 'default' : 'sm'}>
            <Link to="/videogame/nuovo">{desktop ? '+ Nuovo videogame' : '+ Nuovo'}</Link>
          </Button>
        }
      />

      <div className="flex flex-col items-start gap-14 lg:flex-row lg:items-center">
        <InputRicerca
          aria-label="Cerca per titolo, descrizione o slug"
          placeholder={desktop ? 'Cerca per titolo, descrizione o slug' : 'Titolo, descrizione o slug'}
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          className="w-full lg:w-460"
        />
        {!desktop && (
          <SelectConEtichetta
            etichetta="Ordina"
            size="sm"
            value={`${colonnaAttiva}-${ascendente ? 'asc' : 'desc'}`}
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
      </div>

      {!desktop && nSel > 0 && (
        <BarraSelezione
          desktop={false}
          testo={conteggio(true)}
          onDeseleziona={() => setSelezione(new Set())}
          onElimina={() => setConferma(true)}
        />
      )}

      {desktop ? (
        <div className="border-3 border-inchiostro bg-bianco shadow-pixel-lg">
          {nSel > 0 && (
            <BarraSelezione
              desktop
              testo={conteggio(false)}
              onDeseleziona={() => setSelezione(new Set())}
              onElimina={() => setConferma(true)}
            />
          )}
          <Table>
            <colgroup>
              <col className="w-64" />
              <col className="w-68" />
              <col />
              <col className="w-456" />
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
                <TableHead className="text-viola-300">Cover</TableHead>
                <IntestazioneOrdinabile
                  attiva={colonnaAttiva === 'titolo'}
                  ascendente={ascendente}
                  onOrdina={() => ordinaPer('titolo')}
                >
                  Titolo
                </IntestazioneOrdinabile>
                <IntestazioneOrdinabile
                  attiva={colonnaAttiva === 'slug'}
                  ascendente={ascendente}
                  onOrdina={() => ordinaPer('slug')}
                  className="pr-16"
                >
                  RAWG slug
                </IntestazioneOrdinabile>
              </tr>
            </TableHeader>
            <TableBody>
              {elementi.map((v) => (
                <TableRow
                  key={v.id}
                  data-cliccabile="true"
                  data-state={selezione.has(v.id) ? 'selected' : undefined}
                  className="h-60"
                  onClick={() => void apri(v.id)}
                >
                  <TableCell className="pl-16" onClick={(ev) => ev.stopPropagation()}>
                    <Checkbox
                      aria-label={`Seleziona il videogame ${nomeVideogame(v)}`}
                      checked={selezione.has(v.id)}
                      onCheckedChange={() => commuta(v.id)}
                      className="align-middle"
                    />
                  </TableCell>
                  <TableCell>
                    <MiniaturaCover src={v.cover} />
                  </TableCell>
                  <TableCell className="truncate pr-16 font-bold">
                    <Link
                      to="/videogame/$id"
                      params={{ id: v.id }}
                      onClick={(ev) => ev.stopPropagation()}
                      className="outline-none focus-visible:underline"
                    >
                      {nomeVideogame(v)}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate pr-16 text-md text-inchiostro-700">{v.rawg_slug}</TableCell>
                </TableRow>
              ))}
              {elementi.length === 0 && (
                <tr>
                  <td colSpan={4} className="h-60 px-16 text-md text-inchiostro-500">
                    <Vuoto caricamento={isPending} errore={isError} testi={TESTI_VUOTO} />
                  </td>
                </tr>
              )}
            </TableBody>
          </Table>
          {paginazione('desktop')}
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-12">
            {elementi.map((v) => (
              <li key={v.id}>
                <SchedaVideogame
                  v={v}
                  selezionata={selezione.has(v.id)}
                  onSeleziona={() => commuta(v.id)}
                  onApri={() => void apri(v.id)}
                />
              </li>
            ))}
            {elementi.length === 0 && (
              <li className="border-2 border-inchiostro bg-bianco p-12 text-md text-inchiostro-500">
                <Vuoto caricamento={isPending} errore={isError} testi={TESTI_VUOTO} />
              </li>
            )}
          </ul>
          {paginazione('mobile')}
        </>
      )}

      <ConfermaEliminazione
        aperto={conferma}
        onApertoChange={setConferma}
        titolo={`Eliminare ${nSel} videogame?`}
        inCorso={elimina.isPending}
        onConferma={() => {
          chiudiErrori()
          elimina.mutate([...selezione])
        }}
      >
        {nSel === 1
          ? 'Stai per eliminare 1 videogame e tutti i suoi collegamenti agli episodi in cui è citato. Gli episodi restano nell\'archivio.'
          : `Stai per eliminare ${nSel} videogame e tutti i loro collegamenti agli episodi in cui sono citati. Gli episodi restano nell'archivio.`}
      </ConfermaEliminazione>
    </div>
  )
}

// Card `scheda-videogame` (390): checkbox, miniatura, titolo e slug in riga; senza cover lo slug
// dice anche «· senza cover» (come nel PNG). Tutta la scheda apre la modifica.
function SchedaVideogame({
  v,
  selezionata,
  onSeleziona,
  onApri,
}: {
  v: VideogameInElenco
  selezionata: boolean
  onSeleziona: () => void
  onApri: () => void
}) {
  return (
    <Card
      variant="scheda"
      data-selezionata={selezionata}
      onClick={onApri}
      className="cursor-pointer flex-row items-center gap-12 px-12 py-10"
      aria-label={nomeVideogame(v)}
    >
      <span onClick={(ev) => ev.stopPropagation()} className="flex">
        <Checkbox
          size="lg"
          aria-label={`Seleziona il videogame ${nomeVideogame(v)}`}
          checked={selezionata}
          onCheckedChange={onSeleziona}
        />
      </span>
      <MiniaturaCover src={v.cover} className="h-44 w-64" />
      <div className="flex min-w-0 flex-col gap-4">
        <Link
          to="/videogame/$id"
          params={{ id: v.id }}
          onClick={(ev) => ev.stopPropagation()}
          className="truncate text-lg font-bold outline-none focus-visible:underline"
        >
          {nomeVideogame(v)}
        </Link>
        <span className="truncate text-sm text-inchiostro-600">
          {v.rawg_slug}
          {v.cover ? '' : ' · senza cover'}
        </span>
      </div>
    </Card>
  )
}
