import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import { visualizer } from "rollup-plugin-visualizer";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    outDir: "build",
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
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
