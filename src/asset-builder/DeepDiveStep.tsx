import { portalRoot } from "./host";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CaretDown,
  Check,
  GridFour,
  PencilSimple,
  X,
} from "@phosphor-icons/react";
import AddComponentModal from "./AddComponentModal";
import ComponentChartPreview from "./ComponentChartPreview";
import { componentById, type ComponentLibraryItem } from "./componentCatalog";
import {
  hasComponentPreviewImage,
  isCompactPreviewComponent,
  isLargeSquarePreviewComponent,
  isSquarePreviewComponent,
} from "./componentPreviewImages";
import { PlusIcon, TrashIcon } from "./icons";
import { allColumnNames } from "./mockDataset";
import { visualTypeById } from "./visualCatalog";
import WidgetFrame from "./WidgetFrame";

export type DeepDiveComponentRef = {
  uid: number;
  componentId: string;
  compact: boolean;
};

export type DeepDiveTab = {
  id: number;
  name: string;
  components: DeepDiveComponentRef[];
};

let tabUid = Date.now();
const nextTabId = () => ++tabUid;
let componentUid = 0;
const nextComponentUid = () => ++componentUid;

function createTab(name = "New Tab"): DeepDiveTab {
  return { id: nextTabId(), name, components: [] };
}

let activeCardDragGhost: HTMLElement | null = null;

function clearCardDragGhost() {
  activeCardDragGhost?.remove();
  activeCardDragGhost = null;
}

