import { createFileRoute, redirect } from '@tanstack/react-router'

// /bo apre l'elenco episodi, come il login (docs/ui.md, «Prototipo»).
export const Route = createFileRoute('/bo/_app/')({
  beforeLoad: () => {
    throw redirect({ to: '/bo/episodi' })
  },
})
