import { AssetPreviewChart } from './AssetPreviewChart'
import type { CreateAssetSettings } from './createAsset'
import { DataViewBody } from './DataViews'
import { previewOf } from './flowData'
import { NodeAssetPreview } from './NodeAssetPreview'
import type { DataRecord } from './nodeCatalog'
import styles from './AssetVisual.module.css'

type AssetVisualProps = {
  settings: CreateAssetSettings
  rows: readonly DataRecord[]
  /** A map takes the pointer to pan and zoom. */
  interactive?: boolean
  /** `tile`: a short, fixed-height thumbnail for a grid of assets. */
  size?: 'full' | 'tile'
  maxRows?: number
}

/** An asset as it will look: a map or chart at a fixed height, a table at its rows' height. */
export function AssetVisual({ settings, rows, interactive = false, size = 'full', maxRows = 10 }: AssetVisualProps) {
  const preview = previewOf(settings.chartType)
  return (
    <div className={styles.visual} data-preview={preview} data-size={size}>
      {preview === 'map' ? (
        <NodeAssetPreview kind="map" data={{ view: settings, rows }} interactive={interactive} bare hint={false} />
      ) : preview === 'table' ? (
        <DataViewBody view="table" records={rows.slice(0, maxRows)} query="" bare />
      ) : (
        <AssetPreviewChart settings={settings} records={rows} flush />
      )}
    </div>
  )
}
