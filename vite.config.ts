import tailwindcss from '@tailwindcss/vite'
import prefixSelector from 'postcss-prefix-selector'
import { parseAst } from 'rolldown/parseAst'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { demoStudio } from './demo-studio/vitePlugin.ts'

const ASSET_BUILDER_SCOPE = '.ab-scope'

/** Phosphor draws every icon in six weights; the app only renders these. A weight outside this set draws nothing. */
const ICON_WEIGHTS = new Set(['regular', 'bold', 'fill'])

type Node = { type: string; start: number; end: number; [key: string]: unknown }

/** Drops the unused weights from each Phosphor icon's `new Map([[weight, drawing], ...])`. */
function phosphorWeights(): Plugin {
  return {
    name: 'phosphor-weights',
    apply: 'build',
    transform: {
      filter: { id: /[\\/]@phosphor-icons[\\/]react[\\/]dist[\\/]defs[\\/]/ },
      handler(code) {
        const lists: Node[] = []
        const visit = (node: unknown) => {
          if (!node || typeof node !== 'object') return
          if (Array.isArray(node)) return node.forEach(visit)
          const n = node as Node
          const callee = n.callee as Node | undefined
          const [list] = (n.arguments as Node[] | undefined) ?? []
          if (n.type === 'NewExpression' && callee?.name === 'Map' && list?.type === 'ArrayExpression') lists.push(list)
          Object.values(n).forEach(visit)
        }
        visit(parseAst(code))
        let out = code
        for (const list of lists.sort((a, b) => b.start - a.start)) {
          const entries = list.elements as Node[]
          const weightOf = (entry: Node) => ((entry.elements as Node[] | undefined)?.[0]?.value as string | undefined) ?? ''
          const kept = entries.filter((entry) => ICON_WEIGHTS.has(weightOf(entry)))
          if (!kept.some((entry) => weightOf(entry) === 'regular')) continue
          const rebuilt = `[${kept.map((entry) => code.slice(entry.start, entry.end)).join(',')}]`
          out = out.slice(0, list.start) + rebuilt + out.slice(list.end)
        }
        return out === code ? null : { code: out, map: null }
      },
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Project Pages site: https://pixonaldesign.github.io/llumen-frontend/
  // PR previews are built under /llumen-frontend/preview/<branch>/ (see deploy-pages.yml).
  base: process.env.VITE_BASE || '/llumen-frontend/',
  plugins: [react(), tailwindcss(), demoStudio(), phosphorWeights()],
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
    rolldownOptions: {
      output: {
        // Libraries that rarely change get their own long-cached files, so a deploy only re-downloads app code.
        codeSplitting: {
          groups: [
            { name: 'mapbox', test: /[\\/]node_modules[\\/]mapbox-gl[\\/]/ },
            { name: 'react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
})
