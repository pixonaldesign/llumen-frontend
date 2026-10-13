import { visualTypeById } from "./visualCatalog";

export type ComponentSectionId = "backgrounds" | "insights" | "filters" | "custom";
export type ComponentSidebarId =
  | "suggested"
  | "analytics"
  | "population"
  | "landuse"
  | "mobility"
  | "traffic"
  | "real-estate"
  | "employees"
  | "itc"
  | "commerce"
  | "waste"
  | "maps"
  | "videos"
  | "images"
  | "colors";

export type BackgroundMapGroupId = "basemap" | "map_layers";

export interface ComponentListRow {
  id: string;
  name: string;
  category: string;
  type: string;
  date: string;
}

export interface ComponentLibraryItem extends ComponentListRow {
  slug: string;
  section: ComponentSectionId;
  sidebar: ComponentSidebarId;
  visualId: string;
  visualCategory: "chart" | "map-layer";
  backgroundGroup?: BackgroundMapGroupId;
}

export const COMPONENT_SECTIONS: { id: ComponentSectionId; label: string }[] = [
  { id: "insights", label: "Insights" },
  { id: "custom", label: "Custom" },
  { id: "filters", label: "Filters" },
];

export const COMPONENT_SIDEBARS: Record<ComponentSectionId, { id: ComponentSidebarId; label: string }[]> = {
  backgrounds: [
    { id: "maps", label: "Maps" },
    { id: "videos", label: "Videos" },
    { id: "images", label: "Images" },
    { id: "colors", label: "Colors" },
  ],
  insights: [
    { id: "suggested", label: "All Insights" },
    { id: "analytics", label: "Analytics" },
    { id: "population", label: "Population" },
    { id: "mobility", label: "Mobility" },
    { id: "traffic", label: "Traffic" },
    { id: "real-estate", label: "Real Estate" },
    { id: "employees", label: "Employees" },
    { id: "itc", label: "ITC" },
    { id: "commerce", label: "Commerce" },
    { id: "waste", label: "Waste" },
  ],
  filters: [
    { id: "suggested", label: "Suggested" },
    { id: "mobility", label: "Mobility" },
  ],
  custom: [{ id: "suggested", label: "Suggested" }],
};

export const BACKGROUND_MAP_GROUPS: { id: BackgroundMapGroupId; label: string }[] = [
  { id: "basemap", label: "Basemap" },
  { id: "map_layers", label: "Map Layers" },
];

const BASE_ROWS: Omit<ComponentListRow, "id">[] = [
  { name: "High-Heat Districts", category: "Market Heat", type: "Data_chart", date: "5/12/2026" },
  { name: "Average Price Gap to Benchmark", category: "Market Pricing", type: "Data_chart", date: "5/11/2026" },
  {
    name: "Carbon Abatement by Initiative Category",
    category: "Operations",
    type: "Data_chart",
    date: "5/10/2026",
  },
  { name: "Registration Completion Rate", category: "Market Operations", type: "Data_chart", date: "5/9/2026" },
  { name: "Quarterly Revenue Index", category: "Finance", type: "Data_chart", date: "5/7/2026" },
  { name: "Mobility Throughput", category: "Mobility", type: "Data_chart", date: "5/6/2026" },
  { name: "Seasonal Pollution Trends (Tons)", category: "Operations", type: "Data_chart", date: "5/6/2026" },
  { name: "Violation Frequency by Location", category: "Operations", type: "Data_chart", date: "5/6/2026" },
  { name: "Repeat Violation Rate", category: "Operations", type: "Data_chart", date: "5/6/2026" },
  { name: "Case Resolution Time", category: "Operations", type: "Data_chart", date: "5/6/2026" },
  { name: "Cost vs Utilization", category: "Operations", type: "Data_chart", date: "5/6/2026" },
  {
    name: "Initiative Efficiency",
    category: "Operations",
    type: "Data_chart",
    date: "5/6/2026",
  },
  {
    name: "Total Emission Exceedances",
    category: "Operations",
    type: "Data_chart",
    date: "5/6/2026",
  },
  {
    name: "% Wells Within Acceptable Water Quality Standards",
    category: "Operations",
    type: "Data_chart",
    date: "5/6/2026",
  },
  { name: "Annual Revenue Bar Chart", category: "Finance", type: "Data_chart", date: "4/21/2026" },
  { name: "Average Handling Cost", category: "Finance", type: "Data_chart", date: "4/25/2026" },
  { name: "Average Order Value", category: "Sales", type: "Data_chart", date: "4/6/2026" },
  { name: "Average Resolution Time", category: "Support", type: "Data_chart", date: "4/20/2026" },
  { name: "Average Response Latency", category: "Engineering", type: "Data_chart", date: "4/30/2026" },
  { name: "Average Session Duration", category: "Product", type: "Data_chart", date: "4/28/2026" },
  { name: "Average Ticket Volume", category: "Support", type: "Data_chart", date: "4/6/2026" },
  { name: "Average Time To Hire", category: "People", type: "Data_chart", date: "4/26/2026" },
  { name: "Average Traffic Speed By Road Type", category: "Traffic", type: "Data_chart", date: "4/27/2026" },
  { name: "Date Range Filter", category: "Filters", type: "Filter", date: "4/15/2026" },
  { name: "Location Filter", category: "Filters", type: "Filter", date: "4/14/2026" },
  { name: "High-Heat Districts Emerging", category: "Market Heat", type: "Map_layer", date: "5/12/2026" },
  { name: "Valuation Variance Trending Up", category: "Market Valuation", type: "Map_layer", date: "5/11/2026" },
  { name: "Registration Load Increasing", category: "Operations", type: "Map_layer", date: "5/9/2026" },
  { name: "High-Risk Trade Clusters", category: "Customs", type: "Map_layer", date: "5/8/2026" },
  { name: "Land Use Overlay", category: "Landuse", type: "Map_layer", date: "4/12/2026" },
  { name: "Road Network Background", category: "Mobility", type: "Map_layer", date: "4/11/2026" },
];

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function toId(name: string) {
  return toSlug(name);
}

