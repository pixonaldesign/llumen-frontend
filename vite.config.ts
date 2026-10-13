import tailwindcss from '@tailwindcss/vite'
import prefixSelector from 'postcss-prefix-selector'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const ASSET_BUILDER_SCOPE = '.ab-scope'

// https://vite.dev/config/
export default defineConfig({
  // Project Pages site: https://pixonaldesign.github.io/llumen-frontend/
  base: '/llumen-frontend/',
  plugins: [react(), tailwindcss()],
  css: {
    postcss: {
      plugins: [
        // The asset builder ships global CSS (resets, :root tokens, generic class names).
        // Confine it to its container so it cannot restyle the rest of the app.
        prefixSelector({
          prefix: ASSET_BUILDER_SCOPE,
          includeFiles: [/[\\/]src[\\/]asset-builder[\\/]/],
          transform(prefix, selector, prefixed) {
            if (selector === ':root' || selector === '#root') return prefix
            if (/^(html|body)\b/.test(selector)) return selector.replace(/^(html|body)/, prefix)
            return prefixed
          },
        }),
      ],
    },
  },
  // Vite 8 defaults cssMinify to lightningcss, which drops unprefixed
  // `backdrop-filter` when `-webkit-backdrop-filter` is also present.
  // Chromium then ignores the webkit-only rule and frosted glass disappears.
  build: {
    cssMinify: 'esbuild',
  },
})
