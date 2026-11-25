# Llumen AI Frontend

Design prototype for the **Llumen AI** experience: a map-first Briefings landing, a Studio workspace for assets, apps and flows, AI conversations that answer with maps and charts, and full-screen data stories. Everything runs in a dark, frosted UI shell.

> **Live demo:** [pixonaldesign.github.io/llumen-frontend](https://pixonaldesign.github.io/llumen-frontend/)

This repository is a **frontend-only demo**. Conversations, findings, maps and stories are driven by local demo data. There is no production backend.

---

## What's in the demo

### Briefings (landing)
- A full-screen 3D Mapbox map of the current findings, with a carousel to step through them
- **Tell Me More** opens a conversation that grows out of the AI bar: the reply streams in on the left and its map slides in on the right
- **View** opens the finding as a full data story
- Finding toasts, alert auroras, a guided tour and an intro sequence
- A rail of live KPI cards beside the map

### Studio
- Overview with quick actions and recent assets, apps and flows
- Assets, Filters, Sources, Apps, Flows and Context pages
- **Create → Asset** opens the imported asset builder

### Stories
- Full-screen map stories with scenes, a playable time series, KPI and chart cards, annotations, timers and stopwatches
- Real-estate stories (towers, flood water, wind) and Dubai Municipality scenarios (odor, growth, floods, infrastructure)
- Edit mode for layers, cards, colors, backgrounds, comparisons and monitors, plus sharing

### Assistant
- Chat composer with modes, @ mentions, slash commands and sources
- Timeline replies (thinking steps, summary, follow-ups) with inline maps, KPIs, charts and slides
- Sessions, in-chat search, share, and data-profile and visualization panels

### Demo spaces and prototype switches
- `?space=dm` switches every surface to the Dubai Municipality demo (the default is the Abu Dhabi `llumen` space)
- **⌘K** opens the command palette, which switches landing variants, top bar, chat entry model, findings and Studio styles, data states and alert demos. Each switch is mirrored in the URL (`landing`, `bar`, `ux`, `findings`, `studio`, `shader`, `comparison`), so a link opens the same setup

---

## Tech stack

| Area | Choice |
| --- | --- |
| UI | React 19 + TypeScript |
| Bundler | Vite 8 (Rolldown) |
| Styling | CSS Modules, design tokens, Tailwind v4 (Vite plugin) |
| Motion | GSAP |
| Icons | Phosphor (regular, bold and fill only; see [CONTRIBUTING.md](CONTRIBUTING.md#icons)) |
| Maps | Mapbox GL v3 |
| Shaders | `@paper-design/shaders-react` (MeshGradient), OGL |
| Primitives | Radix Accordion + Scroll Area |
| Demo videos | Playwright + Remotion (dev only) |
| Deploy | GitHub Actions → GitHub Pages |

---

## Project structure

```text
.
├── .cursor/rules/                       # Agent rules (performance, scrollbars, demo recorder)
├── .github/workflows/deploy-pages.yml   # Build + Pages deploy and PR previews
├── component-library/                   # Llumen design-system reference CSS/HTML
├── demo-studio/                         # Demo recorder: replay, encode, Remotion composition, CLI
├── demos/                               # Saved demo recordings (JSON)
├── fonts/                               # Innovator Grotesk (self-hosted WOFF2)
├── public/
│   ├── asset-builder/                   # Asset builder's static files
│   └── llumen-assets/                   # Images, map icons, models, videos, flood data
├── scripts/                             # One-off data bakes and docs generators
├── src/
│   ├── App.tsx                          # Mounts CompactAssistantDemo (+ the demo recorder in dev)
│   ├── styles/tokens.css                # App tokens (fonts, spacing, type, materials)
│   ├── asset-builder/                   # Imported asset builder (scoped CSS)
│   ├── demo-recorder/                   # In-app demo capture (dev only)
│   └── llumen-assistant/
│       ├── CompactAssistantDemo.tsx     # Page shell: landing, Studio, stories, assistant lifecycle
│       ├── landing/                     # Briefings, conversation stage, findings, top bar
│       ├── studio/                      # Studio pages
│       ├── story/                       # Story view, StoryMap, edit panel, charts, annotations
│       ├── realEstate/                  # Real-estate stories and EstateMap
│       ├── municipality/                # Dubai Municipality scenarios
│       ├── prototypeChrome.ts           # URL-backed prototype switches
│       ├── demoSpace.ts                 # ?space= demo selection
│       └── *Demo*.ts / *Data*.ts        # Local demo payloads
├── index.html
├── CONTRIBUTING.md
└── vite.config.ts
```

The entry point is intentionally thin: `App` renders `CompactAssistantDemo`, which owns the landing, Studio, story layers, mesh background and assistant lifecycle.

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
- `preview` serves the production bundle locally. Measure performance here, not on the dev server

### Lint

```bash
npm run lint
```

---

## Configuration notes

### Vite base path
GitHub project Pages hosts the site at `https://pixonaldesign.github.io/llumen-frontend/`, so `vite.config.ts` sets `base: '/llumen-frontend/'` (overridable with `VITE_BASE`, which PR previews use). Asset helpers use `import.meta.env.BASE_URL`, so public assets resolve under that subpath.

### Build output
- Mapbox and React are emitted as their own long-cached chunks (`build.rolldownOptions.output.codeSplitting`), so a deploy only re-downloads app code.
- Story and real-estate views load lazily and are prefetched shortly after first paint.
- A small build plugin (`phosphorWeights`) strips unused Phosphor icon weights.

### CSS minify / backdrop blur
Vite 8 defaults CSS minify to Lightning CSS, which can drop unprefixed `backdrop-filter` when a `-webkit-` fallback is also present. Chromium then loses frosted-glass surfaces in production. This project forces `build.cssMinify: 'esbuild'`. Keep that setting (or an equivalent fix) if you change the build toolchain.

### Mapbox
The maps read their Mapbox public token from `VITE_MAPBOX_TOKEN`, committed in `.env`, so maps work locally and on Pages with no setup.

It is a public (`pk.`) token, which ships in the browser bundle by design. Keep it URL-restricted in the Mapbox dashboard. To use a different token locally, put `VITE_MAPBOX_TOKEN=...` in `.env.local` (gitignored), which overrides `.env`.

---

## Design system

Visual language comes from:

- `component-library/llumen-design-system.css`: reference tokens and patterns
- `src/styles/tokens.css`: app-facing CSS variables (`--lc-*`, spacing, radii, materials)
- Per-component CSS Modules under `src/llumen-assistant/**`

The app is **dark-theme only**. Surfaces use translucent fills plus `backdrop-filter` for frosted materials. Prefer design tokens over hard-coded colors when extending UI.

Typography:
- **UI:** Innovator Grotesk (self-hosted WOFF2 in `fonts/`, preloaded in `index.html`)
- **Arabic:** [Google Sans](https://fonts.google.com/specimen/Google+Sans), the open-source (SIL Open Font License) release, loaded from Google Fonts in `index.html` and second in every sans stack. Do not use the older `Google Sans Arabic` family: it is proprietary ("All Rights Reserved")
- **Mono / data:** IBM Plex Mono (loaded from Google Fonts in `index.html`)

---

## Imported apps

| App | Source | Lives in | Opens from |
| --- | --- | --- | --- |
| Asset builder | [pixonaldesign/llumen-asset-builder](https://github.com/pixonaldesign/llumen-asset-builder) | `src/asset-builder/`, `public/asset-builder/` | Top bar **Create → Asset** |
| Story Builder (approach-3) | [pixonaldesign/Story-Builder-](https://github.com/pixonaldesign/Story-Builder-) | `src/llumen-assistant/story/`, `public/llumen-assets/` | **View** on a finding, or any story card |

**Asset builder notes**
- Its global CSS is confined to the `.ab-scope` container by `postcss-prefix-selector` in `vite.config.ts`. Files under `src/asset-builder/` can keep plain global class names.
- Pop-ups mount through `portalRoot()` and public assets resolve through `ASSET_BASE`, both in `src/asset-builder/host.ts`. When syncing new code from the source repo, route any new `document.body` portals and `import.meta.env.BASE_URL` paths through those helpers.
- The source repo's landing page (`App.tsx`), entry file and fonts are not imported.

**Story Builder notes**
- Only the story experience is imported (from opening a story onward). Its landing page is not.
- The story's **Ask** button opens this app's assistant panel, so findings toasts, slash commands and agent replies are the ones from `src/llumen-assistant/`, not the source repo's.
- The previous story map view is kept for `?landing=feed` as `landing/FeedMap.tsx`.

---

## Demo recorder

Dev-only tool for recording product demo videos: click through a flow in `npm run dev`, then it replays the take in headless Chromium and composites it with Remotion (cursor, click ripples, keycaps, camera zooms). Nothing from it ships in the production build.

- ⌘K → **Demo · New recording…** to start a take
- `npm run demo -- <replay|render|make|studio> <name>` from the command line
- Run `npx playwright install chromium` once per machine
- Saved takes live in `demos/`; footage and renders go to `demo-out/` (gitignored)

Full workflow and gotchas: [.cursor/rules/demo-recorder.mdc](.cursor/rules/demo-recorder.mdc). Remotion is free for teams of up to 3 people; larger teams need a company licence.

---

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Its performance rules are also loaded automatically for Cursor agents from `.cursor/rules/performance.mdc`.

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
- Each preview is a full copy of the site (~70 MB) and Pages caps the site at 1 GB, so keep roughly a dozen pull requests open at most. Close stale ones to free space.

You can also re-run the workflow manually for `main` (**Actions → Deploy to GitHub Pages → Run workflow**).

**Pages settings required**
- Source: **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`

---

## Demo data & limitations

- Replies, sources, sessions, findings, maps and data profiles are **scripted demos** in TypeScript modules (for example `airQualityConversationDemo.ts`, `landing/landingAskReplies.ts`, `municipality/*Scenario.ts`).
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
| `npm run demo -- <command> <name>` | Demo recorder CLI (replay, render, make, studio) |

---

## License

Private repository (`"private": true` in `package.json`). All rights reserved unless otherwise noted by the owners.
