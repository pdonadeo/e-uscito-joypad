import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { InputRicerca } from '@/components/campi'
import { ConfermaEliminazione } from '@/components/conferma-eliminazione'
import { BarraSelezione, IntestazioneOrdinabile, useRicercaDifferita, Vuoto } from '@/components/elenco'
import { IntestazionePagina } from '@/components/intestazione-pagina'
import { Paginazione } from '@/components/paginazione'
import { GlifoSpunta, GlifoStella } from '@/components/pixel-art'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { SelectConEtichetta, SelectItem } from '@/components/ui/select'
import { chiudiErrori, mostraErrore } from '@/components/ui/sonner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDesktop } from '@/lib/formato'
import { cn } from '@/lib/utils'
import {
  dataBreve,
  dataOra,
  elencoUtenti,
  eliminaUtenti,
  nomeCompleto,
  type OrdinamentoUtenti,
  type ParametriElencoUtenti,
  type Utente,
} from '@/lib/utenti'

// Elenco utenti (elenco-utenti-*.png), solo superuser: F-UT-01 elenco e ordinamento su tutte le
// colonne, F-UT-02 ricerca, F-UT-06 eliminazione in blocco. La propria riga (o scheda) non ha la
// casella, quindi non entra mai in un'eliminazione in blocco (docs/ui.md, «Checkbox»).
// Come per episodi e videogame, lo stato dell'elenco sta nell'indirizzo.

const RIGHE = [5, 10, 20, 25, 50] as const
// F-UT-01: 10 righe per pagina
const RIGHE_DEFAULT = 10

const COLONNE = {
  username: 'USERNAME',
  nome: 'FIRST_NAME',
  cognome: 'LAST_NAME',
  email: 'EMAIL',
  staff: 'IS_STAFF',
  attivo: 'IS_ACTIVE',
  superuser: 'IS_SUPERUSER',
  accesso: 'LAST_LOGIN',
} as const satisfies Record<string, OrdinamentoUtenti>
type Colonna = keyof typeof COLONNE

type Ricerca = {
  pagina?: number
  righe?: number
  ricerca?: string
  ordina?: Colonna
  verso?: 'asc' | 'desc'
}

// ORDINA a 390 (proposta, come negli altri elenchi): tutte le colonne, nei due versi.
const ORDINAMENTI_390: { valore: string; etichetta: string }[] = [
  { valore: 'username-asc', etichetta: 'Username, A → Z' },
  { valore: 'username-desc', etichetta: 'Username, Z → A' },
  { valore: 'nome-asc', etichetta: 'Nome, A → Z' },
  { valore: 'nome-desc', etichetta: 'Nome, Z → A' },
  { valore: 'cognome-asc', etichetta: 'Cognome, A → Z' },
  { valore: 'cognome-desc', etichetta: 'Cognome, Z → A' },
  { valore: 'email-asc', etichetta: 'Email, A → Z' },
  { valore: 'email-desc', etichetta: 'Email, Z → A' },
  { valore: 'accesso-desc', etichetta: 'Ultimo accesso, recenti' },
  { valore: 'accesso-asc', etichetta: 'Ultimo accesso, meno recenti' },
  { valore: 'staff-desc', etichetta: 'Staff, prima i sì' },
  { valore: 'staff-asc', etichetta: 'Staff, prima i no' },
  { valore: 'attivo-desc', etichetta: 'Attivo, prima i sì' },
  { valore: 'attivo-asc', etichetta: 'Attivo, prima i no' },
  { valore: 'superuser-desc', etichetta: 'Superuser, prima i sì' },
  { valore: 'superuser-asc', etichetta: 'Superuser, prima i no' },
]

const TESTI_VUOTO = {
  nessuno: 'Nessun utente trovato.',
  errore: 'Non è stato possibile leggere gli utenti.',
}

