import { charts } from "./chartModel";
import ChartPreview from "./ChartPreview";
import type { VisualType } from "./visualCatalog";

type Props = {
  visual: VisualType;
};

export default function StaticVisualPreview({ visual }: Props) {
  const chart = charts[visual.chartId];
  if (!chart) return null;

  return (
    <ChartPreview
      type={chart.preview}
      chartId={visual.chartId}
      visualId={visual.id}
      minimal
    />
  );
}
