import { ASSET_BASE } from "./host";
/** Figma-exported artwork for Chart-category visuals in `public/visuals-2/`. */
export const CHART_VISUAL_SRC: Record<string, string> = {
  "vertical-bar": "/visuals-2/vertical bar.svg",
  "horizontal-bar": "/visuals-2/horizontal bar.svg",
  "line-chart": "/visuals-2/line chart.svg",
  "area-chart": "/visuals-2/area chart.svg",
  "scatter-plot": "/visuals-2/scatter plot.svg",
  "donut-chart": "/visuals-2/donut chart.svg",
  "progress-bar": "/visuals-2/progress bar chart.svg",
  "gauge-linear": "/visuals-2/gauge chart.svg",
  "gauge-circular": "/visuals-2/gauge chart 2.svg",
  "polar-wind-rose": "/visuals-2/polar wind rose chart.svg",
  range: "/visuals-2/range chart.svg",
  availability: "/visuals-2/availability chart.svg",
  "kpi-card": "/visuals-2/KPI card chart.svg",
  "kpi-grid": "/visuals-2/KPI grid chart.svg",
  table: "/visuals-2/table chart.svg",
};

const CHART_PICKER_ICON_IDS = new Set([
  "vertical-bar",
  "horizontal-bar",
  "line-chart",
  "area-chart",
  "scatter-plot",
  "donut-chart",
  "progress-bar",
  "gauge-linear",
  "score-indicator",
  "polar-wind-rose",
  "range",
  "availability",
  "sankey-chart",
  "kpi-card",
  "kpi-grid",
  "table",
]);

export function getChartVisualSrc(visualId: string): string | undefined {
  const path = CHART_VISUAL_SRC[visualId];
  if (!path) return undefined;
  return encodeURI(`${ASSET_BASE}${path.replace(/^\/+/, "")}`);
}

export function getChartPickerIconSrc(visualId: string): string | undefined {
  const assetId = visualId === "legacy-kpi" ? "kpi-card" : visualId;
  if (!CHART_PICKER_ICON_IDS.has(assetId)) return undefined;
  return encodeURI(`${ASSET_BASE}figma/chart-types/${assetId}.svg?v=2`);
}

export function isChartVisualAsset(visualId: string): boolean {
  return visualId in CHART_VISUAL_SRC;
}
