import type { ReactNode, RefObject } from "react";
import { DotsThreeVertical } from "@phosphor-icons/react";

export type WidgetVisualMode = "image" | "live";
export type WidgetFrameSize = "full" | "compact";

type Props = {
  typeLabel: string;
  children: ReactNode;
  visualMode?: WidgetVisualMode;
  size?: WidgetFrameSize;
  isSelected?: boolean;
  isDragging?: boolean;
  menuOpen?: boolean;
  menuButtonRef?: RefObject<HTMLButtonElement>;
  onMenuClick?: () => void;
};

export default function WidgetFrame({
  typeLabel,
  children,
  visualMode = "live",
  size = "full",
  isSelected = false,
  isDragging = false,
  menuOpen = false,
  menuButtonRef,
  onMenuClick,
}: Props) {
  return (
    <div
      className={
        "widget-frame" +
        (size === "compact" ? " widget-frame--compact" : " widget-frame--full") +
        (visualMode === "image" ? " widget-frame--image" : " widget-frame--live") +
        (isSelected ? " is-selected" : "") +
        (isDragging ? " is-dragging" : "")
      }
    >
      {visualMode === "image" ? (
        onMenuClick ? (
          <button
            ref={menuButtonRef}
            type="button"
            className={"menu-button widget-image-menu" + (menuOpen ? " is-open" : "")}
            aria-label="Asset actions"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={onMenuClick}
          >
            <DotsThreeVertical size={18} weight="bold" aria-hidden="true" />
          </button>
        ) : null
      ) : (
        <div className="widget-header">
          <span className="widget-header-title" title={typeLabel}>
            {typeLabel}
          </span>
          {onMenuClick && (
            <div className="widget-header-actions">
              <button
                ref={menuButtonRef}
                type="button"
                className={"menu-button" + (menuOpen ? " is-open" : "")}
                aria-label="Asset actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={onMenuClick}
              >
                <DotsThreeVertical size={18} weight="bold" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="widget-body">{children}</div>
    </div>
  );
}
