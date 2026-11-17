import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import '@fontsource/comfortaa/latin-700.css'
import '@fontsource/jetbrains-mono/latin-400.css'
import '@fontsource/jetbrains-mono/latin-700.css'
import '@fontsource/jetbrains-mono/latin-800.css'
import '@fontsource/nunito-sans/latin-400.css'
import './index.css'
import { Toaster } from '@/components/ui/sonner'
import { eErroreApi } from '@/lib/graphql'
import { routeTree } from './routeTree.gen'

// Un 401 (UNAUTHENTICATED) in qualunque richiesta riporta al login (F-AU-03, F-AU-05):
// la sessione è scaduta, l'utente è stato disattivato o ha cambiato password altrove.
// La query `me` fa eccezione: la gestisce il beforeLoad di /_app con un redirect.
function suErrore(e: unknown) {
  if (!eErroreApi(e, 'UNAUTHENTICATED')) return
  queryClient.removeQueries()
  void router.navigate({ to: '/login' })
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
  basepath: '/new-bo',
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
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
