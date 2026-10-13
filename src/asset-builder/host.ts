/** Public assets for the asset builder live under `public/asset-builder/`. */
export const ASSET_BASE = `${import.meta.env.BASE_URL}asset-builder/`;

/** Class on the element that scopes the asset builder's global CSS (see vite.config.ts). */
export const SCOPE_CLASS = "ab-scope";

/** Portals must mount inside the scope element, or they lose the asset builder's styles. */
export function portalRoot(): HTMLElement {
  return document.querySelector<HTMLElement>(`.${SCOPE_CLASS}`) ?? document.body;
}
