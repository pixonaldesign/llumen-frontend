/** Vendored Figma assets under public/llumen-assets/landing (not MCP URLs). */
const b = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets/landing`

export const landingAssets = {
  logoMark: `${b}/llumen-logo.png`,
  wordmark: `${b}/llumen-wordmark.svg`,
  userBtn: `${b}/user-btn.png`,
  slideMap: `${b}/slide-map.png`,
  recMapA: `${b}/rec-map-a.png`,
  recMapB: `${b}/rec-map-b.png`,
  recMapC: `${b}/rec-map-c.png`,
  recMapD: `${b}/rec-map-d.png`,
  recThumbA: `${b}/rec-thumb-a.png`,
  recThumbB: `${b}/rec-thumb-b.png`,
  recThumbC: `${b}/rec-thumb-c.png`,
  recThumbD: `${b}/rec-thumb-d.png`,
  image115: `${b}/image-115.png`,
  image116: `${b}/image-116.png`,
  image117: `${b}/image-117.png`,
  image118: `${b}/image-118.png`,
  image119: `${b}/image-119.png`,
  image120: `${b}/image-120.png`,
  image121: `${b}/image-121.png`,
  /** Figma Stories grid thumbs (node 1740:15946) */
  storyThumbMapBase: `${b}/story-thumb-map-base.png`,
  storyThumbMapMarkers: `${b}/story-thumb-map-markers.png`,
  /** Card/story alpha mask (node 1791:26707) — identical to story-mask.svg */
  storyThumbMask: `${b}/story-mask.svg`,
  storyThumbChartBase: `${b}/story-thumb-chart-base.png`,
  storyThumbChartBars: `${b}/story-thumb-chart-bars.png`,
  storyThumbBars: `${b}/story-thumb-bars.jpg`,
  assetLayerPermit: `${b}/asset-layer-permit.png`,
  assetLayerTerrain: `${b}/asset-layer-terrain.png`,
  assetLayerPins: `${b}/asset-layer-pins.png`,
  mapStyleAimsunTeal: `${b}/map-style-aimsun-teal.jpg`,
  mapStyleAimsunBase: `${b}/map-style-aimsun-base.png`,
  mapStyleAimsunDefault: `${b}/map-style-aimsun-default.png`,
  mapStyleAimsunLight: `${b}/map-style-aimsun-light.jpg`,
  mapStyleDubaiDarkBlue: `${b}/map-style-dubai-dark-blue.png`,
  mapStyleItc: `${b}/map-style-itc.jpg`,
} as const

/** Thumbnail variants from the Figma Stories grid — keep story copy separate. */
export type StoryThumbVariant = 'map' | 'chart' | 'satellite' | 'bars'

export function storyThumbLayers(variant: StoryThumbVariant): {
  image: string
  overlay?: string
} {
  switch (variant) {
    case 'map':
      return {
        image: landingAssets.storyThumbMapBase,
        overlay: landingAssets.storyThumbMapMarkers,
      }
    case 'chart':
      return {
        image: landingAssets.storyThumbChartBase,
        overlay: landingAssets.storyThumbChartBars,
      }
    case 'satellite':
      return { image: landingAssets.storyThumbChartBase }
    case 'bars':
      return { image: landingAssets.storyThumbBars }
  }
}
