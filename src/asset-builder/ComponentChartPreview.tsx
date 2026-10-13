import { useEffect, useState } from "react";
import ChartPreview from "./ChartPreview";
import VisualArtwork from "./VisualArtwork";
import { charts } from "./chartModel";
import { visualTypeById } from "./visualCatalog";
import type { ComponentLibraryItem } from "./componentCatalog";
import { createComponentPreviewCfg, getComponentPreviewProfile } from "./componentPreviewProfiles";
import { getComponentPreviewImage } from "./componentPreviewImages";

type Props = {
  item: ComponentLibraryItem;
};

function ComponentChartPreviewContent({ item }: Props) {
  if (item.type === "Filter" || item.visualCategory === "map-layer") {
    return (
      <div className="component-chart-preview component-chart-preview--illustration">
        <VisualArtwork visualId={item.visualId} category={item.visualCategory} size="preview" />
      </div>
    );
  }

  const visual = visualTypeById(item.visualId);
  const chartId = visual?.chartId ?? "bar";
  const chart = charts[chartId];
  const previewType = chart?.preview ?? "bar";
  const profile = getComponentPreviewProfile(item);

  return (
    <ChartPreview
      type={previewType}
      chartId={chartId}
      visualId={item.visualId}
      cfg={createComponentPreviewCfg(item)}
      series={profile.series}
      compact
    />
  );
}

export default function ComponentChartPreview({ item }: Props) {
  const preview = getComponentPreviewImage(item.id);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [item.id, preview?.src]);

  if (preview && !imageError) {
    const fit = preview.fit ?? "wide";
    const scale = preview.scale ?? 1;
    const size = `${92 * scale}%`;
    const imageStyle = {
      ...(scale < 1 ? { height: size, maxWidth: size, maxHeight: size } : {}),
    };
    return (
      <div className={`component-chart-preview component-chart-preview--image component-chart-preview--${fit}`}>
        <img
          className={`component-chart-preview__image component-chart-preview__image--${fit}`}
          src={preview.src}
          alt=""
          draggable={false}
          onError={() => setImageError(true)}
          style={Object.keys(imageStyle).length > 0 ? imageStyle : undefined}
        />
      </div>
    );
  }

  return <ComponentChartPreviewContent item={item} />;
}
