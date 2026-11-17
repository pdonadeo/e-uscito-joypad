import { createFileRoute, redirect } from '@tanstack/react-router'
import { IntestazionePagina } from '@/components/intestazione-pagina'

// Elenco utenti (F-UT-01, F-UT-02, F-UT-06), solo per i superuser (F-AU-04).
// Uno staff che apre l'indirizzo a mano torna agli episodi: la voce di menu non la vede.
// Il contenuto arriva nella seconda metà di 3.6c.
export const Route = createFileRoute('/_app/utenti')({
  beforeLoad: ({ context }) => {
    if (!context.me.is_superuser) throw redirect({ to: '/episodi' })
  },
  component: () => <IntestazionePagina occhiello="Livello segreto · solo superuser" titolo="Utenti" />,
})