function inferVisualId(name: string, type: string): string {
  const n = name.toLowerCase();
  if (type === "Filter") return "range";
  if (type === "Map_layer") {
    if (n.includes("heat")) return "heatmap";
    if (n.includes("land")) return "map-area";
    return "fences";
  }
  if (n.includes("donut") || n.includes("mix") || n.includes("stability")) return "donut-chart";
  if (n.includes("valuation risk")) return "area-chart";
  if (n.includes("progress") || n.includes("completion") || n.includes("coverage")) return "progress-bar";
  if (n.includes("gauge") || n.includes("score") || n.includes("reliability")) return "gauge-linear";
  if (n.includes("kpi") || n.includes("index") || n.includes("district")) return "kpi-card";
  if (n.includes("line") || n.includes("trend") || n.includes("latency") || n.includes("duration")) {
    return "line-chart";
  }
  if (n.includes("area") || n.includes("heat") || n.includes("exceedance")) return "area-chart";
  if (n.includes("top ") || n.includes("ranking") || n.includes("facilities")) return "horizontal-bar";
  if (n.includes("traffic") || n.includes("throughput") || n.includes("bar")) return "vertical-bar";
  return "vertical-bar";
}

function inferSection(row: Omit<ComponentListRow, "id">): ComponentSectionId {
  if (row.type === "Filter") return "filters";
  if (row.type === "Map_layer") return "backgrounds";
  if (
    row.category.startsWith("Market") ||
    row.category === "Finance" ||
    row.category === "Operations" ||
    row.category === "Mobility" ||
    row.category === "Traffic"
  ) {
    return "insights";
  }
  return "custom";
}

function inferSidebar(row: Omit<ComponentListRow, "id">, section: ComponentSectionId): ComponentSidebarId {
  if (section === "backgrounds") return "maps";
  if (row.category === "Traffic") return "traffic";
  if (row.category === "Mobility" || row.category === "Engineering" || row.category === "Product") {
    return "mobility";
  }
  if (row.category === "Landuse" || row.category === "Finance" || row.category === "Sales") {
    return "landuse";
  }
  if (section === "insights" && row.category.startsWith("Market")) return "suggested";
  if (section === "filters") return row.category === "Mobility" ? "mobility" : "suggested";
  return "suggested";
}

function inferSlug(row: Omit<ComponentListRow, "id">): string {
  if (row.name === "High-Heat Districts") return "market_heat.high_heat_district_count";
  if (row.name === "High-Heat Districts Emerging") return "market_heat/high_heat_districts_map";
  if (row.name === "Valuation Variance Trending Up") return "market_valuation/valuation_variance_trend_map";
  if (row.name === "Registration Load Increasing") return "operations/registration_load_heatmap";
  if (row.name === "High-Risk Trade Clusters") return "customs_high_risk_trade_cluster_map";
  if (row.name === "Average Price Gap to Benchmark") return "market_pricing.average_price_gap_benchmark";
  if (row.name === "Market Stability Score / Cluster Average") {
    return "market_stability.cluster_average_score";
  }
  if (row.name === "Registration Completion Rate") return "market_operations.registration_completion_rate";
  const prefix = row.category.toLowerCase().replace(/\s+/g, "_");
  return `${prefix}.${toSlug(row.name)}`;
}

function inferBackgroundGroup(
  row: Omit<ComponentListRow, "id">,
  section: ComponentSectionId,
): BackgroundMapGroupId | undefined {
  if (section !== "backgrounds" || row.type !== "Map_layer") return undefined;
  return "map_layers";
}

function buildLibraryItem(row: Omit<ComponentListRow, "id">): ComponentLibraryItem {
  const section = inferSection(row);
  const visualId = inferVisualId(row.name, row.type);
  const visual = visualTypeById(visualId);
  return {
    id: toId(row.name),
    ...row,
    slug: inferSlug(row),
    section,
    sidebar: inferSidebar(row, section),
    visualId,
    visualCategory: visual?.category ?? "chart",
    backgroundGroup: inferBackgroundGroup(row, section),
  };
}

export const COMPONENT_LIBRARY: ComponentLibraryItem[] = BASE_ROWS.map(buildLibraryItem);

export const COMPONENT_LIST_ROWS: ComponentListRow[] = COMPONENT_LIBRARY.map(
  ({ id, name, category, type, date }) => ({ id, name, category, type, date }),
);

export function componentById(id: string): ComponentLibraryItem | undefined {
  return COMPONENT_LIBRARY.find((item) => item.id === id);
}
