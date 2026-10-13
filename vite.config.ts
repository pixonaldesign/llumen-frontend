import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Project Pages site: https://pixonaldesign.github.io/llumen-frontend/
  base: '/llumen-frontend/',
  plugins: [react(), tailwindcss()],
  // Vite 8 defaults cssMinify to lightningcss, which drops unprefixed
  // `backdrop-filter` when `-webkit-backdrop-filter` is also present.
  // Chromium then ignores the webkit-only rule and frosted glass disappears.
  build: {
    cssMinify: 'esbuild',
  },
})
