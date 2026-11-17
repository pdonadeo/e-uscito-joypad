import { createFileRoute } from '@tanstack/react-router'
import { IntestazionePagina } from '@/components/intestazione-pagina'

// Elenco videogame (F-VG-01…F-VG-03, F-VG-07): il contenuto arriva nella seconda metà di 3.6c.
export const Route = createFileRoute('/_app/videogame')({
  component: () => <IntestazionePagina occhiello="Livello 2" titolo="Videogame" />,
})
