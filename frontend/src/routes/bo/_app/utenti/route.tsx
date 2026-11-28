import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

// Utenti (F-UT-01 … F-UT-06), solo per i superuser (F-AU-04). Uno staff che apre l'indirizzo a
// mano torna agli episodi: la voce di menu non la vede (e l'API risponderebbe FORBIDDEN).
export const Route = createFileRoute('/bo/_app/utenti')({
  beforeLoad: ({ context }) => {
    if (!context.me.is_superuser) throw redirect({ to: '/bo/episodi' })
  },
  component: Outlet,
})
