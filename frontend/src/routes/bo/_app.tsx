import { createFileRoute, redirect } from '@tanstack/react-router'
import { Shell } from '@/components/shell'
import { eErroreApi } from '@/lib/errore-api'

// Tutte le pagine dietro il login: chiede `me` e, senza sessione valida, porta al login.
// La sessione si importa in modo dinamico: la parte non separata della rotta finisce nel chunk
// d'ingresso della home, che non deve portarsi dietro graphql-request.
export const Route = createFileRoute('/bo/_app')({
  beforeLoad: async ({ context }) => {
    const { utenteCorrente } = await import('@/lib/sessione')
    try {
      const me = await context.queryClient.ensureQueryData(utenteCorrente)
      return { me }
    } catch (e) {
      if (eErroreApi(e, 'UNAUTHENTICATED')) throw redirect({ to: '/bo/login' })
      throw e
    }
  },
  component: Shell,
})
