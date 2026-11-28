import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge deve conoscere i token dello stile C (docs/ui.md): senza,
// `shadow-pixel-md` e `shadow-rosa-acceso` sembrerebbero due colori d'ombra e
// il secondo cancellerebbe il primo.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['2xs', 'xs', 'sm', 'md', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl'],
      shadow: ['pixel-sm', 'pixel-md', 'pixel-lg', 'pixel-xl', 'pixel-2xl', 'pixel-3xl'],
      leading: ['titolo', 'compatta', 'testo', 'ariosa'],
      font: ['titolo', 'ui', 'testo'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
