import { useMemo } from 'react'
import { GamiAssetModal } from './GamiAssetModal'
import { facilityViews } from './gamiFacilities'
import { DOMAIN_LABEL, FACILITY_SITES } from './gamiPlaces'

/** A site opened from its map column: the plant in 3D with its figures, then its production and workforce. */
export function GamiFacilityModal({ site: id, onClose }: { site: string; onClose: () => void }) {
  const site = FACILITY_SITES.get(id)!
  const views = useMemo(() => facilityViews(site), [site])
  return (
    <GamiAssetModal
      label="facility details"
      title={site.name}
      sub={`${DOMAIN_LABEL[site.domain]} · ${site.city} · ${site.companies} companies`}
      views={views}
      hint="Drag the model to turn the plant. Figures are from the national industrial register."
      onClose={onClose}
    />
  )
}
