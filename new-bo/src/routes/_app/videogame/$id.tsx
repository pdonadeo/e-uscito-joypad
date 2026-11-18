import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { FormVideogame } from '@/components/videogame/form-videogame'
import { eErroreApi } from '@/lib/graphql'
import { videogame } from '@/lib/videogame'

// Modifica videogame (F-VG-04, F-VG-06, F-VG-07, F-VG-08). Il form parte sempre dal dettaglio
// completo, riletto a ogni apertura.
export const Route = createFileRoute('/_app/videogame/$id')({
  params: {
    parse: ({ id }) => ({ id: Number(id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  loader: async ({ context, params }) => {
    if (!Number.isInteger(params.id) || params.id <= 0) throw notFound()
    try {
      await context.queryClient.fetchQuery(videogame(params.id))
    } catch (e) {
      if (eErroreApi(e, 'NOT_FOUND')) throw notFound()
      throw e
    }
  },
  component: ModificaVideogame,
  notFoundComponent: NonTrovato,
})

function ModificaVideogame() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(videogame(id))
  return <FormVideogame key={`${data.id}`} videogame={data} />
}

// Stato non disegnato (proposta): videogame inesistente, come per gli episodi.
function NonTrovato() {
  return (
    <div className="flex flex-col items-start gap-12">
      <p className="text-lg font-bold">Risorsa non trovata</p>
      <Link to="/videogame" className="text-sm font-extrabold uppercase tracking-wide text-viola underline">
        Torna ai videogame
      </Link>
    </div>
  )
}
