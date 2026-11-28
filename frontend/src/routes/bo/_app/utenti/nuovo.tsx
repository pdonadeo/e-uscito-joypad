import { createFileRoute } from '@tanstack/react-router'
import { FormUtente } from '@/components/utenti/form-utente'

// Nuovo utente (F-UT-04): la schermata di modifica, vuota (docs/ui.md, «Schermate non disegnate»).
export const Route = createFileRoute('/bo/_app/utenti/nuovo')({
  component: () => <FormUtente utente={null} />,
})
