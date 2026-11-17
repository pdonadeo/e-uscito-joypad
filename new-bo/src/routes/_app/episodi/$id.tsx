import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { FormEpisodio } from '@/components/episodi/form-episodio'
import { episodio } from '@/lib/episodi'
import { eErroreApi } from '@/lib/graphql'

// Modifica episodio (F-EP-05, F-EP-07…F-EP-11, F-AS-03). Il form parte sempre dal dettaglio
// completo, riletto a ogni apertura (F-EP-05).
export const Route = createFileRoute('/_app/episodi/$id')({
  params: {
    parse: ({ id }) => ({ id: Number(id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  loader: async ({ context, params }) => {
    if (!Number.isInteger(params.id) || params.id <= 0) throw notFound()
    try {
      await context.queryClient.fetchQuery(episodio(params.id))
    } catch (e) {
      if (eErroreApi(e, 'NOT_FOUND')) throw notFound()
      throw e
    }
  },
  component: ModificaEpisodio,
  notFoundComponent: NonTrovato,
})

function ModificaEpisodio() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(episodio(id))
  // key: un altro episodio (o lo stesso riletto dopo «Crea») riparte da valori nuovi
  return <FormEpisodio key={`${data.id}`} episodio={data} />
}

// Stato non disegnato (proposta): episodio inesistente, con il messaggio del server.
function NonTrovato() {
  return (
    <div className="flex flex-col items-start gap-12">
      <p className="text-lg font-bold">Risorsa non trovata</p>
      <Link to="/episodi" className="text-sm font-extrabold uppercase tracking-wide text-viola underline">
        Torna agli episodi
      </Link>
    </div>
  )
}
