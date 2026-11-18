import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { PaginazioneCompatta } from '@/components/paginazione'
import { GlifoApri, GlifoOrdine } from '@/components/pixel-art'
import { Card, CardContent, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { durataBreve, TIPOLOGIA } from '@/lib/episodi'
import { episodiCitati, RIGHE_CITATI } from '@/lib/videogame'

// «Episodi in cui è citato» (F-VG-08 su F-AS-01): sola lettura, data di uscita decrescente,
// 25 righe per pagina, un clic sulla riga (o sulla scheda a 390) apre la modifica dell'episodio.
// Proposte: senza episodi il pannello dice «Nessun episodio cita questo videogame.»; la colonna
// ordinata è fissa, quindi l'intestazione non è un bottone.

const tipologia = (v: string) => TIPOLOGIA.find((t) => t.valore === v)?.etichetta ?? v

export function EpisodiCitati({ videogameId, desktop }: { videogameId: number; desktop: boolean }) {
  const [pagina, setPagina] = React.useState(1)
  const navigate = useNavigate()
  const { data, isPending, isError } = useQuery(episodiCitati(videogameId, pagina))
  const elementi = data?.elementi ?? []
  const totale = data?.totale ?? 0
  // se le associazioni diminuiscono, una pagina oltre l'ultima torna all'ultima
  const ultima = Math.max(1, Math.ceil(totale / RIGHE_CITATI))
  React.useEffect(() => {
    if (data && pagina > ultima) setPagina(ultima)
  }, [data, pagina, ultima])
  const apri = (id: number) => void navigate({ to: '/episodi/$id', params: { id } })
  const nota = 'Sola lettura: i collegamenti si modificano dall\'episodio'

  const vuoto = isPending ? 'Caricamento…' : isError ? 'Non è stato possibile leggere gli episodi.' : 'Nessun episodio cita questo videogame.'

  return (
    <Card data-testid="episodi-citati">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* il numero c'è solo quando è arrivato (non «· 0» durante il caricamento) */}
        <CardTitle>Episodi in cui è citato{data ? ` · ${totale}` : ''}</CardTitle>
        <p className="text-sm text-inchiostro-700">{desktop ? nota : `${nota}.`}</p>
      </div>
      <CardContent className="mt-16 gap-14">
        {elementi.length === 0 ? (
          <p className="text-md text-inchiostro-500">{vuoto}</p>
        ) : desktop ? (
          <div className="border-2 border-inchiostro">
            <Table>
              <colgroup>
                <col className="w-68" />
                <col />
                <col className="w-142" />
                <col className="w-102" />
                <col className="w-220" />
                <col className="w-48" />
              </colgroup>
              <TableHeader>
                <tr>
                  <TableHead bassa className="pl-14">
                    N°
                  </TableHead>
                  <TableHead bassa>Episodio</TableHead>
                  <TableHead bassa aria-sort="descending">
                    <span className="inline-flex items-center gap-8">
                      Data uscita <GlifoOrdine verso="giu" />
                    </span>
                  </TableHead>
                  <TableHead bassa>Istante</TableHead>
                  <TableHead bassa>Tipologia</TableHead>
                  <TableHead bassa>
                    <span className="sr-only">Apri</span>
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {elementi.map((a) => (
                  <TableRow key={a.id} data-cliccabile="true" className="h-46" onClick={() => apri(a.episodio_id)}>
                    <TableCell className="truncate pl-14 font-bold">{a.episodio_numero}</TableCell>
                    <TableCell className="truncate pr-12">
                      <Link
                        to="/episodi/$id"
                        params={{ id: a.episodio_id }}
                        onClick={(ev) => ev.stopPropagation()}
                        className="outline-none focus-visible:underline"
                      >
                        {a.episodio_titolo}
                      </Link>
                    </TableCell>
                    <TableCell>{a.data_uscita}</TableCell>
                    <TableCell>{durataBreve(a.istante)}</TableCell>
                    <TableCell className="truncate">{tipologia(a.tipologia)}</TableCell>
                    <TableCell className="text-viola">
                      <GlifoApri />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <ul className="flex flex-col gap-10">
            {elementi.map((a) => (
              <li
                key={a.id}
                data-testid="scheda-citato"
                onClick={() => apri(a.episodio_id)}
                className="flex cursor-pointer items-center gap-12 border-2 border-inchiostro bg-bianco px-12 py-10"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-4">
                  <span className="text-xs font-extrabold uppercase tracking-wide text-viola">
                    {a.episodio_numero ? `N° ${a.episodio_numero} · ` : ''}
                    {a.data_uscita}
                  </span>
                  <Link
                    to="/episodi/$id"
                    params={{ id: a.episodio_id }}
                    onClick={(ev) => ev.stopPropagation()}
                    className="truncate text-md font-bold outline-none focus-visible:underline"
                  >
                    {a.episodio_titolo}
                  </Link>
                  <span className="text-sm text-inchiostro-600">
                    {[durataBreve(a.istante), tipologia(a.tipologia)].filter(Boolean).join(' · ')}
                  </span>
                </div>
                <span className="text-viola">
                  <GlifoApri />
                </span>
              </li>
            ))}
          </ul>
        )}
        {totale > 0 && (
          <PaginazioneCompatta pagina={pagina} righe={RIGHE_CITATI} totale={totale} onPagina={setPagina} />
        )}
      </CardContent>
    </Card>
  )
}
