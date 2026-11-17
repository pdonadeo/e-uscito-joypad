import { createFileRoute, redirect } from '@tanstack/react-router'
import { Shell } from '@/components/shell'
import { eErroreApi } from '@/lib/graphql'
import { utenteCorrente } from '@/lib/sessione'

// Tutte le pagine dietro il login: chiede `me` e, senza sessione valida, porta al login.
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    try {
      const me = await context.queryClient.ensureQueryData(utenteCorrente)
      return { me }
    } catch (e) {
      if (eErroreApi(e, 'UNAUTHENTICATED')) throw redirect({ to: '/login' })
      throw e
    }
  },
  component: Shell,
})
