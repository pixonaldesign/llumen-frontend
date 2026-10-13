/** Vendored from Figma MCP → public/llumen-assets (SVG files; MCP sometimes mislabels them as PNG). */
const b = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/llumen-assets`

export const llumenAssets = {
  arrowRight: `${b}/arrow-right.svg`,
  arrowRightActive: `${b}/arrow-right-active.svg`,
  stack: `${b}/stack.svg`,
  caretDown: `${b}/caret-down.svg`,
  plus: `${b}/plus.svg`,
  microphone: `${b}/microphone.svg`,
  paramImage: `${b}/param-image.svg`,
  paramFile: `${b}/param-file.svg`,
  paramAt: `${b}/param-at.svg`,
  paramCalendar: `${b}/param-calendar.svg`,
  paramChart: `${b}/param-chart.svg`,
  orbOuter: `${b}/orb-outer.svg`,
  orbInner: `${b}/orb-inner.svg`,
  arrowsOut: `${b}/arrows-out.svg`,
  close: `${b}/close.svg`,
  launcherOrb: `${b}/launcher-orb.svg`,
  chartHighHeatDistricts: `${b}/chart-high-heat-districts.png`,
  chartPriceGapBenchmark: `${b}/chart-price-gap-benchmark.png`,
  mapStoreTrafficIndex: `${b}/map-store-traffic-index.png`,
  mapReturnsRate: `${b}/map-returns-rate.png`,
  mapBirdseyeDetail: `${b}/map-birdseye-detail.png`,
  mapAbuDhabiAqi: `${b}/map-abu-dhabi-aqi.png`,
  dataProfileSpatialAvailability: `${b}/data-profile-spatial-availability.webp`,
  aiGeneratedBadgeIcon: `${b}/ai-generated-badge-icon.svg`,
} as const
