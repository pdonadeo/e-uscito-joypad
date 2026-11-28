import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
// I font del bo restano qui, in comune: index.css (Tailwind) li dichiara come token globali
// (font-titolo, font-testo, font-ui) e il design pubblico non è ancora deciso (Fase 2).
import '@fontsource/comfortaa/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/jetbrains-mono/latin-800.css'
import '@fontsource/nunito-sans/latin-400.css'
import './index.css'
import { eErroreApi } from '@/lib/errore-api'
import { routeTree } from './routeTree.gen'

// Un 401 (UNAUTHENTICATED) in qualunque richiesta del bo riporta al login (F-AU-03, F-AU-05):
// la sessione è scaduta, l'utente è stato disattivato o ha cambiato password altrove.
// La query `me` fa eccezione: la gestisce il beforeLoad di /bo/_app con un redirect.
// Le pagine pubbliche non hanno login: fuori da /bo il gestore non fa nulla.
// eErroreApi viene da lib/errore-api.ts, che non porta graphql-request nel chunk d'ingresso.
function suErrore(e: unknown) {
  if (!/^\/bo(\/|$)/.test(location.pathname)) return
  if (!eErroreApi(e, 'UNAUTHENTICATED')) return
  queryClient.removeQueries()
  void router.navigate({ to: '/bo/login' })
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (e, query) => {
      if (query.queryKey[0] !== 'me') suErrore(e)
    },
  }),
  mutationCache: new MutationCache({ onError: suErrore }),
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: false,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
