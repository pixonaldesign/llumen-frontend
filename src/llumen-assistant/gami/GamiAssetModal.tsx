/**
 * The story's modal at a wider size: a view toggle over a grid of the story sidebar's 184px cells,
 * every asset covering whole cells. The part, product and facility details all open in it.
 */
import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { X } from '@phosphor-icons/react'
import edit from '../story/StoryEditPanel.module.css'
import styles from '../story/StoryView.module.css'
import { GamiCardBody } from './GamiCharts'
import { gridVars } from './gamiCardLayout'
import { toneCards } from './gamiScenario'
import type { GamiCard } from './gamiTypes'
import cards from './GamiCards.module.css'
import css from './GamiPartModal.module.css'

/** The widest the grid gets; narrower windows take four columns (GamiPartModal.module.css). */
const COLUMNS = 6

export type AssetModalView = { id: string; label: string; cards: GamiCard[] }

type Props = {
  /** Names the dialog and its close buttons, e.g. "part details". */
  label: string
  title: string
  sub: string
  /** One view hides the toggle. */
  views: [AssetModalView, ...AssetModalView[]]
  hint: string
  action?: { label: string; onClick: () => void }
  onClose: () => void
}

export function GamiAssetModal({ label, title, sub, views, hint, action, onClose }: Props) {
  const [viewId, setViewId] = useState(views[0].id)
  const view = views.find((item) => item.id === viewId) ?? views[0]

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const grid = toneCards(view.cards)

  return createPortal(
    <div className={edit.modalRoot}>
      <button type="button" className={edit.modalBackdrop} aria-label={`Close ${label}`} onClick={onClose} />
      <div
        className={`${edit.panel} ${edit.modal} ${css.modal}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gami-asset-title"
        dir="ltr"
      >
        <header className={edit.header}>
          <div className={edit.headerIdentity}>
            <div className={edit.headerCopy}>
              <h2 id="gami-asset-title" className={edit.title}>
                {title}
              </h2>
              <p className={css.sub}>{sub}</p>
            </div>
          </div>
          <div className={edit.headerActions}>
            <button type="button" className={edit.closeBtn} onClick={onClose} aria-label={`Close ${label}`}>
              <X size={18} weight="bold" aria-hidden />
            </button>
          </div>
        </header>

        {views.length > 1 ? (
          <div className={`${edit.segmentedControl} ${css.toggle}`} role="tablist" aria-label={`${title} view`}>
            {views.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                className={`${edit.segmentedBtn}${view.id === option.id ? ` ${edit.segmentedBtnActive}` : ''}`}
                aria-selected={view.id === option.id}
                onClick={() => setViewId(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <div key={view.id} className={css.scroll}>
          <div className={css.grid} role={views.length > 1 ? 'tabpanel' : undefined}>
            {grid.map((card, index) => (
              <section
                key={card.id}
                className={`${card.kind === 'cell' ? styles.kpiCellCard : styles.visualCard} ${cards.card} ${css.asset}`}
                style={{ ...gridVars(card, COLUMNS), '--i': index } as CSSProperties}
              >
                <GamiCardBody card={card} flat />
              </section>
            ))}
          </div>
        </div>

        <footer className={edit.assetsFooter}>
          <p className={edit.assetsHint}>{hint}</p>
          {action ? (
            <div className={edit.assetsFooterActions}>
              <button type="button" className={edit.assetsNext} onClick={action.onClick}>
                {action.label}
              </button>
            </div>
          ) : null}
        </footer>
      </div>
    </div>,
    document.body,
  )
}
