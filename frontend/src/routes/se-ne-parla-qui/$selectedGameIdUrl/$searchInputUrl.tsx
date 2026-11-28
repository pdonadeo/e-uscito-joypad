import { createFileRoute } from '@tanstack/react-router'

// Ricerca degli episodi in cui si parla di un videogame: segnaposto della Fase 1.
export const Route = createFileRoute('/se-ne-parla-qui/$selectedGameIdUrl/$searchInputUrl')({
  component: () => <main className="p-16">In costruzione.</main>,
})
