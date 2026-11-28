import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Segnaposto del blocco <head>: in produzione lo sostituisce Dream (Meta.blocco_head).
const MARCATORE_HEAD = '<!-- euj:head -->'

// Elenco dei chunk JS con i moduli che contengono, in dist/.vite/chunk.json: lo legge
// scripts/controlla-ingresso.ts per verificare che il chunk d'ingresso della home non si porti
// dietro il bo (AC-3). Rolldown (Vite 8) espone `moduleIds` sui chunk, come Rollup.
function elencoChunk(): Plugin {
  let outDir = 'dist'
  return {
    name: 'elenco-chunk',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir)
    },
    generateBundle(_, bundle) {
      const chunk = Object.values(bundle)
        .filter((c) => c.type === 'chunk')
        .map((c) => ({
          fileName: c.fileName,
          isEntry: c.isEntry,
          imports: c.imports,
          dynamicImports: c.dynamicImports,
          moduleIds: c.moduleIds,
        }))
      // writeBundle scriverebbe dopo il manifest; qui la cartella .vite può non esistere ancora
      mkdirSync(path.join(outDir, '.vite'), { recursive: true })
      writeFileSync(path.join(outDir, '.vite', 'chunk.json'), JSON.stringify(chunk, null, 2))
    },
  }
}

// Solo in sviluppo: senza Dream il marcatore diventerebbe una pagina senza titolo.
function headSviluppo(): Plugin {
  return {
    name: 'head-sviluppo',
    apply: 'serve',
    transformIndexHtml: (html) => html.replace(MARCATORE_HEAD, '<title>È uscito Joypad? (sviluppo)</title>'),
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [
    // il plugin del router va prima di react()
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    elencoChunk(),
    headSviluppo(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: { outDir: 'dist', manifest: true },
  server: {
    // in sviluppo l'API (GraphQL e REST) e i file caricati (cover) sono quelli del compose
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: false },
      '/bo/files': { target: 'http://localhost:5000', changeOrigin: false },
    },
  },
})
