import { portalRoot } from "./host";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  CaretDown,
  CaretRight,
  Info,
  MagnifyingGlass,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import Dropdown from "./Dropdown";
import QueryAssistantChat from "./QueryAssistantChat";

export type GeneralInfo = {
  name: string;
  description: string;
  insight: string;
  aiContext: string;
  location: string[];
  tags: string[];
  updateFrequency: string;
  customUpdateFrequency: string;
  scheduleAutoRefresh: boolean;
  category: string;
};

type LocationOption = {
  value: string;
  type: string;
  hasChildren: boolean;
};

const ALL_LOCATION_OPTIONS: LocationOption[] = [
  { value: "Saudi Arabia", type: "Country", hasChildren: false },
  { value: "United Arab Emirates", type: "Country", hasChildren: false },
  { value: "Egypt", type: "Country", hasChildren: false },
  { value: "Abu Dhabi", type: "Emirate", hasChildren: true },
  { value: "Ajman", type: "Emirate", hasChildren: true },
  { value: "Dubai", type: "Emirate", hasChildren: true },
  { value: "Fujairah", type: "Emirate", hasChildren: true },
  { value: "Ras Al Khaimah", type: "Emirate", hasChildren: true },
  { value: "Sharjah", type: "Emirate", hasChildren: true },
  { value: "Umm Al Quwain", type: "Emirate", hasChildren: true },
  { value: "2323", type: "District", hasChildren: false },
  { value: "354", type: "District", hasChildren: false },
];

const LOCATION_CHILDREN: Record<string, LocationOption[]> = {
  "Abu Dhabi": [
    { value: "Abu Dhabi City", type: "City", hasChildren: true },
    { value: "Abu Dhabi Island", type: "City", hasChildren: true },
    { value: "Al Ain", type: "City", hasChildren: true },
    { value: "Western Region", type: "City", hasChildren: true },
  ],
  Ajman: [
    { value: "Ajman City", type: "City", hasChildren: false },
    { value: "Al Manama", type: "City", hasChildren: false },
    { value: "Masfout", type: "City", hasChildren: false },
  ],
  Dubai: [
    { value: "Dubai City", type: "City", hasChildren: false },
    { value: "Hatta", type: "City", hasChildren: false },
    { value: "Jebel Ali", type: "City", hasChildren: false },
  ],
  Fujairah: [
    { value: "Fujairah City", type: "City", hasChildren: false },
    { value: "Dibba Al-Fujairah", type: "City", hasChildren: false },
  ],
  "Ras Al Khaimah": [
    { value: "Ras Al Khaimah City", type: "City", hasChildren: false },
    { value: "Al Jazirah Al Hamra", type: "City", hasChildren: false },
  ],
  Sharjah: [
    { value: "Sharjah City", type: "City", hasChildren: false },
    { value: "Khor Fakkan", type: "City", hasChildren: false },
  ],
  "Umm Al Quwain": [
    { value: "Umm Al Quwain City", type: "City", hasChildren: false },
    { value: "Falaj Al Mualla", type: "City", hasChildren: false },
  ],
  "Abu Dhabi City": [
    { value: "2323", type: "District", hasChildren: false },
    { value: "354", type: "District", hasChildren: false },
  ],
  "Abu Dhabi Island": [
    { value: "Central Business District", type: "District", hasChildren: false },
    { value: "Al Bateen", type: "District", hasChildren: false },
  ],
  "Al Ain": [
    { value: "Al Jimi", type: "District", hasChildren: false },
    { value: "Al Mutaredh", type: "District", hasChildren: false },
  ],
  "Western Region": [
    { value: "Madinat Zayed", type: "District", hasChildren: false },
    { value: "Liwa", type: "District", hasChildren: false },
  ],
};

function locationBreadcrumb(location: string): string[] {
  const path = [location];
  const visited = new Set(path);
  let current = location;

  while (true) {
    const parent = Object.entries(LOCATION_CHILDREN).find(([, children]) =>
      children.some((child) => child.value === current),
    )?.[0];
    if (!parent || visited.has(parent)) return path;
    path.unshift(parent);
    visited.add(parent);
    current = parent;
  }
}

