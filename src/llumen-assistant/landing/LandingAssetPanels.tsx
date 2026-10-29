import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react'
import DataSourceDataProfile from '../../asset-builder/DataSourceDataProfile'
import DataSourceQueryPreview from '../../asset-builder/DataSourceQueryPreview'
import HighlightedSourceSql from '../../asset-builder/HighlightedSourceSql'
import { ASSET_BASE, SCOPE_CLASS } from '../../asset-builder/host'
import '../../asset-builder/llumen-design-system.css'
import '../../asset-builder/styles.css'
import styles from './LandingAssetPanels.module.css'

export type LandingAssetPanel = 'data' | 'source'

function sourceQuery(place: string) {
  return `SELECT
    g.grid_id,
    g.longitude,
    g.latitude,
    g.area_size_km2,
    p.population_count,
    p.population_count / g.area_size_km2 AS population_density,
    a.aqi,
    a.no2,
    a.pm25,
    a.status
FROM grid g
JOIN population_data p ON g.grid_id = p.grid_id
JOIN air_quality a ON g.grid_id = a.grid_id
WHERE g.district_name = '${place.replace(/'/g, "''")}'
ORDER BY population_density DESC;`
}

function DataPanel() {
  const [view, setView] = useState<'results' | 'profile'>('results')

  return (
    <>
      <div className="preview__data-tabs" role="tablist" aria-label="Asset data">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'results'}
          className={`preview__data-tab${view === 'results' ? ' is-active' : ''}`}
          onClick={() => setView('results')}
        >
          Data (1,467 rows)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'profile'}
          className={`preview__data-tab${view === 'profile' ? ' is-active' : ''}`}
          onClick={() => setView('profile')}
        >
          Data Profile
        </button>
      </div>
      {view === 'results' ? (
        <div className={`preview__stage preview__stage--query ${styles.query}`} role="tabpanel">
          <DataSourceQueryPreview />
        </div>
      ) : (
        <div className={`preview__stage preview__stage--profile ${styles.profile}`} role="tabpanel">
          <DataSourceDataProfile />
        </div>
      )}
    </>
  )
}

function SourcePanel({ place }: { place: string }) {
  return (
    <div className={`preview__stage preview__stage--source ${styles.source}`}>
      <div className="asset-source-preview">
        <div className="asset-source-preview__eyebrow">Database connection</div>
        <div className="asset-source-preview__connection">
          <img
            className="asset-source-preview__icon"
            src={`${ASSET_BASE}figma/source-types/database.svg?v=2`}
            alt=""
            width="30"
            height="30"
            draggable={false}
            aria-hidden="true"
          />
          <span className="asset-source-preview__connection-copy">
            <strong>Production MySQL</strong>
            <small>Datasource used by this visual</small>
          </span>
          <span className={styles.connectionMeta}>
            <span className="asset-source-preview__status">
              <CheckCircle size={14} weight="fill" aria-hidden />
              Connection established
            </span>
            <span className={styles.dataAsOf}>Data as of Oct 16, 07:52 PM</span>
          </span>
        </div>
        <div className="asset-source-preview__query-head">
          <h3>Query</h3>
        </div>
        <pre className={`asset-source-preview__query ${styles.sql}`}>
          <code>
            <HighlightedSourceSql value={sourceQuery(place)} />
          </code>
        </pre>
      </div>
    </div>
  )
}

/** The asset builder's Data and Source views, in its own style scope so its global CSS stays contained. */
export default function LandingAssetPanels({ panel, place }: { panel: LandingAssetPanel; place: string }) {
  return (
    <div className={styles.root}>
      <div className={`${SCOPE_CLASS} ${styles.scope}`} data-theme="dark">
        <div className={styles.stage}>{panel === 'data' ? <DataPanel /> : <SourcePanel place={place} />}</div>
      </div>
    </div>
  )
}
