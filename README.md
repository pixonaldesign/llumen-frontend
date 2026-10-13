# Llumen AI Frontend

Design prototype for the core **Llumen AI** experience: an executive landing surface plus a floating AI assistant that streams answers, maps, KPIs, slides, and data profiles in a dark, frosted UI shell.

> **Live demo:** [pixonaldesign.github.io/llumen-frontend](https://pixonaldesign.github.io/llumen-frontend/)

This repository is a **frontend-only demo**. Conversation flows, maps, and panels are driven by local demo data — there is no production backend wired up yet.

---

## What’s in the demo

### Landing home
- Greeting and **attention carousel** with map / chart / AI cards
- Workspace and category filter pills
- Sticky frosted header (logo, search, Studio / Create actions)
- **Recommended for you** story cards
- Mesh-gradient page backdrop (Paper shaders), capped for GPU cost

### Floating AI assistant
- Launcher FAB that expands into a docked or fullscreen panel
- Chat composer with modes, attachments affordances, and send / stop states
- Streaming-style **timeline replies** (thinking steps → summary → follow-ups)
- **Inline visuals**: Mapbox map, KPI widgets, report thumbnails, image cards
- **@ mentions** / inline context menu for attaching sources mid-compose
- **Sessions** sidebar (open / share / new conversation)
- In-chat **search** with match count and prev / next navigation
- **Sources** panel and data-source settings
- Component detail views: map bleed header, slides, data profiles, visualization settings
- Share modal and AI-generated asset badges

---

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 19 + TypeScript |
| Bundler | Vite 8 |
| Styling | CSS Modules, design tokens, Tailwind v4 (Vite plugin) |
| Motion | GSAP |
| Icons | Phosphor |
| Maps | Mapbox GL |
| Shaders | `@paper-design/shaders-react` (MeshGradient) |
| Primitives | Radix Accordion + Scroll Area |
| Deploy | GitHub Actions → GitHub Pages |

---

## Project structure

```text
.
├── .github/workflows/deploy-pages.yml   # Build + Pages deploy
├── component-library/                   # Llumen design-system reference CSS/JS
├── fonts/                               # Innovator Grotesk (self-hosted)
├── public/llumen-assets/                # Static images used by landing + chat
├── src/
│   ├── App.tsx                          # Mounts CompactAssistantDemo
│   ├── main.tsx
│   ├── index.css
│   ├── styles/
│   │   ├── tokens.css                   # App tokens (spacing, type, materials)
│   │   └── scrollbar-auto-hide.css
│   └── llumen-assistant/                # Product UI + demo orchestration
│       ├── CompactAssistantDemo.tsx     # Page shell, mesh, panel state
│       ├── landing/                     # Landing home + carousel
│       ├── AssistantPanel.tsx
│       ├── ChatComposer.tsx
│       ├── AssistantTimelineReply.tsx
│       ├── InteractiveMap.tsx
│       ├── KpiWidgets.tsx
│       ├── SessionsPanel.tsx
│       ├── SourcesPanel.tsx
│       ├── *Demo*.ts / *Data*.ts         # Local demo payloads
│       └── *.module.css                 # Component styles
├── index.html
├── package.json
└── vite.config.ts
```

The entry point is intentionally thin: `App` renders `CompactAssistantDemo`, which owns the landing layer, mesh background, and assistant lifecycle.

---

## Getting started

### Requirements
- **Node.js 22+** (matches CI)
- npm (comes with Node)

### Install

```bash
npm install
```

### Local development

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173/llumen-frontend/`).  
The Vite `base` is set to `/llumen-frontend/` for GitHub Pages, so the app is served under that path locally as well.

### Production build

```bash
npm run build
npm run preview
```

- `build` runs `tsc -b` then `vite build` and writes to `dist/`
- `preview` serves the production bundle locally

### Lint

```bash
npm run lint
```

---

## Configuration notes

### Vite base path
GitHub project Pages hosts the site at:

`https://pixonaldesign.github.io/llumen-frontend/`

`vite.config.ts` sets:

```ts
base: '/llumen-frontend/'
```

Asset helpers under `src/llumen-assistant` already use `import.meta.env.BASE_URL`, so public assets resolve correctly under that subpath.

### CSS minify / backdrop blur
Vite 8 defaults CSS minify to Lightning CSS, which can drop unprefixed `backdrop-filter` when a `-webkit-` fallback is also present. Chromium then loses frosted-glass surfaces in production.

This project forces:

```ts
build: {
  cssMinify: 'esbuild',
}
```

Keep that setting (or an equivalent fix) if you change the build toolchain.

### Mapbox
The maps read their Mapbox public token from `VITE_MAPBOX_TOKEN`, committed in `.env`, so maps work locally and on Pages with no setup.

It is a public (`pk.`) token, which ships in the browser bundle by design. Keep it URL-restricted in the Mapbox dashboard. To use a different token locally, put `VITE_MAPBOX_TOKEN=...` in `.env.local` (gitignored), which overrides `.env`.

---

## Design system

Visual language comes from:

- `component-library/llumen-design-system.css` — reference tokens and patterns
- `src/styles/tokens.css` — app-facing CSS variables (`--lc-*`, spacing, radii, materials)
- Per-component CSS Modules under `src/llumen-assistant/**`

The app is **dark-theme only**. Surfaces use translucent fills plus `backdrop-filter` for frosted materials. Prefer design tokens over hard-coded colors when extending UI.

Typography:
- **UI:** Innovator Grotesk (self-hosted in `fonts/`)
- **Mono / data:** IBM Plex Mono (loaded from Google Fonts in `index.html`)

---

## Branching & sign-off

`main` is what devs receive: it is always the signed-off design and is what the live Pages site shows.

1. Branch off `main` for each piece of work (for example `design/story-landing` or `yourname/data-profile`).
2. Push the branch and open a pull request into `main`.
3. The **build** check runs on every pull request; it must pass.
4. One approval on the pull request is the sign-off. Once approved, merge it; the site redeploys automatically.

`main` is protected: no direct pushes, no force pushes, and merging needs a passing build plus one approval.

## Deployment

Pushes to `main` trigger [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml). Pull requests run the same build without deploying.

1. Checkout
2. Node 22 + `npm ci`
3. `npm run build`
4. Upload `dist/` as a Pages artifact
5. Deploy with `actions/deploy-pages`

You can also re-run the workflow manually (**Actions → Deploy to GitHub Pages → Run workflow**).

**Pages settings required**
- Source: **GitHub Actions** (not “Deploy from a branch”)
- That way Pages serves the Vite production build, not the raw repo `index.html`

---

## Demo data & limitations

- Replies, sources, sessions, AQI maps, and data profiles are **scripted demos** in TypeScript modules (for example `airQualityConversationDemo.ts`, `componentDataProfiles.ts`).
- There is no auth, persistence, or live LLM/API integration in this repo.
- Treat Mapbox tokens and any future secrets as temporary demo credentials.

---

## Scripts reference

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |

---

## License

Private repository (`"private": true` in `package.json`). All rights reserved unless otherwise noted by the owners.