function setCardDragImage(e: React.DragEvent, card: HTMLElement) {
  clearCardDragGhost();
  const rect = card.getBoundingClientRect();
  const ghost = card.cloneNode(true) as HTMLElement;
  ghost.classList.add("dd-component-card--ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${rect.width}px`;
  ghost.style.height = `${rect.height}px`;
  ghost.style.position = "fixed";
  ghost.style.top = "-9999px";
  ghost.style.left = "0";
  portalRoot().appendChild(ghost);
  activeCardDragGhost = ghost;
  e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
}

const MODULAR_SLOT_COUNT = 24;
const DEFAULT_DATA_FIELDS = ["district_id", "district_name_ar", "municipality"];
const DATA_FIELD_OPTIONS = Array.from(
  new Set([...DEFAULT_DATA_FIELDS, ...allColumnNames()]),
);

function widgetTypeLabel(item: ComponentLibraryItem): string {
  const visual = visualTypeById(item.visualId);
  return visual?.label ?? item.type.replace(/_/g, " ");
}

function DeepDiveDataFields() {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const toggleField = (field: string) => {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  };

  return (
    <section className="dd-data-fields" aria-label="Optional data fields">
      <div className="dd-data-fields__picker" ref={pickerRef}>
        <div className="dd-data-fields__filter">
          <button
            type="button"
            className="dd-data-fields__filter-main"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            aria-controls="dd-data-fields-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="dd-data-fields__filter-label">Data fields</span>
          </button>
          <div className="dd-data-fields__filter-tokens">
            {selectedFields.map((field) => (
              <span className="dd-data-fields__filter-pill" key={field}>
                <span>{field}</span>
                <button
                  type="button"
                  aria-label={`Remove ${field}`}
                  onClick={() => toggleField(field)}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            className="dd-data-fields__filter-toggle"
            aria-label="Toggle data fields"
            aria-expanded={menuOpen}
            aria-haspopup="listbox"
            aria-controls="dd-data-fields-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <CaretDown
              className="dd-data-fields__filter-caret"
              size={15}
              weight="bold"
              aria-hidden="true"
            />
          </button>
        </div>
        {menuOpen && (
          <div
            id="dd-data-fields-menu"
            className="dd-data-fields__menu pg-surface-dropdown-menu"
            role="listbox"
            aria-label="Available data fields"
            aria-multiselectable="true"
          >
            <div className="dropdown-menu__inner">
              {DATA_FIELD_OPTIONS.map((field) => {
                const selected = selectedFields.includes(field);
                return (
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={
                      "dd-data-fields__option" +
                      (selected ? " is-selected" : "")
                    }
                    key={field}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => toggleField(field)}
                  >
                    <span className="dd-data-fields__checkbox" aria-hidden="true">
                      {selected && <Check size={12} weight="bold" />}
                    </span>
                    <span>{field}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function DeepDiveTabChip({
  tab,
  active,
  editing,
  dragging,
  dropTarget,
  onSelect,
  onEdit,
  onRename,
  onFinishRename,
  onCancelRename,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  tab: DeepDiveTab;
  active: boolean;
  editing: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onRename: (name: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  return (
    <div
      ref={chipRef}
      draggable
      className={
        "dd-tab" +
        (active ? " is-active" : "") +
        (dragging ? " is-dragging" : "") +
        (dropTarget ? " is-drop-target" : "")
      }
      onDragStart={(e) => {
        if (
          (e.target as HTMLElement).closest(
            ".dd-tab__edit-btn, .dd-tab__remove-btn, .dd-tab__confirm-btn, .dd-tab__cancel-btn, .dd-tab__input",
          )
        ) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-dd-tab-id", String(tab.id));
        onDragStart();
      }}
      aria-label={`Reorder ${tab.name}`}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      {editing ? (
        <>
          <input
            ref={inputRef}
            className="dd-tab__input"
            value={tab.name}
            onChange={(e) => onRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onFinishRename();
              if (e.key === "Escape") onCancelRename();
            }}
          />
          <button
            type="button"
            className="dd-tab__confirm-btn"
            aria-label={`Save ${tab.name}`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onClick={onFinishRename}
          >
            <Check size={15} weight="bold" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dd-tab__cancel-btn"
            aria-label="Cancel tab rename"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onClick={onCancelRename}
          >
            <X size={15} weight="bold" aria-hidden="true" />
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="dd-tab__label"
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onClick={onSelect}
          >
            {tab.name}
          </button>
          <button
            type="button"
            className="dd-tab__edit-btn"
            aria-label={`Edit ${tab.name}`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onClick={onEdit}
          >
            <PencilSimple size={16} weight="regular" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="dd-tab__remove-btn"
            aria-label={`Remove ${tab.name}`}
            draggable={false}
            onDragStart={(event) => event.preventDefault()}
            onClick={onRemove}
          >
            <TrashIcon width={16} height={16} aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}

function DeepDiveComponentCard({
  item,
  uid,
  compact,
  readOnly = false,
  dragging,
  dropTarget,
  onRemove,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  item: ComponentLibraryItem;
  uid: number;
  compact: boolean;
  readOnly?: boolean;
  dragging?: boolean;
  dropTarget?: boolean;
  onRemove: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
}) {
  const cardRef = useRef<HTMLElement>(null);

  const isCompactWidget = isCompactPreviewComponent(item.id);
  const isLargeSquareWidget = isLargeSquarePreviewComponent(item.id);
  const isSquareWidget = isSquarePreviewComponent(item.id);
  const isImageWidget = hasComponentPreviewImage(item.id);

  return (
    <article
      ref={cardRef}
      className={
        "dd-component-card" +
        (compact ? " dd-component-card--compact" : "") +
        (readOnly ? " dd-component-card--preview" : " dd-component-card--edit") +
        (isCompactWidget ? " dd-component-card--frame-compact" : "") +
        (isLargeSquareWidget ? " dd-component-card--frame-large-square" : "") +
        (isImageWidget ? " dd-component-card--frame-image" : "") +
        (dragging ? " is-dragging" : "") +
        (dropTarget ? " is-drop-target" : "")
      }
      aria-label={readOnly ? item.name : `Reorder ${item.name}`}
      draggable={!readOnly}
      style={{ height: "auto", aspectRatio: isSquareWidget ? "1 / 1" : "95 / 46" }}
      onDragStart={
        readOnly
          ? undefined
          : (e) => {
              if ((e.target as HTMLElement).closest(".dd-component-card__remove")) {
                e.preventDefault();
                return;
              }
              if (cardRef.current) setCardDragImage(e, cardRef.current);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("application/x-dd-component-uid", String(uid));
              onDragStart();
            }
      }
      onDragEnd={
        readOnly
          ? undefined
          : () => {
              clearCardDragGhost();
              onDragEnd();
            }
      }
      onDragOver={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              onDragOver();
            }
      }
      onDrop={
        readOnly
          ? undefined
          : (e) => {
              e.preventDefault();
              onDrop();
            }
      }
    >
      {readOnly ? (
        <div className="dd-component-card__body">
          <div className="dd-component-card__preview" aria-hidden="true">
            <ComponentChartPreview item={item} />
          </div>
        </div>
      ) : (
        <WidgetFrame
          typeLabel={widgetTypeLabel(item)}
          visualMode={hasComponentPreviewImage(item.id) ? "image" : "live"}
          size={isCompactWidget ? "compact" : "full"}
          isSelected={dropTarget}
          isDragging={dragging}
        >
          <ComponentChartPreview item={item} />
        </WidgetFrame>
      )}

      {!readOnly && (
        <button
          type="button"
          className="dd-component-card__remove"
          aria-label={`Remove ${item.name}`}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
        >
          <TrashIcon width={16} height={16} aria-hidden="true" />
        </button>
      )}
      {!readOnly && (
        <span
          className="resize-corner dd-component-card__resize-corner"
          aria-hidden="true"
        >
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M31 4V16A16 16 0 0 1 16 31H4" />
          </svg>
        </span>
      )}
    </article>
  );
}

function DeepDiveComponentGrid({
  components,
  readOnly = false,
  onRemove,
  onReorder,
}: {
  components: DeepDiveComponentRef[];
  readOnly?: boolean;
  onRemove: (uid: number) => void;
  onReorder: (fromUid: number, toUid: number) => void;
}) {
  const [dragUid, setDragUid] = useState<number | null>(null);
  const [dropUid, setDropUid] = useState<number | null>(null);
  const lastOverUid = useRef<number | null>(null);
  const dragUidRef = useRef<number | null>(null);

  const renderComponentCard = (component: DeepDiveComponentRef) => {
    const item = componentById(component.componentId);
    if (!item) return null;
    return (
      <DeepDiveComponentCard
        key={component.uid}
        uid={component.uid}
        item={item}
        compact={component.compact}
        readOnly={readOnly}
        dragging={dragUid === component.uid}
        dropTarget={dropUid === component.uid && dragUid !== component.uid}
        onRemove={() => onRemove(component.uid)}
        onDragStart={() => {
          dragUidRef.current = component.uid;
          setDragUid(component.uid);
        }}
        onDragEnd={() => {
          dragUidRef.current = null;
          lastOverUid.current = null;
          setDragUid(null);
          setDropUid(null);
        }}
        onDragOver={() => {
          const fromUid = dragUidRef.current;
          if (
            fromUid !== null &&
            fromUid !== component.uid &&
            lastOverUid.current !== component.uid
          ) {
            lastOverUid.current = component.uid;
            onReorder(fromUid, component.uid);
          }
          setDropUid(component.uid);
        }}
        onDrop={() => {
          lastOverUid.current = null;
          setDragUid(null);
          setDropUid(null);
        }}
      />
    );
  };

  if (!readOnly) {
    const usedSlots = components.reduce(
      (total, component) =>
        total +
        (isLargeSquarePreviewComponent(component.componentId)
          ? 4
          : isSquarePreviewComponent(component.componentId)
            ? 1
            : 2),
      0,
    );
    const remainingSlots = Math.max(0, MODULAR_SLOT_COUNT - usedSlots);
    return (
      <div
        className={"dd-panel__grid" + (dragUid !== null ? " is-reordering" : "")}
      >
        <div
          className="dd-modular-grid"
          onDragOver={(event) => {
            if (dragUidRef.current === null) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
        >
          {components.map((component) => renderComponentCard(component))}
          {Array.from({ length: remainingSlots }, (_, index) => (
            <div className="dd-modular-grid__slot" key={`slot-${index}`} aria-hidden="true" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="dd-panel__grid dd-panel__grid--preview">
      <div className="dd-modular-grid dd-modular-grid--preview-content">
        {components.map((component) => renderComponentCard(component))}
      </div>
    </div>
  );
}

function DeepDivePreviewModal({
  tabs,
  initialActiveTabId,
  onClose,
}: {
  tabs: DeepDiveTab[];
  initialActiveTabId: number;
  onClose: () => void;
}) {
  const [previewActiveTabId, setPreviewActiveTabId] = useState(initialActiveTabId);
  const activeTab = tabs.find((tab) => tab.id === previewActiveTabId) ?? tabs[0];

  return createPortal(
    <div
      className="dd-preview-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="dd-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dd-preview-modal-title"
      >
        <header className="dd-preview-modal__header">
          <h2 id="dd-preview-modal-title">Deep Dive Preview</h2>
          <button type="button" aria-label="Close Deep Dive preview" onClick={onClose}>
            <X size={18} weight="regular" aria-hidden="true" />
          </button>
        </header>

        {tabs.length > 1 && (
          <div className="dd-preview-tabs" role="tablist" aria-label="Deep dive preview tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                className={
                  "dd-preview-tab" + (tab.id === previewActiveTabId ? " is-active" : "")
                }
                aria-selected={tab.id === previewActiveTabId}
                onClick={() => setPreviewActiveTabId(tab.id)}
              >
                {tab.name}
              </button>
            ))}
          </div>
        )}

        <div className="dd-preview-modal__body">
          {activeTab && activeTab.components.length > 0 ? (
            <DeepDiveComponentGrid
              components={activeTab.components}
              readOnly
              onRemove={() => undefined}
              onReorder={() => undefined}
            />
          ) : (
            <div className="dd-preview-stage__empty">
              <GridFour size={28} weight="regular" aria-hidden="true" />
              <p>No assets added to this tab</p>
            </div>
          )}
        </div>
      </section>
    </div>,
    portalRoot(),
  );
}

export default function DeepDiveStep({
  onHasTabsChange,
  previewOpen = false,
  onPreviewClose,
}: {
  onHasTabsChange?: (hasTabs: boolean) => void;
  previewOpen?: boolean;
  onPreviewClose?: () => void;
}) {
  const [tabs, setTabs] = useState<DeepDiveTab[]>([]);
  const [activeTabId, setActiveTabId] = useState(0);
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [editingOriginalName, setEditingOriginalName] = useState("");
  const [dragTabId, setDragTabId] = useState<number | null>(null);
  const [dropTabId, setDropTabId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const lastOverTabId = useRef<number | null>(null);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const appliedIds = activeTab?.components.map((component) => component.componentId) ?? [];
  const hasTabs = tabs.length > 0;

  useEffect(() => {
    onHasTabsChange?.(hasTabs);
  }, [hasTabs, onHasTabsChange]);

  useEffect(() => {
    const seen = new Set<number>();
    let hasDuplicate = false;
    const normalized = tabs.map((tab) => {
      if (!seen.has(tab.id)) {
        seen.add(tab.id);
        return tab;
      }
      hasDuplicate = true;
      let id = nextTabId();
      while (seen.has(id)) id = nextTabId();
      seen.add(id);
      return { ...tab, id };
    });
    if (hasDuplicate) setTabs(normalized);
  }, [tabs]);

  const updateActiveTabComponents = useCallback(
    (updater: (components: DeepDiveComponentRef[]) => DeepDiveComponentRef[]) => {
      setTabs((current) =>
        current.map((tab) =>
          tab.id === activeTabId ? { ...tab, components: updater(tab.components) } : tab,
        ),
      );
    },
    [activeTabId],
  );

  const addTab = () => {
    const tab = createTab(tabs.length > 0 ? `New Tab ${tabs.length + 1}` : "New Tab");
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    setEditingTabId(null);
    setEditingOriginalName("");
  };

  const removeTab = (id: number) => {
    setTabs((current) => {
      const next = current.filter((tab) => tab.id !== id);
      if (activeTabId === id) setActiveTabId(next[0]?.id ?? 0);
      if (editingTabId === id) {
        setEditingTabId(null);
        setEditingOriginalName("");
      }
      return next;
    });
  };

  const renameTab = (id: number, name: string) => {
    setTabs((current) => current.map((tab) => (tab.id === id ? { ...tab, name } : tab)));
  };

  const startEditing = (id: number) => {
    setActiveTabId(id);
    setEditingOriginalName(tabs.find((tab) => tab.id === id)?.name ?? "");
    setEditingTabId(id);
  };

  const finishEditing = () => {
    setTabs((current) =>
      current.map((tab) =>
        tab.id === editingTabId ? { ...tab, name: tab.name.trim() || "New Tab" } : tab,
      ),
    );
    setEditingTabId(null);
    setEditingOriginalName("");
  };

  const cancelEditing = () => {
    setTabs((current) =>
      current.map((tab) =>
        tab.id === editingTabId ? { ...tab, name: editingOriginalName } : tab,
      ),
    );
    setEditingTabId(null);
    setEditingOriginalName("");
  };

  const reorderTabs = useCallback((fromId: number, toId: number) => {
    setTabs((current) => {
      const fromIndex = current.findIndex((tab) => tab.id === fromId);
      const toIndex = current.findIndex((tab) => tab.id === toId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const addComponents = (items: ComponentLibraryItem[]) => {
    if (!activeTab) return;
    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTab.id) return tab;
        const existing = new Set(tab.components.map((component) => component.componentId));
        const additions = items
          .filter((item) => !existing.has(item.id))
          .map((item) => ({
            uid: nextComponentUid(),
            componentId: item.id,
            compact: false,
          }));
        return { ...tab, components: [...tab.components, ...additions] };
      }),
    );
  };

  const removeComponent = (uid: number) => {
    updateActiveTabComponents((components) => components.filter((component) => component.uid !== uid));
  };

  const reorderComponents = (fromUid: number, toUid: number) => {
    updateActiveTabComponents((components) => {
      const fromIndex = components.findIndex((component) => component.uid === fromUid);
      const toIndex = components.findIndex((component) => component.uid === toUid);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return components;
      const next = [...components];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  return (
    <div className="dd-step">
      <header className="dd-step__head">
        <h2 className="dd-step__title">Deep Dive</h2>
      </header>

      <div className={"dd-tabs" + (dragTabId !== null ? " is-reordering" : "")}>
        {tabs.map((tab) => (
          <DeepDiveTabChip
            key={tab.id}
            tab={tab}
            active={tab.id === activeTabId}
            editing={editingTabId === tab.id}
            dragging={dragTabId === tab.id}
            dropTarget={dropTabId === tab.id && dragTabId !== tab.id}
            onSelect={() => {
              setActiveTabId(tab.id);
              setEditingTabId(null);
            }}
            onEdit={() => startEditing(tab.id)}
            onRename={(name) => renameTab(tab.id, name)}
            onFinishRename={finishEditing}
            onCancelRename={cancelEditing}
            onRemove={() => removeTab(tab.id)}
            onDragStart={() => setDragTabId(tab.id)}
            onDragEnd={() => {
              lastOverTabId.current = null;
              setDragTabId(null);
              setDropTabId(null);
            }}
            onDragOver={() => {
              if (
                dragTabId !== null &&
                dragTabId !== tab.id &&
                lastOverTabId.current !== tab.id
              ) {
                lastOverTabId.current = tab.id;
                reorderTabs(dragTabId, tab.id);
              }
              setDropTabId(tab.id);
            }}
            onDrop={() => {
              lastOverTabId.current = null;
              setDragTabId(null);
              setDropTabId(null);
            }}
          />
        ))}

        <button type="button" className="dd-tab-add" onClick={addTab}>
          <PlusIcon width={14} height={14} aria-hidden="true" />
          <span>Add Tab</span>
        </button>
      </div>

      {hasTabs && <DeepDiveDataFields />}

      {activeTab && (
        <section className="dd-panel" aria-label={`${activeTab.name} assets`}>
          <button type="button" className="dd-panel__add" onClick={() => setAddModalOpen(true)}>
            <PlusIcon width={14} height={14} aria-hidden="true" />
            <span>Add Asset</span>
          </button>

          {activeTab.components.length > 0 ? (
            <DeepDiveComponentGrid
              components={activeTab.components}
              onRemove={removeComponent}
              onReorder={reorderComponents}
            />
          ) : (
            <div className="dd-panel__empty" aria-label="No assets added to this tab">
              <div className="dd-modular-grid dd-modular-grid--empty" aria-hidden="true">
                {Array.from({ length: MODULAR_SLOT_COUNT }, (_, index) => (
                  <div className="dd-modular-grid__slot" key={index} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <AddComponentModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        excludedIds={appliedIds}
        onAdd={(items) => {
          addComponents(items);
          setAddModalOpen(false);
        }}
      />

      {previewOpen && onPreviewClose && (
        <DeepDivePreviewModal
          tabs={tabs}
          initialActiveTabId={activeTabId}
          onClose={onPreviewClose}
        />
      )}
    </div>
  );
}
