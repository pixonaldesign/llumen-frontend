# Contributing

Setup, scripts, branching and deployment are in the [README](README.md). This file covers how to keep the app fast as it grows.

## Performance

The bar is visual: never trade fidelity for speed. Keep the design exactly as it looks and make it cheaper to produce. Every rule below came from a measured problem in this codebase.

### Loading

- **Lazy-load whole views that are not on the first screen.** Story, real-estate and municipality views load with `React.lazy`, and `CompactAssistantDemo` prefetches them a few seconds after load so opening one never waits on the network. New full-screen views and heavy panels should follow the same pattern.
- **A static import undoes a lazy one.** Importing anything from a lazy module's file on the main path pulls that whole file back into the first download. Import shared helpers from their own module, and use `import type` when you only need a type.
- **Large libraries get their own chunk.** `build.rolldownOptions.output.codeSplitting.groups` in `vite.config.ts` keeps Mapbox and React in separate long-cached files, so a deploy only re-downloads app code. A new dependency over about 100 KB should either join a group or load lazily with the view that uses it.
- **Check the build output.** `npm run build` lists every chunk with its gzip size. If the `index` chunk grows by more than a few KB from your change, find out why before merging.

### Maps

- **Creating a Mapbox map blocks the main thread** (shader compile, style parse, first tile upload). Three maps created in one click cost about 60 ms each and caused visible stutter in the conversation open.
- **Do not mount maps that are hidden or animating in.** `LandingAskStage` mounts its map pane after the open animation finishes; follow the same pattern for any new map behind a transition.
- **Keep per-frame `setData` to small sources.** Each call re-parses and re-tiles the whole source on a worker. `StoryMap`'s column tweens do this on every frame and cost under 1 ms of main-thread time per frame, which holds 60 fps. A source many times larger would not. For large sources, set the data once and animate paint properties instead, and profile both versions, since changing a data-driven paint property also re-evaluates every feature.

### Shaders and canvases

- **Every full-screen `MeshGradient` sets `maxPixelCount={MESH_MAX_PIXEL_COUNT_DEMO_PAGE}`** (from `paperMeshConstants.ts`). Without it, a 2x display renders the shader at 4K for a soft blur that looks the same at 720p.
- **Stop animation that nobody can see.** Set `speed={0}` (which stops the shader's render loop) when the canvas is covered by an opaque layer, in another view, or off screen. The page backdrop pauses while the Briefings map fills the viewport, using an `IntersectionObserver` in `BriefingLanding`.
- **Any other `requestAnimationFrame` loop** must stop when its element is hidden or the tab is in the background.

### CSS

- **Use `filter: none`, not `filter: blur(0)`, at rest.** Any `filter` value, even a zero blur, renders the element through a separate filter pass.
- **Animate `transform` and `opacity`.** Animating `filter`, `backdrop-filter`, `width`, `height` or `top`/`left` repaints on every frame.
- **Keep `backdrop-filter` to visible surfaces.** A frosted panel re-blurs whatever is behind it on every frame that the content moves, and the landing map moves constantly. Drop it from hidden panels rather than relying on `opacity: 0`.
- **Keep `build.cssMinify: 'esbuild'`.** Lightning CSS drops unprefixed `backdrop-filter` and the frosted glass disappears (see README).

### Assets

- **Images:** WebP, sized at most 2x their largest on-screen size. A thumbnail shown at 640 px is 1280 px wide, never 4K. Use lossless WebP for UI captures and overlays with transparency so they look identical.
- **Fonts:** WOFF2 only. Weights used on the first screen get a `<link rel="preload">` in `index.html`. Arabic text uses Google Sans (the open-source release on Google Fonts) through the `--lc-font-sans` stack, so do not hardcode a font family without it. Never use the `Google Sans Arabic` family instead: it is the older proprietary release and triggers license warnings.
- **Delete what you stop using.** Every pull request preview copies all of `public/` and GitHub Pages caps the site at 1 GB, so unused files cost preview slots even though users never download them.

### Icons

Only the `regular`, `bold` and `fill` Phosphor weights ship. The `phosphorWeights` plugin in `vite.config.ts` removes the rest from production builds, so `thin`, `light` or `duotone` look fine in `npm run dev` but render nothing on the live site. To use another weight, add it to `ICON_WEIGHTS`.

### Measuring

- Measure the production build (`npm run build && npm run preview`), never the dev server, which skips minification and bundling.
- For interactions involving maps or shaders, record long tasks and frame times (a `PerformanceObserver` for `longtask` plus a `requestAnimationFrame` loop) over the interaction, before and after your change. Run it twice and compare the second run, since the first pays one-time costs such as shader compilation and tile downloads.
- State the numbers in the pull request description.
