import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { FormUtente } from '@/components/utenti/form-utente'
import { eErroreApi } from '@/lib/errore-api'
import { utente } from '@/lib/utenti'

// Modifica utente (F-UT-03, F-UT-05, F-UT-06). Il form parte sempre dal dettaglio completo,
// riletto a ogni apertura.
export const Route = createFileRoute('/bo/_app/utenti/$id')({
  params: {
    parse: ({ id }) => ({ id: Number(id) }),
    stringify: ({ id }) => ({ id: String(id) }),
  },
  loader: async ({ context, params }) => {
    if (!Number.isInteger(params.id) || params.id <= 0) throw notFound()
    // import dinamico: il loader finisce nel chunk d'ingresso della home, che non deve
    // portarsi dietro graphql-request (il componente usa l'import statico, nel suo chunk)
    const lib = await import('@/lib/utenti')
    try {
      await context.queryClient.fetchQuery(lib.utente(params.id))
    } catch (e) {
      if (eErroreApi(e, 'NOT_FOUND')) throw notFound()
      throw e
    }
  },
  component: ModificaUtente,
  notFoundComponent: NonTrovato,
})

function ModificaUtente() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(utente(id))
  return <FormUtente key={`${data.id}`} utente={data} />
}

// Stato non disegnato (proposta): utente inesistente, come per episodi e videogame.
function NonTrovato() {
  return (
    <div className="flex flex-col items-start gap-12">
      <p className="text-lg font-bold">Risorsa non trovata</p>
      <Link to="/bo/utenti" className="text-sm font-extrabold uppercase tracking-wide text-viola underline">
        Torna agli utenti
      </Link>
    </div>
  )
}
