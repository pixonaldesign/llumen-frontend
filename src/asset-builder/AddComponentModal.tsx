import { portalRoot } from "./host";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChartBar, CheckCircle, Stack } from "@phosphor-icons/react";
import ComponentChartPreview from "./ComponentChartPreview";
import { SearchIcon, TrashIcon } from "./icons";
import {
  COMPONENT_LIBRARY,
  COMPONENT_SIDEBARS,
  type ComponentLibraryItem,
  type ComponentSectionId,
  type ComponentSidebarId,
} from "./componentCatalog";

const SECTIONS_WITH_CONTENT: ComponentSectionId[] = ["insights"];
const ALL_INSIGHTS_HIDDEN_IDS = new Set([
  "high_heat_districts",
  "average_price_gap_to_benchmark",
  "registration_completion_rate",
  "quarterly_revenue_index",
  "mobility_throughput",
  "annual_revenue_bar_chart",
  "average_handling_cost",
  "average_traffic_speed_by_road_type",
]);

type Props = {
  open: boolean;
  onClose: () => void;
  onAdd: (items: ComponentLibraryItem[]) => void;
  excludedIds?: string[];
};

function selectedItemType(item: ComponentLibraryItem): { label: string; icon: ReactNode } {
  if (item.visualCategory === "map-layer") {
    return { label: "Map Layer", icon: <Stack size={14} aria-hidden="true" /> };
  }
  if (item.type === "Filter") {
    return { label: "Filter", icon: <Stack size={14} aria-hidden="true" /> };
  }
  return { label: "Chart", icon: <ChartBar size={14} aria-hidden="true" /> };
}

function ComponentPickerCard({
  item,
  selected,
  disabled,
  onToggle,
}: {
  item: ComponentLibraryItem;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={
        "add-component-card" +
        (selected ? " is-selected" : "") +
        (disabled ? " is-disabled" : "")
      }
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={selected}
    >
      <span className="add-component-card__preview" aria-hidden="true">
        <ComponentChartPreview item={item} />
        {selected && (
          <span className="add-component-card__check">
            <CheckCircle size={24} weight="fill" aria-hidden="true" />
          </span>
        )}
      </span>
      <span className="add-component-card__content">
        <span className="add-component-card__name">{item.name}</span>
      </span>
    </button>
  );
}

export default function AddComponentModal({ open, onClose, onAdd, excludedIds = [] }: Props) {
  const section: ComponentSectionId = "insights";
  const [sidebar, setSidebar] = useState<ComponentSidebarId>("suggested");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sidebars = COMPONENT_SIDEBARS[section];
  const hasSectionContent = SECTIONS_WITH_CONTENT.includes(section);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIds(new Set());
      setSidebar("suggested");
    }
  }, [open]);

  useEffect(() => {
    if (!sidebars.some((item) => item.id === sidebar)) {
      setSidebar(sidebars[0]?.id ?? "suggested");
    }
  }, [section, sidebar, sidebars]);

  const filtered = useMemo(() => {
    if (!hasSectionContent) return [];
    const q = query.trim().toLowerCase();
    return COMPONENT_LIBRARY.filter((item) => {
      const showingAllInsights = section === "insights" && sidebar === "suggested";
      if (item.section !== section || (!showingAllInsights && item.sidebar !== sidebar)) return false;
      if (showingAllInsights && ALL_INSIGHTS_HIDDEN_IDS.has(item.id)) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [hasSectionContent, query, section, sidebar]);

  const selectedItems = useMemo(
    () =>
      Array.from(selectedIds)
        .map((id) => COMPONENT_LIBRARY.find((item) => item.id === id))
        .filter((item): item is ComponentLibraryItem => Boolean(item)),
    [selectedIds],
  );

  const toggleItem = (item: ComponentLibraryItem) => {
    if (excludedIds.includes(item.id)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const handleAdd = () => {
    const items = COMPONENT_LIBRARY.filter((item) => selectedIds.has(item.id));
    if (items.length === 0) return;
    onAdd(items);
  };

  if (!open) return null;

  return createPortal(
    <div className="add-component-overlay" role="dialog" aria-modal="true" aria-labelledby="add-component-title">
      <button type="button" className="add-component-overlay__backdrop" aria-label="Close" onClick={onClose} />
      <div className="add-component-modal">
        <header className="add-component-modal__header">
          <h2 id="add-component-title" className="add-component-modal__title">
            Add Asset
          </h2>

          <label className="add-component-modal__search">
            <SearchIcon width={20} height={20} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search assets..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        </header>

        <div
          className={
            "add-component-modal__body" +
            (!hasSectionContent ? " add-component-modal__body--no-sidebar" : "")
          }
        >
          {hasSectionContent && (
          <aside className="add-component-modal__sidebar" aria-label="Filter assets">
            {sidebars.map((item) => (
              <button
                key={item.id}
                type="button"
                className={"add-component-modal__sidebar-btn" + (sidebar === item.id ? " is-active" : "")}
                onClick={() => setSidebar(item.id)}
              >
                {item.label}
              </button>
            ))}
          </aside>
          )}

          <div className="add-component-modal__main">
            {hasSectionContent ? (
            <div className="add-component-modal__grid" role="list">
            {filtered.length > 0 ? (
              filtered.map((item) => (
                <ComponentPickerCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  disabled={excludedIds.includes(item.id)}
                  onToggle={() => toggleItem(item)}
                />
              ))
            ) : (
              <div className="add-component-modal__empty">
                <p>No assets match your search.</p>
              </div>
            )}
          </div>
            ) : (
              <div className="add-component-modal__main-empty" aria-hidden="true" />
            )}
          </div>

          <aside className="add-component-modal__selected" aria-label="Selected assets">
            <h3 className="add-component-modal__selected-title">Selected</h3>
            {selectedItems.length > 0 ? (
              <ul className="add-component-modal__selected-list">
                {selectedItems.map((item) => {
                  const type = selectedItemType(item);
                  return (
                    <li key={item.id} className="add-component-modal__selected-item">
                      <div className="add-component-modal__selected-copy">
                        <p className="add-component-modal__selected-name">{item.name}</p>
                        <span className="add-component-modal__selected-type">
                          {type.icon}
                          {type.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="add-component-modal__selected-remove"
                        aria-label={`Remove ${item.name}`}
                        onClick={() => toggleItem(item)}
                      >
                        <TrashIcon width={16} height={16} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </aside>
        </div>

        <footer className="add-component-modal__footer">
          <p className="add-component-modal__hint">
            You can add assets by drag and drop, or select multiple.
          </p>
          <button
            type="button"
            className="pg-btn pg-btn--primary add-component-modal__submit"
            disabled={selectedIds.size === 0}
            onClick={handleAdd}
          >
            Add Selected
          </button>
        </footer>
      </div>
    </div>,
    portalRoot(),
  );
}
