import { portalRoot } from "./host";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  CalendarBlank,
  MapPin,
  Shapes,
  SlidersHorizontal,
  User,
} from "@phosphor-icons/react";
import { ChevronDownIcon, PlusIcon, TrashIcon } from "./icons";
import Dropdown from "./Dropdown";

type FilterType = "DateRange" | "Lookup" | "Dropdown" | "Slider" | "Text";

export type FilterOption = {
  id: string;
  title: string;
  type: FilterType;
  icon: ReactNode;
};

type AppliedFilter = {
  uid: number;
  filter: FilterOption;
  mappedField: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  {
    id: "date-range",
    title: "Date Range Filter",
    type: "DateRange",
    icon: <CalendarBlank size={18} weight="regular" aria-hidden="true" />,
  },
  {
    id: "location",
    title: "Location Filter",
    type: "Lookup",
    icon: <MapPin size={18} weight="regular" aria-hidden="true" />,
  },
  {
    id: "category",
    title: "Category Filter",
    type: "Dropdown",
    icon: <Shapes size={18} weight="regular" aria-hidden="true" />,
  },
  {
    id: "range-slider",
    title: "Range Slider Filter",
    type: "Slider",
    icon: <SlidersHorizontal size={18} weight="regular" aria-hidden="true" />,
  },
  {
    id: "user",
    title: "User Filter",
    type: "Text",
    icon: <User size={18} weight="regular" aria-hidden="true" />,
  },
];

const MAP_TO_FIELDS = [
  "Date",
  "Time",
  "Timestamp",
  "Category",
  "Region",
  "Grid ID",
  "Longitude",
  "Latitude",
  "Population Count",
  "Area Size (km²)",
  "Population Density",
  "Sales",
  "Revenue",
  "Quantity",
  "End Longitude",
  "End Latitude",
  "Distance",
];

let filterUid = 0;
const nextFilterUid = () => ++filterUid;

let activeDragGhost: HTMLElement | null = null;

function clearRowDragGhost() {
  activeDragGhost?.remove();
  activeDragGhost = null;
}

function setRowDragImage(e: React.DragEvent, row: HTMLElement) {
  clearRowDragGhost();
  const rect = row.getBoundingClientRect();
  const ghost = row.cloneNode(true) as HTMLElement;
  ghost.classList.add("filters-applied-row--ghost");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.width = `${rect.width}px`;
  ghost.style.position = "fixed";
  ghost.style.top = "-9999px";
  ghost.style.left = "0";
  portalRoot().appendChild(ghost);
  activeDragGhost = ghost;
  e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
}

type FlyoutPos = { top: number; left: number; width: number };

function measureFlyoutPosition(trigger: HTMLElement | null, minWidth: number, gap = 6): FlyoutPos | null {
  if (!trigger) return null;
  const rect = trigger.getBoundingClientRect();
  return {
    top: rect.bottom + gap,
    left: rect.left,
    width: Math.max(rect.width, minWidth),
  };
}

function FilterPickerRow({
  filter,
  disabled,
  onClick,
}: {
  filter: FilterOption;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={"cp-picker-row" + (disabled ? " is-disabled" : "")}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="cp-picker-row-name">{filter.title}</span>
      <span className="filters-picker-option__meta">{filter.type}</span>
    </button>
  );
}

