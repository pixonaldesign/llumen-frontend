import { useMemo } from 'react'
import { GamiAssetModal } from './GamiAssetModal'
import { PRODUCTS, productViews } from './gamiInventory'

/** One of the listing's first ten products: the product in 3D with its figures, then its stock and supply chain. */
export function GamiProductModal({ product: id, onClose }: { product: string; onClose: () => void }) {
  const product = PRODUCTS.find((item) => item.id === id)!
  const views = useMemo(() => productViews(product), [product])
  return (
    <GamiAssetModal
      label="product details"
      title={product.name}
      sub={`${product.type} · ${product.source === 'Local' ? 'Made in the Kingdom' : `Imported from ${product.country}`} · ${product.maker}`}
      views={views}
      hint="Drag the model to turn it. Figures are from the national inventory register, updated daily."
      onClose={onClose}
    />
  )
}
