import { createFileRoute, redirect } from '@tanstack/react-router'

// /new-bo apre l'elenco episodi, come il login (docs/ui.md, «Prototipo»).
export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    throw redirect({ to: '/episodi' })
  },
})