function AddFilterMenu({
  open,
  menuRef,
  style,
  appliedIds,
  onSelect,
}: {
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  style?: React.CSSProperties;
  appliedIds: Set<string>;
  onSelect: (filter: FilterOption) => void;
}) {
  if (!open || !style) return null;

  return createPortal(
    <div ref={menuRef} className="filters-flyout" style={style} role="listbox" aria-label="Add filter">
      <div className="cp-picker-menu filters-picker-menu">
        <div className="dropdown-menu__inner">
          <div className="cp-picker-list">
            {FILTER_OPTIONS.map((filter) => (
              <FilterPickerRow
                key={filter.id}
                filter={filter}
                disabled={appliedIds.has(filter.id)}
                onClick={() => onSelect(filter)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    portalRoot(),
  );
}

const MAP_TO_FIELD_OPTIONS = MAP_TO_FIELDS.map((field) => ({ value: field, label: field }));

function FieldMapSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (field: string) => void;
}) {
  return (
    <Dropdown
      className="filters-field-map"
      value={value}
      onChange={onChange}
      options={MAP_TO_FIELD_OPTIONS}
      placeholder="Select Field"
      searchable
      ariaLabel="Map to field"
      minMenuWidth={240}
    />
  );
}

function AppliedFilterRow({
  item,
  dragging,
  dropTarget,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onFieldChange,
  onRemove,
}: {
  item: AppliedFilter;
  dragging?: boolean;
  dropTarget?: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDragOver: () => void;
  onDrop: () => void;
  onFieldChange: (field: string) => void;
  onRemove: () => void;
}) {
  const { filter, mappedField } = item;
  const rowRef = useRef<HTMLLIElement>(null);

  return (
    <li
      ref={rowRef}
      draggable
      aria-label={`Reorder ${filter.title}`}
      className={
        "filters-applied-row" +
        (dragging ? " is-dragging" : "") +
        (dropTarget ? " is-drop-target" : "")
      }
      onDragStart={(e) => {
        if (
          (e.target as HTMLElement).closest(
            ".filters-applied-row__remove, .filters-applied-row__map, .filters-field-map",
          )
        ) {
          e.preventDefault();
          return;
        }
        if (rowRef.current) setRowDragImage(e, rowRef.current);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("application/x-filter-uid", String(item.uid));
        onDragStart();
      }}
      onDragEnd={() => {
        clearRowDragGhost();
        onDragEnd();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="filters-applied-row__body">
        <div className="filters-applied-row__top">
          <div className="filters-applied-row__leading">
            <span className="filters-applied-row__icon" aria-hidden="true">
              {filter.icon}
            </span>
            <strong className="filters-applied-row__title">{filter.title}</strong>
          </div>
          <div className="filters-applied-row__top-actions">
            <div className="filters-applied-row__map">
              <span className="filters-applied-row__map-label">
                Map to<span className="filters-applied-row__required" aria-hidden="true">*</span>
              </span>
              <FieldMapSelect value={mappedField} onChange={onFieldChange} />
            </div>
            <button
              type="button"
              className="filters-applied-row__remove"
              aria-label={`Remove ${filter.title}`}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              onClick={onRemove}
            >
              <TrashIcon width={20} height={20} />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function FiltersStep() {
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilter[]>([]);
  const [dragUid, setDragUid] = useState<number | null>(null);
  const [dropUid, setDropUid] = useState<number | null>(null);
  const lastOverUid = useRef<number | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuPos, setAddMenuPos] = useState<FlyoutPos | null>(null);
  const addTriggerRef = useRef<HTMLButtonElement>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  const syncAddMenuPosition = useCallback(() => {
    const next = measureFlyoutPosition(addTriggerRef.current, 240, 8);
    if (next) setAddMenuPos(next);
  }, []);

  const toggleAddMenu = useCallback(() => {
    setAddMenuOpen((open) => {
      if (open) return false;
      syncAddMenuPosition();
      return true;
    });
  }, [syncAddMenuPosition]);

  useLayoutEffect(() => {
    if (!addMenuOpen) return;
    syncAddMenuPosition();
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (addTriggerRef.current?.contains(target)) return;
      if (addMenuRef.current?.contains(target)) return;
      setAddMenuOpen(false);
    };
    const onLayout = () => syncAddMenuPosition();
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [addMenuOpen, syncAddMenuPosition]);

  useEffect(() => {
    if (!addMenuOpen) setAddMenuPos(null);
  }, [addMenuOpen]);

  const addFilter = (filter: FilterOption) => {
    setAppliedFilters((current) => {
      if (current.some((item) => item.filter.id === filter.id)) return current;
      return [...current, { uid: nextFilterUid(), filter, mappedField: "" }];
    });
    setAddMenuOpen(false);
  };

  const updateField = (uid: number, mappedField: string) => {
    setAppliedFilters((current) => current.map((item) => (item.uid === uid ? { ...item, mappedField } : item)));
  };

  const removeFilter = (uid: number) => {
    setAppliedFilters((current) => current.filter((item) => item.uid !== uid));
  };

  const removeAll = () => setAppliedFilters([]);

  const reorderFilters = useCallback((fromUid: number, toUid: number) => {
    setAppliedFilters((current) => {
      const fromIndex = current.findIndex((item) => item.uid === fromUid);
      const toIndex = current.findIndex((item) => item.uid === toUid);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const appliedFilterIds = new Set(appliedFilters.map((item) => item.filter.id));

  return (
    <div className="filters-step">
      <header className="filters-step__head">
        <h2 className="filters-step__title">Filters</h2>
        {appliedFilters.length > 0 && (
          <button type="button" className="filters-step__remove-all" onClick={removeAll}>
            Remove All
          </button>
        )}
      </header>

      {appliedFilters.length > 0 && (
        <ul className={"filters-applied-list" + (dragUid !== null ? " is-reordering" : "")}>
          {appliedFilters.map((item) => (
            <AppliedFilterRow
              key={item.uid}
              item={item}
              dragging={dragUid === item.uid}
              dropTarget={dropUid === item.uid && dragUid !== item.uid}
              onDragStart={() => setDragUid(item.uid)}
              onDragEnd={() => {
                lastOverUid.current = null;
                setDragUid(null);
                setDropUid(null);
              }}
              onDragOver={() => {
                if (dragUid !== null && dragUid !== item.uid && lastOverUid.current !== item.uid) {
                  lastOverUid.current = item.uid;
                  reorderFilters(dragUid, item.uid);
                }
                setDropUid(item.uid);
              }}
              onDrop={() => {
                lastOverUid.current = null;
                setDragUid(null);
                setDropUid(null);
              }}
              onFieldChange={(field) => updateField(item.uid, field)}
              onRemove={() => removeFilter(item.uid)}
            />
          ))}
        </ul>
      )}

      <button
        ref={addTriggerRef}
        type="button"
        className={"filters-step__add" + (addMenuOpen ? " is-open" : "")}
        aria-haspopup="listbox"
        aria-expanded={addMenuOpen}
        onClick={toggleAddMenu}
      >
        <span className="filters-step__add-label">
          <PlusIcon width={16} height={16} aria-hidden="true" />
          Add Filter
        </span>
        <ChevronDownIcon width={16} height={16} aria-hidden="true" />
      </button>

      <AddFilterMenu
        open={addMenuOpen}
        menuRef={addMenuRef}
        style={
          addMenuPos
            ? { top: addMenuPos.top, left: addMenuPos.left, width: addMenuPos.width }
            : undefined
        }
        appliedIds={appliedFilterIds}
        onSelect={addFilter}
      />
    </div>
  );
}