const TAG_OPTIONS = [
  { value: "Operations", count: 35 },
  { value: "Commerce", count: 32 },
  { value: "Population", count: 30 },
  { value: "Mobility", count: 27 },
  { value: "Traffic", count: 20 },
  { value: "Real Estate", count: 18 },
  { value: "Employees", count: 16 },
  { value: "Analytics", count: 14 },
  { value: "ITC", count: 12 },
  { value: "Waste", count: 9 },
] as const;

const UPDATE_FREQUENCIES = [
  "Every 15 minutes",
  "Every hour",
  "Every 6 hours",
  "Every day",
  "Every week",
  "Custom",
] as const;

type Props = {
  value: GeneralInfo;
  onChange: (value: GeneralInfo) => void;
  onFillWithAI?: (instructions?: string) => void;
};

function LocationMetadataPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeParent, setActiveParent] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const syncMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    syncMenuPosition();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
    };
  }, [close, open, syncMenuPosition]);

  const toggleValue = (location: string) => {
    onChange(
      value.includes(location)
        ? value.filter((selected) => selected !== location)
        : [...value, location],
    );
  };

  const currentOptions = activeParent
    ? LOCATION_CHILDREN[activeParent] ?? []
    : ALL_LOCATION_OPTIONS;
  const breadcrumb = activeParent ? locationBreadcrumb(activeParent) : [];
  const backTarget = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null;
  const normalizedSearch = search.trim().toLowerCase();
  const menuOptions = normalizedSearch
    ? currentOptions.filter(
        (location) =>
          location.value.toLowerCase().includes(normalizedSearch) ||
          location.type.toLowerCase().includes(normalizedSearch),
      )
    : currentOptions;

  return (
    <div className="general-info-location-picker">
      <button
        ref={triggerRef}
        type="button"
        className={
          "general-info-location-picker__trigger" +
          (open ? " is-open" : "") +
          (!value.length ? " is-placeholder" : "")
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          syncMenuPosition();
          if (!open) {
            setActiveParent(null);
            setSearch("");
          }
          setOpen((current) => !current);
        }}
      >
        <span className="general-info-location-picker__selection">
          {value.length ? (
            value.map((location) => (
              <span className="general-info-location-picker__chip" key={location}>
                {location}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${location}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleValue(location);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    toggleValue(location);
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </span>
              </span>
            ))
          ) : (
            <span>Select a location</span>
          )}
        </span>
        <CaretDown size={16} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="general-info-location-menu"
            role="listbox"
            aria-label="Location metadata"
            aria-multiselectable="true"
            style={
              {
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              } as CSSProperties
            }
          >
            <div className="general-info-location-menu__fixed dropdown-menu__inner">
            <div className="general-info-location-menu__heading">
              {activeParent ? (
                <>
                  <button
                    type="button"
                    className="general-info-location-menu__back"
                    aria-label={`Back to ${backTarget ?? "all locations"}`}
                    onClick={() => {
                      setActiveParent(backTarget);
                      setSearch("");
                    }}
                  >
                    <ArrowLeft size={16} aria-hidden="true" />
                  </button>
                  <nav className="general-info-location-menu__breadcrumb" aria-label="Location path">
                    <button type="button" onClick={() => setActiveParent(null)}>
                      All locations
                    </button>
                    {breadcrumb.map((location, index) => (
                      <span className="general-info-location-menu__crumb" key={location}>
                        <CaretRight size={12} aria-hidden="true" />
                        {index === breadcrumb.length - 1 ? (
                          <span aria-current="location">{location}</span>
                        ) : (
                          <button type="button" onClick={() => setActiveParent(location)}>
                            {location}
                          </button>
                        )}
                      </span>
                    ))}
                  </nav>
                </>
              ) : (
                <span>All locations</span>
              )}
            </div>
            <label className="general-info-location-menu__search">
              <MagnifyingGlass size={16} aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="Search locations"
                aria-label="Search locations"
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            </div>
            <div className="general-info-location-menu__list">
              <div className="dropdown-menu__inner">
                {menuOptions.map((location) => {
                  const selected = value.includes(location.value);
                  return (
                    <button
                      key={location.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        "general-info-location-menu__row" +
                        (selected ? " is-selected" : "") +
                        (activeParent ? " is-nested" : "")
                      }
                      onClick={() => toggleValue(location.value)}
                    >
                      <span className="general-info-location-menu__name">{location.value}</span>
                      <span className="general-info-location-menu__type">{location.type}</span>
                      {location.hasChildren && (
                        <span
                          className="general-info-location-menu__nested-action"
                          role="button"
                          tabIndex={0}
                          aria-label={`Open ${location.value}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            setActiveParent(location.value);
                            setSearch("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" && event.key !== " ") return;
                            event.preventDefault();
                            event.stopPropagation();
                            setActiveParent(location.value);
                            setSearch("");
                          }}
                        >
                          <CaretRight size={15} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}
                {!menuOptions.length && (
                  <div className="general-info-location-menu__empty">No locations found</div>
                )}
              </div>
            </div>
          </div>,
          portalRoot(),
        )}
    </div>
  );
}

function TagsPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const syncMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    syncMenuPosition();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", syncMenuPosition);
    window.addEventListener("scroll", syncMenuPosition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", syncMenuPosition);
      window.removeEventListener("scroll", syncMenuPosition, true);
    };
  }, [close, open, syncMenuPosition]);

  const toggleTag = (tag: string) => {
    onChange(value.includes(tag) ? value.filter((item) => item !== tag) : [...value, tag]);
  };

  return (
    <div className="general-info-tag-picker">
      <button
        ref={triggerRef}
        type="button"
        className={
          "general-info-location-picker__trigger general-info-tag-picker__trigger" +
          (open ? " is-open" : "") +
          (!value.length ? " is-placeholder" : "")
        }
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => {
          syncMenuPosition();
          setOpen((current) => !current);
        }}
      >
        <span className="general-info-location-picker__selection">
          {value.length ? (
            value.map((tag) => (
              <span className="general-info-location-picker__chip" key={tag}>
                {tag}
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Remove ${tag}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleTag(tag);
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    event.stopPropagation();
                    toggleTag(tag);
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </span>
              </span>
            ))
          ) : (
            <span>Add tags</span>
          )}
        </span>
        <CaretDown size={16} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="general-info-location-menu general-info-tag-menu"
            role="listbox"
            aria-label="Tags"
            aria-multiselectable="true"
            style={
              {
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              } as CSSProperties
            }
          >
            <div className="general-info-location-menu__list">
              <div className="dropdown-menu__inner">
                {TAG_OPTIONS.map((tag) => {
                  const selected = value.includes(tag.value);
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={
                        "general-info-location-menu__row" + (selected ? " is-selected" : "")
                      }
                      onClick={() => toggleTag(tag.value)}
                    >
                      <span className="general-info-location-menu__name">
                        {tag.value} ({tag.count})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          portalRoot(),
        )}
    </div>
  );
}

export default function GeneralInfoStep({ value, onChange, onFillWithAI }: Props) {
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const aiGroupRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const [aiMenuPos, setAiMenuPos] = useState({ top: 0, left: 0, width: 176 });
  const generationTimer = useRef<number | null>(null);
  const set = (patch: Partial<GeneralInfo>) => onChange({ ...value, ...patch });

  const syncAiMenuPosition = useCallback(() => {
    const trigger = aiGroupRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 176);
    setAiMenuPos({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width,
    });
  }, []);

  useEffect(() => {
    if (!aiMenuOpen) return;
    syncAiMenuPosition();
    const closeMenu = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        !aiGroupRef.current?.contains(target) &&
        !aiMenuRef.current?.contains(target)
      ) {
        setAiMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAiMenuOpen(false);
    };
    const syncOnLayout = () => syncAiMenuPosition();
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", syncOnLayout);
    window.addEventListener("scroll", syncOnLayout, true);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", syncOnLayout);
      window.removeEventListener("scroll", syncOnLayout, true);
    };
  }, [aiMenuOpen, syncAiMenuPosition]);

  useEffect(
    () => () => {
      if (generationTimer.current !== null) window.clearTimeout(generationTimer.current);
    },
    [],
  );

  const generate = (generationInstructions = instructions) => {
    if (isGenerating) return;
    setAiMenuOpen(false);
    setIsGenerating(true);
    generationTimer.current = window.setTimeout(() => {
      onFillWithAI?.(
        generationInstructions.trim() || value.aiContext.trim() || undefined,
      );
      setIsGenerating(false);
      setHasGenerated(true);
      generationTimer.current = null;
    }, 2200);
  };

  return (
    <div className="general-info-step">
      <header className="general-info-step__head">
        <h3 className="general-info-step__title">General Info</h3>
        <div className="general-info-step__ai-group" ref={aiGroupRef}>
          <button
            type="button"
            className="general-info-step__fill-ai"
            disabled={isGenerating}
            aria-live="polite"
            onClick={() => generate()}
          >
            {isGenerating ? (
              <span className="ds-query-generate-spinner" aria-hidden="true" />
            ) : (
              <Sparkle size={14} weight="fill" aria-hidden="true" />
            )}
            {isGenerating ? "Generating..." : hasGenerated ? "Regenerate" : "Fill fields with AI"}
          </button>
          <button
            type="button"
            className="general-info-step__ai-menu-trigger"
            aria-label="Open generation options"
            aria-haspopup="menu"
            aria-expanded={aiMenuOpen}
            disabled={isGenerating}
            onClick={() => {
              syncAiMenuPosition();
              setAiMenuOpen((open) => !open);
            }}
          >
            <CaretDown size={14} weight="bold" aria-hidden="true" />
          </button>
        </div>
      </header>

      {aiMenuOpen &&
        createPortal(
          <div
            ref={aiMenuRef}
            className="cp-picker-menu cp-picker-menu--flyout general-info-step__ai-menu"
            role="menu"
            style={
              {
                top: aiMenuPos.top,
                left: aiMenuPos.left,
                width: aiMenuPos.width,
              } as CSSProperties
            }
          >
            <div className="dropdown-menu__inner">
              <div className="cp-picker-list">
                <button
                  type="button"
                  className="cp-picker-row"
                  role="menuitem"
                  onClick={() => {
                    setAiMenuOpen(false);
                    setInstructionsOpen(true);
                  }}
                >
                  <span className="cp-picker-row-name">Add Prompt</span>
                </button>
              </div>
            </div>
          </div>,
          portalRoot(),
        )}

      <div className="general-info-step__fields">
        <div className="general-info-field">
          <div className="general-info-field__label-row">
            <label className="general-info-field__label" htmlFor="general-info-name">
              Asset Name
            </label>
            <span className="general-info-field__status general-info-field__status--required">
              <Info size={15} aria-hidden="true" />
              Required
            </span>
          </div>
          <input
            id="general-info-name"
            className="general-info-field__input"
            type="text"
            value={value.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Untitled Asset"
          />
        </div>

        <div className="general-info-field">
          <div className="general-info-field__label-row">
            <label className="general-info-field__label" htmlFor="general-info-description">
              Description
            </label>
            <span className="general-info-field__status general-info-field__status--required">
              <Info size={15} aria-hidden="true" />
              Required
            </span>
          </div>
          <textarea
            id="general-info-description"
            className="general-info-field__input general-info-field__textarea"
            value={value.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Enter description"
            rows={3}
          />
        </div>

        <div className="general-info-field">
          <label className="general-info-field__label" htmlFor="general-info-insight">
            Insight
          </label>
          <textarea
            id="general-info-insight"
            className="general-info-field__input general-info-field__textarea"
            value={value.insight}
            onChange={(e) => set({ insight: e.target.value })}
            placeholder="Add a short insight shown below the chart. Fallback insight when no insight field is mapped or the field value is empty"
            rows={3}
          />
        </div>

        <div className="general-info-field">
          <div className="general-info-field__label-row">
            <label className="general-info-field__label">Location Metadata</label>
            <span className="general-info-field__status">Optional</span>
          </div>
          <LocationMetadataPicker
            value={value.location}
            onChange={(location) => set({ location })}
          />
          <p className="general-info-field__helper">
            Optional. Records which place(s) this asset’s data is about.
          </p>
        </div>

        <div className="general-info-field">
          <div className="general-info-field__label-row">
            <label className="general-info-field__label">Tags</label>
            <span className="general-info-field__status general-info-field__status--required">
              <Info size={15} aria-hidden="true" />
              Required
            </span>
          </div>
          <TagsPicker
            value={value.tags}
            onChange={(tags) => set({ tags })}
          />
        </div>

        <div className="general-info-field">
          <label className="general-info-field__label">Update Frequency</label>
          <Dropdown
            className="general-info-field__dropdown general-info-update-frequency"
            value={value.updateFrequency}
            onChange={(updateFrequency) =>
              set({
                updateFrequency,
                scheduleAutoRefresh:
                  updateFrequency && updateFrequency !== "Custom"
                    ? value.scheduleAutoRefresh
                    : false,
              })
            }
            options={UPDATE_FREQUENCIES.map((frequency) => ({
              value: frequency,
              label: frequency,
            }))}
            allowEmpty
            emptyLabel="None (no auto-refresh)"
            ariaLabel="Update frequency"
            menuClassName="general-info-location-menu general-info-update-frequency-menu"
            endIcon={<CaretDown className="cp-caret" size={16} aria-hidden="true" />}
          />
          {value.updateFrequency === "Custom" && (
            <input
              className="general-info-field__input general-info-field__custom-frequency"
              type="text"
              value={value.customUpdateFrequency}
              onChange={(event) => set({ customUpdateFrequency: event.target.value })}
              placeholder={'e.g. "2 hours", "30 minutes"'}
              aria-label="Custom update frequency"
            />
          )}
          {value.updateFrequency && value.updateFrequency !== "Custom" && (
            <label className="general-info-field__schedule">
              <input
                type="checkbox"
                checked={value.scheduleAutoRefresh}
                onChange={(event) => set({ scheduleAutoRefresh: event.target.checked })}
              />
              <span className="general-info-field__schedule-copy">
                <span>Schedule auto-refresh</span>
                <small>
                  Let the scheduler warm this component&apos;s cache on the update-frequency
                  cadence. Leave off to refresh lazily only when the component is viewed.
                </small>
              </span>
            </label>
          )}
        </div>

        <div className="general-info-field">
          <div className="general-info-field__label-row">
            <label
              className="general-info-field__label"
              htmlFor="general-info-ai-context"
            >
              AI Context
            </label>
            <span className="general-info-field__status">Optional</span>
          </div>
          <textarea
            id="general-info-ai-context"
            className="general-info-field__input general-info-field__textarea general-info-field__ai-context"
            value={value.aiContext}
            onChange={(event) => set({ aiContext: event.target.value })}
            placeholder="Add context or instructions for AI"
            rows={3}
          />
        </div>
      </div>

      {instructionsOpen &&
        createPortal(
          <div
            className="ds-source-picker-overlay"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setInstructionsOpen(false);
            }}
          >
            <div
              className="ds-source-picker-modal ds-source-picker-modal--query-assistant"
              role="dialog"
              aria-modal="true"
            >
              <QueryAssistantChat
                onClose={() => setInstructionsOpen(false)}
                initialTitle="Fill Asset Fields Using AI"
                introTitle="Describe the asset information you want to generate."
                introExample='Example: "Create a weekly sales asset for Saudi Arabia".'
                placeholder="Describe your asset"
                thinkingText="Generating your asset information…"
                onGenerate={(prompt) => {
                  const nextInstructions = prompt.trim();
                  setInstructions(nextInstructions);
                  onFillWithAI?.(
                    nextInstructions || value.aiContext.trim() || undefined,
                  );
                  setHasGenerated(true);
                  return {
                    text: "I filled the asset fields using your instructions.",
                    status: "Applied to General Info",
                  };
                }}
              />
            </div>
          </div>,
          portalRoot(),
        )}
    </div>
  );
}
