import { portalRoot } from "./host";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDownIcon, CloseIcon, SearchIcon } from "./icons";
import {
  PHOSPHOR_ICON_OPTIONS,
  getPhosphorIcon,
} from "./phosphorIconCatalog";

type PhosphorIconPickerProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function PhosphorIconPicker({
  value,
  onChange,
}: PhosphorIconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 320 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const syncMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    const estimatedHeight = menuRef.current?.offsetHeight ?? 312;
    const roomBelow = window.innerHeight - rect.bottom - 8;
    const openAbove = roomBelow < estimatedHeight && rect.top > roomBelow;
    setMenuPos({
      top: openAbove
        ? Math.max(8, rect.top - estimatedHeight - 8)
        : rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
      width,
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!open) return;
    syncMenuPosition();
    searchRef.current?.focus();
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onLayout = () => syncMenuPosition();
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open, close, syncMenuPosition]);

  const normalizedQuery = search.trim().toLowerCase();
  const filtered = normalizedQuery
    ? PHOSPHOR_ICON_OPTIONS.filter(
        ({ name, label }) =>
          name.toLowerCase().includes(normalizedQuery) ||
          label.toLowerCase().includes(normalizedQuery),
      )
    : PHOSPHOR_ICON_OPTIONS;
  const SelectedIcon = getPhosphorIcon(value);

  const pick = (next: string) => {
    onChange(next);
    close();
  };

  return (
    <div className="cp-picker-wrap icon-picker">
      <button
        ref={triggerRef}
        type="button"
        className={"cp-picker-trigger icon-picker__trigger" + (open ? " is-open" : "")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (open) {
            close();
            return;
          }
          setSearch("");
          syncMenuPosition();
          setOpen(true);
        }}
      >
        <span className="icon-picker__selection">
          <SelectedIcon size={18} weight="regular" aria-hidden="true" />
          <span className="cp-picker-trigger-name">{value || "MapPin"}</span>
        </span>
        <ChevronDownIcon className="cp-caret" width={16} height={16} aria-hidden="true" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="cp-picker-menu cp-picker-menu--flyout icon-picker__menu"
            role="dialog"
            aria-label="Choose a Phosphor icon"
            style={
              {
                top: menuPos.top,
                left: menuPos.left,
                width: menuPos.width,
              } as CSSProperties
            }
          >
            <div className="dropdown-menu__inner">
              <div className="cp-picker-search">
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search icons"
                  aria-label="Search icons"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Escape") {
                      close();
                      return;
                    }
                    if (event.key !== "Enter" || !filtered[0]) return;
                    event.preventDefault();
                    pick(filtered[0].name);
                  }}
                />
                {search && (
                  <button
                    type="button"
                    className="cp-picker-search-clear"
                    aria-label="Clear search"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setSearch("")}
                  >
                    <CloseIcon width={14} height={14} strokeWidth={1} aria-hidden="true" />
                  </button>
                )}
                <SearchIcon className="cp-picker-search-ico" width={14} height={14} aria-hidden="true" />
              </div>

              <div className="icon-picker__grid" role="listbox" aria-label="Phosphor icons">
                {filtered.map(({ name, label, Icon }) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-label={label}
                    aria-selected={name === value}
                    className={"icon-picker__option" + (name === value ? " is-selected" : "")}
                    title={label}
                    onClick={() => pick(name)}
                  >
                    <Icon size={20} weight="regular" aria-hidden="true" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {!filtered.length && <div className="cp-picker-empty">No icons found</div>}
            </div>
          </div>,
          portalRoot(),
        )}
    </div>
  );
}
