import { useState, type KeyboardEvent } from 'react'
import { CaretRight, PencilSimple, Plus, X } from '@phosphor-icons/react'
import { SCOPE_CLASS } from '../asset-builder/host'
import { commentAge } from './canvasItems'
import { Avatar } from './CanvasItemViews'
import { useNow } from './useNow'
import { versionTime, type VersionSummary } from './versionHistory'
import styles from './VersionHistoryPanel.module.css'

type VersionHistoryPanelProps = {
  versions: readonly VersionSummary[]
  /** The version on the canvas; null is the current one. */
  previewId: string | null
  onPreview: (id: string | null) => void
  onRename: (id: string, name: string) => void
  /** Saves the current canvas as a named version and returns its id. */
  onSave: () => string
  onRestore: () => void
  onClose: () => void
}

type Group = 'saved' | 'autosaved'
const GROUP_NAMES: Record<Group, string> = { saved: 'Saved versions', autosaved: 'Autosaved versions' }

export function VersionHistoryPanel({ versions, previewId, onPreview, onRename, onSave, onRestore, onClose }: VersionHistoryPanelProps) {
  const now = useNow()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [open, setOpen] = useState<Record<Group, boolean>>({ saved: true, autosaved: true })

  const newestFirst = [...versions].sort((a, b) => b.savedAt - a.savedAt)
  const named = newestFirst.filter((version) => version.name)
  const autosaves = newestFirst.filter((version) => !version.name)

  const finishRename = (id: string, value: string) => {
    setRenaming(null)
    const name = value.trim()
    if (name) onRename(id, name)
  }

  const onRenameKey = (event: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (event.key === 'Enter') finishRename(id, event.currentTarget.value)
    else if (event.key === 'Escape') {
      // The input can blur as it unmounts, which saves whatever it holds.
      event.currentTarget.value = versions.find((version) => version.id === id)?.name ?? ''
      setRenaming(null)
    }
  }

  const row = (version: VersionSummary) => {
    const title = version.name ?? versionTime(version.savedAt, now)
    return (
      <li key={version.id} className={styles.record}>
        {renaming === version.id ? (
          <input
            className={styles.renameInput}
            defaultValue={version.name ?? ''}
            placeholder={versionTime(version.savedAt, now)}
            aria-label="Version name"
            autoFocus
            onFocus={(event) => event.currentTarget.select()}
            onBlur={(event) => finishRename(version.id, event.currentTarget.value)}
            onKeyDown={(event) => onRenameKey(event, version.id)}
          />
        ) : (
          <button
            type="button"
            className={styles.row}
            aria-current={previewId === version.id || undefined}
            onClick={() => onPreview(version.id)}
            onDoubleClick={() => setRenaming(version.id)}
          >
            <span className={styles.rowTitle}>{title}</span>
            <span className={styles.authors}>
              {version.authors.map((author) => (
                <span key={author} className={styles.author}>
                  <Avatar author={author} small className={styles.avatar} />
                  {author}
                </span>
              ))}
            </span>
            {version.name ? <span className={styles.rowTime}>{commentAge(version.savedAt, now)}</span> : null}
          </button>
        )}
        {renaming === version.id ? null : (
          <button
            type="button"
            className={styles.rowAction}
            aria-label={version.name ? `Rename ${title}` : `Name the version from ${title}`}
            data-tooltip={version.name ? 'Rename' : 'Name this version'}
            onClick={() => setRenaming(version.id)}
          >
            <PencilSimple size={14} weight="regular" aria-hidden />
          </button>
        )}
      </li>
    )
  }

  const group = (id: Group, items: readonly VersionSummary[]) => {
    if (items.length === 0) return null
    const expanded = open[id]
    return (
      <section className={styles.group} aria-label={GROUP_NAMES[id]}>
        <button type="button" className={styles.groupToggle} aria-expanded={expanded} onClick={() => setOpen((current) => ({ ...current, [id]: !expanded }))}>
          <span className={styles.caretBox}>
            <CaretRight size={12} weight="bold" className={styles.caret} aria-hidden />
          </span>
          {items.length} {id} version{items.length === 1 ? '' : 's'}
        </button>
        {expanded ? <ol className={styles.records}>{items.map(row)}</ol> : null}
      </section>
    )
  }

  return (
    <aside className={styles.sheet} aria-label="Version history" data-covers-canvas>
      <header className={styles.head}>
        <h2 className={styles.title}>Version history</h2>
        <button
          type="button"
          className={styles.iconAction}
          aria-label="Save this version"
          data-tooltip="Save this version"
          onClick={() => {
            setOpen((current) => ({ ...current, saved: true }))
            setRenaming(onSave())
          }}
        >
          <Plus size={16} weight="bold" aria-hidden />
        </button>
        <button type="button" className={styles.iconAction} aria-label="Close version history" onClick={onClose}>
          <X size={16} weight="bold" aria-hidden />
        </button>
      </header>

      <div className={styles.scroll} data-native-scroll>
        <button type="button" className={styles.current} aria-current={previewId === null || undefined} onClick={() => onPreview(null)}>
          <span className={styles.currentIcon} aria-hidden />
          Current version
        </button>
        {group('saved', named)}
        {group('autosaved', autosaves)}
      </div>

      {previewId === null ? null : (
        <footer className={styles.foot}>
          <div className={SCOPE_CLASS} data-theme="dark" style={{ display: 'contents' }}>
            <button type="button" className={`pg-btn pg-btn--primary ${styles.restore}`} onClick={onRestore}>
              Restore this version
            </button>
          </div>
        </footer>
      )}
    </aside>
  )
}
