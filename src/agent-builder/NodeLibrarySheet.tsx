import { useEffect, useState } from 'react'
import { ArrowLeft, CaretRight, MagnifyingGlass, X } from '@phosphor-icons/react'
import { NODE_CATEGORIES, NODE_DRAG_MIME, NODE_TYPES, type NodeCategoryId, type NodeType } from './nodeCatalog'
import tones from './nodeTones.module.css'
import styles from './NodeLibrarySheet.module.css'

type NodeLibrarySheetProps = {
  /** Singleton node types that are already on the canvas. */
  usedTypes: ReadonlySet<string>
  onAdd: (typeId: string) => void
  onClose: () => void
}

export function NodeLibrarySheet({ usedTypes, onAdd, onClose }: NodeLibrarySheetProps) {
  const [categoryId, setCategoryId] = useState<NodeCategoryId | null>(null)
  const [query, setQuery] = useState('')
  const category = NODE_CATEGORIES.find((item) => item.id === categoryId)
  const normalizedQuery = query.trim().toLowerCase()

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const matches = (type: NodeType) =>
    normalizedQuery === '' ||
    type.title.toLowerCase().includes(normalizedQuery) ||
    type.description.toLowerCase().includes(normalizedQuery)

  const groups = (category ? [category] : NODE_CATEGORIES)
    .map((group) => ({ ...group, types: NODE_TYPES.filter((type) => type.category === group.id && matches(type)) }))
    .filter((group) => group.types.length > 0)

  const openCategory = (id: NodeCategoryId | null) => {
    setCategoryId(id)
    setQuery('')
  }

  return (
    <aside className={styles.panel} aria-label="Add node" data-native-scroll>
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          {category ? (
            <button type="button" className={styles.backBtn} aria-label="Back to categories" onClick={() => openCategory(null)}>
              <ArrowLeft size={18} weight="bold" aria-hidden />
            </button>
          ) : null}
          <div className={styles.headerCopy}>
            <h2 className={styles.title}>{category?.title ?? 'Add Node'}</h2>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.closeBtn} aria-label="Close node library" onClick={onClose}>
            <X size={18} weight="bold" aria-hidden />
          </button>
        </div>
      </header>

      <label className={styles.search}>
        <MagnifyingGlass size={18} aria-hidden />
        <input
          // Remount per view so focus lands in the field after switching category.
          key={categoryId ?? 'root'}
          autoFocus
          value={query}
          placeholder="Search nodes..."
          aria-label="Search nodes"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <div className={styles.scroll}>
        {!category && normalizedQuery === '' ? (
          <section className={styles.section}>
            <h3 className={styles.eyebrow}>Categories</h3>
            <div className={styles.categoryList}>
              {NODE_CATEGORIES.map((item) => (
                <button key={item.id} type="button" className={styles.categoryCard} onClick={() => openCategory(item.id)}>
                  <span className={styles.categoryText}>
                    <span className={styles.categoryTitle}>{item.title}</span>
                    <span className={styles.categoryDescription}>{item.description}</span>
                  </span>
                  <CaretRight size={18} weight="regular" className={styles.categoryChevron} aria-hidden />
                </button>
              ))}
            </div>
          </section>
        ) : groups.length === 0 ? (
          <p className={styles.empty}>No matching nodes</p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className={styles.section}>
              {category ? null : <h3 className={styles.eyebrow}>{group.title}</h3>}
              <div className={styles.nodeList}>
                {group.types.map((type) => {
                  const TypeIcon = type.icon
                  const used = Boolean(type.singleton && usedTypes.has(type.id))
                  return (
                    <button
                      key={type.id}
                      type="button"
                      className={styles.nodeRow}
                      disabled={used}
                      draggable={!used}
                      title={type.description}
                      onClick={() => onAdd(type.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(NODE_DRAG_MIME, type.id)
                        event.dataTransfer.effectAllowed = 'copy'
                      }}
                    >
                      <span className={`${styles.nodeIcon} ${tones[`tone_${type.tone}`]}`} aria-hidden>
                        <TypeIcon size={20} weight="regular" />
                      </span>
                      <span className={styles.nodeText}>
                        <span className={styles.nodeTitle}>{type.title}</span>
                        <span className={styles.nodeDescription}>{type.description}</span>
                        {used ? <span className={styles.onceChip}>This node can only be added once</span> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </aside>
  )
}
