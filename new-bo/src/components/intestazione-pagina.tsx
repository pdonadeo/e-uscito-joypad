import { GlifoPlay } from '@/components/pixel-art'

// Occhiello «▶ LIVELLO …» e titolo della pagina (PNG degli elenchi, docs/ui.md).
export function IntestazionePagina({ occhiello, titolo }: { occhiello: string; titolo: string }) {
  return (
    <header className="flex flex-col gap-4">
      <p className="flex items-center gap-12 text-sm font-extrabold uppercase tracking-wider text-viola">
        <GlifoPlay misura="occhiello" />
        {occhiello}
      </p>
      <h1 className="font-titolo text-5xl font-bold text-inchiostro lg:text-6xl">{titolo}</h1>
    </header>
  )
}
