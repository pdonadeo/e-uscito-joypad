import { createFileRoute } from '@tanstack/react-router'
import { FormEpisodio } from '@/components/episodi/form-episodio'

// Nuovo episodio (F-EP-06): la schermata di modifica, vuota (docs/ui.md, «Schermate non disegnate»).
export const Route = createFileRoute('/_app/episodi/nuovo')({
  component: () => <FormEpisodio episodio={null} />,
})
