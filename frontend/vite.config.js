import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "build",
    rollupOptions: {
      // due entry: il sito pubblico e l'admin (/bo), con chunk separati
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        bo: resolve(import.meta.dirname, "bo/index.html"),
      },
      plugins: [visualizer()],
    },
  },
  plugins: [
    react(),
    svgr({
      include: ["./src/icons/*.svg?react"],
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      // prima di "/api": senza changeOrigin l'Host resta quello di Vite, così
      // il controllo Origin/Referer di /api/bo accetta le richieste dell'admin
      "/api/bo": {
        target: "http://127.0.0.1:5000",
      },
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
      "/bo/files": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true,
      },
    },
  },
});
