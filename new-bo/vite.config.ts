import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/new-bo/',
  plugins: [
    // il plugin del router va prima di react()
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: { outDir: 'dist' },
  server: {
    // in sviluppo l'API (GraphQL e REST della cover) è quella del compose
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: false } },
  },
})
