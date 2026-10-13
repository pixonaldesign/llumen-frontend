import { ASSET_BASE } from "./host";
/** Figma-exported card previews for the Add Component picker (`public/component-previews/`). */
export type ComponentPreviewFit = "wide" | "square" | "cover" | "fill";

export type ComponentPreviewImage = {
  src: string;
  fit?: ComponentPreviewFit;
  /** Shrinks the preview inside the box (0–1). Defaults to 1. */
  scale?: number;
};

export const COMPONENT_PREVIEW_IMAGES: Record<string, ComponentPreviewImage> = {
  high_heat_districts: { src: "/component-previews/high-heat-districts.png", fit: "wide" },
  average_price_gap_to_benchmark: {
    src: "/component-previews/average-price-gap-to-benchmark.png",
    fit: "wide",
  },
  carbon_abatement_by_initiative_category: {
    src: "/component-previews/carbon-abatement-by-initiative-category.png",
    fit: "wide",
  },
  registration_completion_rate: {
    src: "/component-previews/registration-completion-rate.png",
    fit: "wide",
  },
  transaction_value_registered: {
    src: "/component-previews/transaction-value-registered.png",
    fit: "square",
  },
  fee_revenue_potential: {
    src: "/component-previews/fee-revenue-potential.png",
    fit: "square",
  },
  seasonal_pollution_trends_tons: {
    src: "/component-previews/seasonal-pollution-trends.png",
    fit: "wide",
  },
  violation_frequency_by_location: {
    src: "/component-previews/violation-frequency-by-location.png",
    fit: "wide",
  },
  repeat_violation_rate: {
    src: "/component-previews/repeat-violation-rate.png?v=2",
    fit: "square",
  },
  case_resolution_time: {
    src: "/component-previews/case-resolution-time.png",
    fit: "square",
  },
  cost_vs_utilization: {
    src: "/component-previews/cost-vs-utilization.png",
    fit: "square",
  },
  initiative_efficiency: {
    src: "/component-previews/initiative-efficiency.png",
    fit: "wide",
  },
  total_emission_exceedances: {
    src: "/component-previews/total-emission-exceedances.png",
    fit: "wide",
  },
  wells_within_acceptable_water_quality_standards: {
    src: "/component-previews/wells-within-acceptable-water-quality-standards.png",
    fit: "wide",
  },
  high_heat_districts_emerging: {
    src: "/component-previews/high-heat-districts-emerging-map.png",
    fit: "cover",
  },
  valuation_variance_trending_up: {
    src: "/component-previews/valuation-variance-trend-map.png",
    fit: "cover",
  },
  registration_load_increasing: {
    src: "/component-previews/registration-load-heatmap.png",
    fit: "cover",
  },
  high_risk_trade_clusters: {
    src: "/component-previews/high-risk-trade-clusters-map.png",
    fit: "cover",
  },
};

export function getComponentPreviewImage(componentId: string): ComponentPreviewImage | undefined {
  const image = COMPONENT_PREVIEW_IMAGES[componentId];
  if (!image) return undefined;
  return {
    ...image,
    src: `${ASSET_BASE}${image.src.replace(/^\/+/, "")}`,
  };
}

export function isSquarePreviewComponent(componentId: string): boolean {
  return getComponentPreviewImage(componentId)?.fit === "square";
}

const COMPACT_PREVIEW_COMPONENT_IDS = new Set([
  "transaction_value_registered",
  "fee_revenue_potential",
  "repeat_violation_rate",
  "case_resolution_time",
]);

export function isCompactPreviewComponent(componentId: string): boolean {
  return COMPACT_PREVIEW_COMPONENT_IDS.has(componentId);
}

const LARGE_SQUARE_PREVIEW_COMPONENT_IDS = new Set(["cost_vs_utilization"]);

export function isLargeSquarePreviewComponent(componentId: string): boolean {
  return LARGE_SQUARE_PREVIEW_COMPONENT_IDS.has(componentId);
}

export function hasComponentPreviewImage(componentId: string): boolean {
  return componentId in COMPONENT_PREVIEW_IMAGES;
}
