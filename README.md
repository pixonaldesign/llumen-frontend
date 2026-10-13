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

## Imported apps

| App | Source | Lives in | Opens from |
| --- | --- | --- | --- |
| Asset builder | [pixonaldesign/llumen-asset-builder](https://github.com/pixonaldesign/llumen-asset-builder) | `src/asset-builder/`, `public/asset-builder/` | Top bar **Create → Asset** |
| Story Builder (approach-3) | [pixonaldesign/Story-Builder-](https://github.com/pixonaldesign/Story-Builder-) | `src/llumen-assistant/story/`, `public/llumen-assets/` | Any story card on the landing |

**Asset builder notes**
- Its global CSS is confined to the `.ab-scope` container by `postcss-prefix-selector` in `vite.config.ts`. Files under `src/asset-builder/` can keep plain global class names.
- Pop-ups mount through `portalRoot()` and public assets resolve through `ASSET_BASE`, both in `src/asset-builder/host.ts`. When syncing new code from the source repo, route any new `document.body` portals and `import.meta.env.BASE_URL` paths through those helpers.
- The source repo's landing page (`App.tsx`), entry file and fonts are not imported.

**Story Builder notes**
- Only the story experience is imported (from opening a story onward). Its landing page is not.
- The story's **Ask** button opens this app's assistant panel, so findings toasts, slash commands and agent replies are the ones from `src/llumen-assistant/`, not the source repo's.
- The previous story map view is kept for `?landing=feed` as `landing/FeedMap.tsx`.

## Branching & sign-off

`main` is what devs receive: it is always the signed-off design and is what the live Pages site shows.

1. Branch off `main` for each piece of work (for example `design/story-landing` or `yourname/data-profile`).
2. Push the branch and open a pull request into `main`.
3. The **build** check runs on every pull request; it must pass.
4. One approval on the pull request is the sign-off. Once approved, merge it; the site redeploys automatically.

`main` is protected: no direct pushes, no force pushes, and merging needs a passing build plus one approval.

## Deployment

[.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) builds the site and publishes it to the `gh-pages` branch, which GitHub Pages serves.

| Trigger | Published at |
| --- | --- |
| Merge / push to `main` | `https://pixonaldesign.github.io/llumen-frontend/` |
| Open pull request from branch `design/story-landing` | `https://pixonaldesign.github.io/llumen-frontend/preview/design-story-landing/` |

### Branch previews
- Opening a pull request publishes a preview and posts its link as a comment on the pull request.
- Every push to that branch rebuilds the same link and edits the same comment (commit and time), so the link you share with reviewers never changes.
- The preview goes live a minute or two after the comment updates. If it is already open, hard-refresh (Ctrl+Shift+R).
- Closing or merging the pull request deletes the preview.
- Previews are only built for branches in this repo, not forks.
- Each preview is a full copy of the site (~75 MB) and Pages caps the site at 1 GB, so keep roughly a dozen pull requests open at most. Close stale ones to free space.

You can also re-run the workflow manually for `main` (**Actions → Deploy to GitHub Pages → Run workflow**).

**Pages settings required**
- Source: **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`

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