export const Route = createFileRoute('/bo/_app/utenti/')({
  validateSearch: (s: Record<string, unknown>): Ricerca => {
    const intero = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN)
    const pagina = intero(s.pagina)
    const righe = intero(s.righe)
    return {
      pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : undefined,
      righe: (RIGHE as readonly number[]).includes(righe) && righe !== RIGHE_DEFAULT ? righe : undefined,
      ricerca: typeof s.ricerca === 'string' && s.ricerca !== '' ? s.ricerca : undefined,
      ordina: typeof s.ordina === 'string' && Object.hasOwn(COLONNE, s.ordina) ? (s.ordina as Colonna) : undefined,
      verso: s.verso === 'asc' || s.verso === 'desc' ? s.verso : undefined,
    }
  },
  component: ElencoUtenti,
})

// Default di F-UT-01: username crescente; con la sola colonna il verso è crescente.
function parametri(r: Ricerca): ParametriElencoUtenti {
  return {
    pagina: r.pagina ?? 1,
    righe: r.righe ?? RIGHE_DEFAULT,
    ricerca: r.ricerca ?? '',
    ordinamento: COLONNE[r.ordina ?? 'username'],
    direzione: r.verso === 'desc' ? 'DESC' : 'ASC',
  }
}

function ElencoUtenti() {
  const ricerca = Route.useSearch()
  const navigate = useNavigate({ from: '/bo/utenti/' })
  const { me } = Route.useRouteContext()
  const desktop = useDesktop()
  const queryClient = useQueryClient()
  const p = parametri(ricerca)
  const { data, isPending, isError } = useQuery(elencoUtenti(p))

  // Selezione per l'eliminazione in blocco (F-UT-06): come negli altri elenchi, vale per la
  // pagina che si vede; la propria riga non si può selezionare.
  const [selezione, setSelezione] = React.useState<ReadonlySet<number>>(new Set())
  const chiave = JSON.stringify(p)
  React.useEffect(() => setSelezione(new Set()), [chiave])
  const [conferma, setConferma] = React.useState(false)

  const elimina = useMutation({
    mutationFn: (ids: number[]) => eliminaUtenti(ids),
    onSuccess: async (errori) => {
      setConferma(false)
      setSelezione(new Set())
      await queryClient.invalidateQueries({ queryKey: ['utenti'] })
      // rete di sicurezza: un 400 su una riga («Non puoi cancellare te stesso»), le altre sono
      // cancellate
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

  // Ricerca (F-UT-02): sottostringa su username, email, nome e cognome.
  const [testo, setTesto] = useRicercaDifferita(ricerca.ricerca, (v) => void vai({ ricerca: v }))

  const elementi = data?.elementi ?? []
  const totale = data?.totale ?? 0
  const selezionabili = elementi.filter((u) => u.id !== me.id)
  const tutti = selezionabili.length > 0 && selezionabili.every((u) => selezione.has(u.id))
  const qualcuno = selezionabili.some((u) => selezione.has(u.id))
  const commuta = (id: number) =>
    setSelezione((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const apri = (id: number) => navigate({ to: '/bo/utenti/$id', params: { id } })

  const colonnaAttiva = ricerca.ordina ?? 'username'
  const ascendente = p.direzione === 'ASC'
  const ordinaPer = (c: Colonna) =>
    void vai({ ordina: c, verso: colonnaAttiva === c ? (ascendente ? 'desc' : 'asc') : 'asc' })
  const intestazione = (c: Colonna, testoColonna: string, className?: string) => (
    <IntestazioneOrdinabile
      attiva={colonnaAttiva === c}
      ascendente={ascendente}
      onOrdina={() => ordinaPer(c)}
      className={className}
    >
      {testoColonna}
    </IntestazioneOrdinabile>
  )

  const nSel = selezione.size
  const conteggio = (breve: boolean) =>
    breve
      ? `${nSel} ${nSel === 1 ? 'selezionato' : 'selezionati'}`
      : `${nSel} ${nSel === 1 ? 'utente selezionato' : 'utenti selezionati'}`

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
        occhiello={desktop ? 'Livello segreto · solo superuser' : 'Livello segreto'}
        titolo="Utenti"
        azioni={
          <Button asChild size={desktop ? 'default' : 'sm'}>
            <Link to="/bo/utenti/nuovo">{desktop ? '+ Nuovo utente' : '+ Nuovo'}</Link>
          </Button>
        }
      />

      <div className="flex flex-col items-start gap-14 lg:flex-row lg:items-center">
        <InputRicerca
          aria-label="Cerca per username, email, nome o cognome"
          placeholder={desktop ? 'Cerca per username, email, nome o cognome' : 'Username, email, nome, cognome'}
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
              <col className="w-158" />
              <col className="w-128" />
              <col className="w-128" />
              <col />
              <col className="w-64" />
              <col className="w-72" />
              <col className="w-86" />
              <col className="w-166" />
            </colgroup>
            <TableHeader>
              <tr>
                <TableHead className="pl-16">
                  <Checkbox
                    suScuro
                    aria-label="Seleziona tutti"
                    disabled={selezionabili.length === 0}
                    checked={tutti ? true : qualcuno ? 'indeterminate' : false}
                    onCheckedChange={() => setSelezione(tutti ? new Set() : new Set(selezionabili.map((u) => u.id)))}
                    className="align-middle"
                  />
                </TableHead>
                {intestazione('username', 'Username')}
                {intestazione('nome', 'Nome')}
                {intestazione('cognome', 'Cognome')}
                {intestazione('email', 'Email')}
                {intestazione('staff', 'Staff')}
                {intestazione('attivo', 'Attivo')}
                {intestazione('superuser', 'Superuser')}
                {intestazione('accesso', 'Ultimo accesso', 'pr-16')}
              </tr>
            </TableHeader>
            <TableBody>
              {elementi.map((u) => (
                <TableRow
                  key={u.id}
                  data-cliccabile="true"
                  data-state={selezione.has(u.id) ? 'selected' : undefined}
                  className="h-48"
                  onClick={() => void apri(u.id)}
                >
                  <TableCell className="pl-16" onClick={(ev) => ev.stopPropagation()}>
                    {u.id === me.id ? (
                      // la propria riga: cella vuota della stessa larghezza (docs/ui.md)
                      <span data-testid="senza-casella" className="inline-block size-18 align-middle" />
                    ) : (
                      <Checkbox
                        aria-label={`Seleziona l'utente ${u.username}`}
                        checked={selezione.has(u.id)}
                        onCheckedChange={() => commuta(u.id)}
                        className="align-middle"
                      />
                    )}
                  </TableCell>
                  <TableCell className="truncate pr-12 font-bold">
                    <Link
                      to="/bo/utenti/$id"
                      params={{ id: u.id }}
                      onClick={(ev) => ev.stopPropagation()}
                      className="outline-none focus-visible:underline"
                    >
                      {u.username}
                    </Link>
                  </TableCell>
                  <TableCell className="truncate pr-12">
                    <Testo valore={u.first_name} />
                  </TableCell>
                  <TableCell className="truncate pr-12">
                    <Testo valore={u.last_name} />
                  </TableCell>
                  <TableCell className="truncate pr-12">
                    <Testo valore={u.email} />
                  </TableCell>
                  <Flag valore={u.is_staff} nome="Staff" />
                  <Flag valore={u.is_active} nome="Attivo" />
                  <Flag valore={u.is_superuser} nome="Superuser" stella />
                  <TableCell className={cn('pr-16', !u.last_login && 'text-inchiostro-300')}>
                    {u.last_login ? dataOra(u.last_login) : 'mai'}
                  </TableCell>
                </TableRow>
              ))}
              {elementi.length === 0 && (
                <tr>
                  <td colSpan={9} className="h-48 px-16 text-md text-inchiostro-500">
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
            {elementi.map((u) => (
              <li key={u.id}>
                <SchedaUtente
                  u={u}
                  proprio={u.id === me.id}
                  selezionata={selezione.has(u.id)}
                  onSeleziona={() => commuta(u.id)}
                  onApri={() => void apri(u.id)}
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
        titolo={nSel === 1 ? 'Eliminare 1 utente?' : `Eliminare ${nSel} utenti?`}
        inCorso={elimina.isPending}
        onConferma={() => {
          chiudiErrori()
          elimina.mutate([...selezione])
        }}
      >
        {nSel === 1
          ? 'Stai per eliminare 1 utente e tutti i suoi collegamenti a registro, gruppi e permessi. Episodi e videogame restano come sono.'
          : `Stai per eliminare ${nSel} utenti e tutti i loro collegamenti a registro, gruppi e permessi. Episodi e videogame restano come sono.`}
      </ConfermaEliminazione>
    </div>
  )
}

// Testo di una cella: «—» se è vuoto, come nel PNG.
function Testo({ valore }: { valore: string }) {
  return valore.trim() === '' ? <span className="text-inchiostro-300">—</span> : <>{valore}</>
}

// Colonne staff, attivo, superuser: «✔» verde-600 o «★» giallo-600, altrimenti «·» inchiostro-200.
function Flag({ valore, nome, stella }: { valore: boolean; nome: string; stella?: boolean }) {
  return (
    <TableCell>
      <span className={cn('inline-flex align-middle', valore ? (stella ? 'text-giallo-600' : 'text-verde-600') : 'text-inchiostro-200')}>
        {valore ? (
          stella ? (
            <GlifoStella misura="voce" />
          ) : (
            <GlifoSpunta misura="riga" />
          )
        ) : (
          <span className="text-lg font-extrabold">·</span>
        )}
      </span>
      <span className="sr-only">{valore ? nome : `non ${nome.toLowerCase()}`}</span>
    </TableCell>
  )
}

// Card `scheda-utente` (390): casella, username e «★ SUPERUSER»; nome · email; i badge staff e
// attivo e l'ultimo accesso. Tutta la scheda apre la modifica. La propria scheda non ha la casella.
function SchedaUtente({
  u,
  proprio,
  selezionata,
  onSeleziona,
  onApri,
}: {
  u: Utente
  proprio: boolean
  selezionata: boolean
  onSeleziona: () => void
  onApri: () => void
}) {
  const nome = nomeCompleto(u)
  const vuoti = nome === '' && u.email === ''
  return (
    <Card variant="scheda" data-selezionata={selezionata} onClick={onApri} className="cursor-pointer gap-7" aria-label={u.username}>
      <div className="flex items-center gap-10">
        {proprio ? (
          <span data-testid="senza-casella" className="size-20 shrink-0" />
        ) : (
          <span onClick={(ev) => ev.stopPropagation()} className="flex">
            <Checkbox size="lg" aria-label={`Seleziona l'utente ${u.username}`} checked={selezionata} onCheckedChange={onSeleziona} />
          </span>
        )}
        <Link
          to="/bo/utenti/$id"
          params={{ id: u.id }}
          onClick={(ev) => ev.stopPropagation()}
          className="truncate text-lg font-bold outline-none focus-visible:underline"
        >
          {u.username}
        </Link>
        {u.is_superuser && (
          <Badge variant="warning" size="sm" className="ml-auto">
            <GlifoStella misura="piccola" /> Superuser
          </Badge>
        )}
      </div>
      {/* ciò che manca è attenuato, il resto no (come «tester» nel PNG) */}
      <p className="truncate text-sm text-inchiostro-700">
        <span className={cn(nome === '' && 'text-inchiostro-400')}>{nome || 'nessun nome'}</span>
        <span className={cn(vuoti && 'text-inchiostro-400')}> · </span>
        <span className={cn(u.email === '' && 'text-inchiostro-400')}>{u.email || 'nessuna email'}</span>
      </p>
      <div className="flex items-center gap-6">
        <BadgeFlag valore={u.is_staff} nome="Staff" />
        <BadgeFlag valore={u.is_active} nome="Attivo" />
        <span className={cn('ml-auto text-xs', u.last_login ? 'text-inchiostro-500' : 'text-inchiostro-400')}>
          {u.last_login ? dataBreve(u.last_login) : 'mai entrato'}
        </span>
      </div>
    </Card>
  )
}

function BadgeFlag({ valore, nome }: { valore: boolean; nome: string }) {
  return valore ? (
    <Badge variant="success-tenue" size="sm">
      <GlifoSpunta misura="badge" /> {nome}
    </Badge>
  ) : (
    <Badge variant="outline-tratteggiato" size="sm">
      · Non {nome.toLowerCase()}
    </Badge>
  )
}
