import { createFileRoute } from '@tanstack/react-router'
import { IntestazionePagina } from '@/components/intestazione-pagina'

// Elenco episodi (F-EP-01…F-EP-04, F-EP-08): il contenuto arriva nella seconda metà di 3.6c.
export const Route = createFileRoute('/_app/episodi')({
  component: () => <IntestazionePagina occhiello="Livello 1" titolo="Episodi" />,
})
