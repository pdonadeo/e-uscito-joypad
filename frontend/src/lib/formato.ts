import { useSyncExternalStore } from 'react'

// Formato del disegno (docs/ui.md, «Comportamento responsive»): desktop da lg (1024 px).
// Serve dove 390 e desktop hanno componenti diversi (tabella o schede): si monta solo quello
// giusto, invece di nasconderne uno con il CSS, così lo stato del form non è doppio.
const QUERY_DESKTOP = '(min-width: 1024px)'

function iscrivi(cambia: () => void) {
  const mq = window.matchMedia(QUERY_DESKTOP)
  mq.addEventListener('change', cambia)
  return () => mq.removeEventListener('change', cambia)
}

export function useDesktop(): boolean {
  return useSyncExternalStore(iscrivi, () => window.matchMedia(QUERY_DESKTOP).matches)
}
