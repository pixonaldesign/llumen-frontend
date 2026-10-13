import { ASSET_BASE, portalRoot } from "./host";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, PlusIcon, TrashIcon } from "./icons";
import Dropdown from "./Dropdown";
import { fieldOptionsFor } from "./mockDataset";
import {
  DEFAULT_ZOOM_SCALING,
  ZOOM_RATES,
  asZoomScaling,
  parsedZoomStops,
  type ZoomRate,
  type ZoomScalingStop,
  type ZoomStyleCurveConfig,
  type ZoomStyleStop,
  type ZoomScalingValue,
} from "./previewTheme";

type Props = {
  value: unknown;
  onChange: (next: ZoomScalingValue) => void;
  dataRangeOnly?: boolean;
  showStyleAcrossZoom?: boolean;
};

const RATE_OPTIONS = ZOOM_RATES.map((rate) => ({ value: rate, label: rate }));
const DATA_FIELD_OPTIONS = fieldOptionsFor("Y axis");
const STYLE_ZOOM_TICKS = ["0", "4", "8", "12", "16", "20"];
const MOUNTAINS_ASSET = `${ASSET_BASE}figma/zoom-style-mountains.svg`;
const HOUSE_ASSET = `${ASSET_BASE}figma/zoom-style-house.svg`;

function meterSuffix(scale: string): string {
  const n = Number(scale);
  return n === 1 ? "Meter" : "Meters";
}

function catmullRomPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6}, ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function curvePath(
  pts: { x: number; y: number }[],
  rate: ZoomRate,
  first: { x: number; y: number },
  last: { x: number; y: number },
): string {
  if (rate === "Custom") return catmullRomPath(pts);
  if (rate === "Linear") return `M ${first.x} ${first.y} L ${last.x} ${last.y}`;
  const n = 36;
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const eased = (8 ** t - 1) / 7;
    const x = first.x + (last.x - first.x) * t;
    const y = first.y + (last.y - first.y) * eased;
    parts.push(`${i ? "L" : "M"} ${x} ${y}`);
  }
  return parts.join(" ");
}

function ScaleChart({ value }: { value: ZoomScalingValue }) {
  const parsed = parsedZoomStops(value);
  const W = 400;
  const H = 210;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 32;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const zooms = parsed.map((p) => p.zoom);
  const scales = parsed.map((p) => p.scale);
  const zMin = zooms.length ? Math.min(...zooms) : 0;
  const zMax = zooms.length ? Math.max(...zooms) : 1;
  const sMin = scales.length ? Math.min(...scales) : 0;
  const sMax = scales.length ? Math.max(...scales) : 1;
  const zSpan = zMax - zMin || 1;
  const sSpan = sMax - sMin || 1;
  const xOf = (z: number) => padL + ((z - zMin) / zSpan) * plotW;
  const yOf = (s: number) => padT + plotH - ((s - sMin) / sSpan) * plotH;
  const pts = parsed.map((p) => ({ x: xOf(p.zoom), y: yOf(p.scale) }));
  const first = pts[0] ?? { x: padL, y: padT + plotH };
  const last = pts[pts.length - 1] ?? { x: padL + plotW, y: padT };
  const ticks = Array.from({ length: 5 }, (_, i) => {
    const t = i / 4;
    const raw = zMin + zSpan * t;
    const value = i === 0 ? zMin : i === 4 ? zMax : Math.round(raw / 50) * 50;
    return { value, x: padL + plotW * t };
  });
  const mids = ticks.slice(0, -1).map((tick, i) => (tick.x + ticks[i + 1].x) / 2);
  const baseline = padT + plotH;

  return (
    <svg className="zs-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Zoom scale curve">
      <line className="zs-chart__axis" x1={padL} y1={baseline} x2={W - padR} y2={baseline} />
      {mids.map((x) => (
        <line
          key={`mid-${x}`}
          className="zs-chart__grid zs-chart__grid--minor"
          x1={x}
          y1={baseline}
          x2={x}
          y2={baseline + 9}
        />
      ))}
      {ticks.map((tick, i) => {
        const { value, x } = tick;
        return (
          <g key={`${value}-${i}`}>
            <line className="zs-chart__grid" x1={x} y1={padT} x2={x} y2={baseline + 9} />
            <text
              className="zs-chart__tick"
              x={x}
              y={H - 6}
              textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
            >
              {Number.isInteger(value) ? value : value.toFixed(1)}
            </text>
          </g>
        );
      })}
      {pts.length >= 2 && (
        <path className="zs-chart__line" d={curvePath(pts, value.rate, first, last)} />
      )}
      {pts.length >= 2 && (
        <>
          <circle className="zs-chart__endpoint" cx={first.x} cy={first.y} r={6} />
          <circle className="zs-chart__endpoint" cx={last.x} cy={last.y} r={6} />
        </>
      )}
      {value.rate === "Custom" &&
        pts.slice(1, -1).map((p, i) => (
          <circle key={i} className="zs-chart__dot" cx={p.x} cy={p.y} r={5} />
        ))}
    </svg>
  );
}

function curveEditorValue(stop: ZoomStyleStop): ZoomScalingValue {
  const config = stop.curveConfig;
  const defaultStops = DEFAULT_ZOOM_SCALING.stops.filter(
    (_, index, stops) => index === 0 || index === stops.length - 1,
  );
  return {
    dataField: config?.dataField ?? DEFAULT_ZOOM_SCALING.dataField,
    rate: config?.rate ?? (stop.curve === "ease" ? "Exponential" : "Linear"),
    styleAcrossZoom: false,
    stops: (config?.stops ?? defaultStops).map((value) => ({ ...value })),
    styleStops: DEFAULT_ZOOM_SCALING.styleStops.map((value) => ({ ...value })),
  };
}

function StyleCurve({ stop }: { stop: ZoomStyleStop }) {
  const value = curveEditorValue(stop);
  const parsed = parsedZoomStops(value);
  const zooms = parsed.map((point) => point.zoom);
  const scales = parsed.map((point) => point.scale);
  const zMin = Math.min(...zooms);
  const zMax = Math.max(...zooms);
  const sMin = Math.min(...scales);
  const sMax = Math.max(...scales);
  const points = parsed.map((point) => ({
    x: 3 + ((point.zoom - zMin) / (zMax - zMin || 1)) * 50,
    y: 14 - ((point.scale - sMin) / (sMax - sMin || 1)) * 11,
  }));
  const first = points[0] ?? { x: 3, y: 14 };
  const last = points[points.length - 1] ?? { x: 53, y: 3 };

  return (
    <svg className="zs-style-curve" viewBox="0 0 56 18" aria-hidden="true">
      <path d={curvePath(points, value.rate, first, last)} />
      {points.map((point, i) => (
        <circle key={i} cx={point.x} cy={point.y} r={i === 0 || i === points.length - 1 ? 2.5 : 1.8} />
      ))}
    </svg>
  );
}

function CurveEditorModal({
  stop,
  onCancel,
  onDone,
}: {
  stop: ZoomStyleStop;
  onCancel: () => void;
  onDone: (config: ZoomStyleCurveConfig) => void;
}) {
  const [draft, setDraft] = useState<ZoomScalingValue>(() => curveEditorValue(stop));

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  return createPortal(
    <div
      className="zs-curve-modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="zs-curve-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zs-curve-modal-title"
      >
        <header className="zs-curve-modal__header">
          <h2 id="zs-curve-modal-title">Edit zoom scaling</h2>
          <button type="button" className="icon-btn" aria-label="Close curve editor" onClick={onCancel}>
            <CloseIcon width={18} height={18} />
          </button>
        </header>
        <div className="zs-curve-modal__body">
          <ZoomScalingControl
            value={draft}
            onChange={setDraft}
            showStyleAcrossZoom={false}
          />
        </div>
        <footer className="zs-curve-modal__footer">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() =>
              onDone({
                dataField: draft.dataField,
                rate: draft.rate,
                stops: draft.stops.map((value) => ({ ...value })),
              })
            }
          >
            Done
          </button>
        </footer>
      </section>
    </div>,
    portalRoot(),
  );
}

function StyleAcrossZoomEditor({
  stops,
  onChange,
}: {
  stops: ZoomStyleStop[];
  onChange: (stops: ZoomStyleStop[]) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const axisRef = useRef<HTMLDivElement>(null);
  const activeStop = stops[Math.min(activeStopIndex, Math.max(stops.length - 1, 0))];
  const axisMax = Math.max(
    20,
    ...stops.map((stop) => Number(stop.zoom)).filter((zoom) => Number.isFinite(zoom)),
  );
  const parsedMarkerValue = Number(activeStop?.zoom);
  const markerValue = Math.max(
    0,
    Math.min(axisMax, Number.isFinite(parsedMarkerValue) ? parsedMarkerValue : 0),
  );
  const markerLeft = (markerValue / axisMax) * 100;
  const markerLabel = Number.isInteger(markerValue) ? String(markerValue) : markerValue.toFixed(1);

  useEffect(() => {
    if (activeStopIndex >= stops.length) {
      setActiveStopIndex(Math.max(0, stops.length - 1));
    }
  }, [activeStopIndex, stops.length]);

  const updateStop = (index: number, zoom: string) => {
    setActiveStopIndex(index);
    onChange(stops.map((stop, i) => (i === index ? { ...stop, zoom } : stop)));
  };

  const updateMarkerFromPointer = (clientX: number) => {
    const axis = axisRef.current;
    if (!axis) return;
    const rect = axis.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1)));
    const next = Math.round(ratio * axisMax * 10) / 10;
    updateStop(activeStopIndex, Number.isInteger(next) ? String(next) : next.toFixed(1));
  };

  const addStop = () => {
    const lastZoom = Number(stops[stops.length - 1]?.zoom);
    onChange([
      ...stops,
      {
        zoom: String(Number.isFinite(lastZoom) ? lastZoom + 4 : stops.length * 4),
        curve: stops.length % 2 === 0 ? "linear" : "ease",
      },
    ]);
  };

  return (
    <div className="zs-style-editor">
      <div className="zs-style-axis-wrap">
        <div className="zs-style-axis-icons" aria-hidden="true">
          <img src={MOUNTAINS_ASSET} width={20} height={20} alt="" />
          <img src={HOUSE_ASSET} width={20} height={20} alt="" />
        </div>
        <div
          ref={axisRef}
          className="zs-style-axis"
          aria-label={`Style zoom range from 0 to ${axisMax}`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateMarkerFromPointer(event.clientX);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateMarkerFromPointer(event.clientX);
            }
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
        >
          {STYLE_ZOOM_TICKS.map((tick) => (
            <span
              key={tick}
              className="zs-style-axis__tick"
              style={{
                left: `${(Number(tick) / axisMax) * 100}%`,
              }}
            >
              <span>{tick}</span>
            </span>
          ))}
          {axisMax > 20 && (
            <span
              className="zs-style-axis__tick zs-style-axis__tick--edge"
              style={{ left: "calc(100% - 1px)" }}
              aria-hidden="true"
            />
          )}
          <div
            className="zs-style-axis__marker"
            role="slider"
            tabIndex={0}
            aria-label={`Style stop ${activeStopIndex + 1} zoom`}
            aria-valuemin={0}
            aria-valuemax={axisMax}
            aria-valuenow={markerValue}
            style={{ left: `${markerLeft}%` }}
            onKeyDown={(event) => {
              if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(event.key)) return;
              event.preventDefault();
              const direction = event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 1;
              const next = Math.max(0, Math.min(axisMax, markerValue + direction * 0.1));
              updateStop(activeStopIndex, Number.isInteger(next) ? String(next) : next.toFixed(1));
            }}
          >
            <span className="zs-style-axis__marker-dot" />
            <span className="zs-style-axis__marker-line" />
            <span className="zs-style-axis__marker-value">{markerLabel}</span>
          </div>
        </div>
      </div>

      <div className="zs-style-stops">
        {stops.map((stop, i) => (
          <div className={"zs-style-row" + (i === activeStopIndex ? " is-active" : "")} key={i}>
            <div className="zs-style-input">
              <input
                value={stop.zoom}
                inputMode="decimal"
                aria-label={`Style stop ${i + 1} zoom`}
                onFocus={() => setActiveStopIndex(i)}
                onPointerDown={() => setActiveStopIndex(i)}
                onChange={(e) => updateStop(i, e.target.value)}
              />
              <span>z</span>
              <button
                type="button"
                className="zs-style-curve-button"
                aria-label={`Edit curve for style stop ${i + 1}`}
                onClick={() => setEditingIndex(i)}
              >
                <StyleCurve stop={stop} />
              </button>
            </div>
            <button
              type="button"
              className="zs-row__del"
              aria-label={`Remove style stop ${i + 1}`}
              disabled={stops.length <= 1}
              onClick={() => onChange(stops.filter((_, j) => j !== i))}
            >
              <TrashIcon width={20} height={20} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button type="button" className="cp-add" onClick={addStop}>
          <PlusIcon width={20} height={20} aria-hidden="true" />
          <span>Add Another Stop</span>
        </button>
      </div>
      {editingIndex !== null && stops[editingIndex] && (
        <CurveEditorModal
          stop={stops[editingIndex]}
          onCancel={() => setEditingIndex(null)}
          onDone={(curveConfig) => {
            onChange(
              stops.map((stop, i) =>
                i === editingIndex
                  ? {
                      ...stop,
                      curve: curveConfig.rate === "Exponential" ? "ease" : "linear",
                      curveConfig,
                    }
                  : stop,
              ),
            );
            setEditingIndex(null);
          }}
        />
      )}
    </div>
  );
}

export default function ZoomScalingControl({
  value,
  onChange,
  dataRangeOnly = false,
  showStyleAcrossZoom = true,
}: Props) {
  const current = asZoomScaling(value);
  const parsed = parsedZoomStops(current);
  const zMin = parsed.length ? parsed[0].zoom : 0;
  const zMax = parsed.length ? parsed[parsed.length - 1].zoom : 0;
  const custom = dataRangeOnly || current.rate === "Custom";

  const commit = (patch: Partial<ZoomScalingValue>) =>
    onChange({
      dataField: patch.dataField ?? current.dataField,
      rate: patch.rate ?? current.rate,
      styleAcrossZoom: patch.styleAcrossZoom ?? current.styleAcrossZoom,
      stops: (patch.stops ?? current.stops).map((s) => ({ zoom: s.zoom, scale: s.scale })),
      styleStops: (patch.styleStops ?? current.styleStops).map((s) => ({
        zoom: s.zoom,
        curve: s.curve,
        curveConfig: s.curveConfig
          ? {
              dataField: s.curveConfig.dataField,
              rate: s.curveConfig.rate,
              stops: s.curveConfig.stops.map((stop) => ({ ...stop })),
            }
          : undefined,
      })),
    });

  const updateStop = (index: number, patch: Partial<ZoomScalingStop>) =>
    commit({
      stops: current.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });

  const addStop = () => {
    const last = current.stops[current.stops.length - 1];
    const prev = current.stops[current.stops.length - 2];
    const lastZ = Number(last?.zoom);
    const prevZ = Number(prev?.zoom);
    const lastS = Number(last?.scale);
    const prevS = Number(prev?.scale);
    const step = Number.isFinite(lastZ) && Number.isFinite(prevZ) ? lastZ - prevZ : 50;
    const zoom = Number.isFinite(lastZ) ? lastZ + (step || 50) : current.stops.length * 50;
    const scale =
      Number.isFinite(lastS) && Number.isFinite(prevS)
        ? lastS + (lastS - prevS)
        : Number.isFinite(lastS)
          ? lastS
          : 1;
    commit({
      stops: [...current.stops, { zoom: String(zoom), scale: String(scale) }],
    });
  };

  return (
    <div className={"zs" + (dataRangeOnly ? " zs--data-range" : "")}>
      {!dataRangeOnly && <ScaleChart value={current} />}

      <div className="zs-block">
        {!dataRangeOnly && (
          <div className="zs-controls">
            <div className="zs-field">
              <div className="ia-field-name">Data field</div>
              <Dropdown
                value={current.dataField}
                onChange={(dataField) => commit({ dataField })}
                options={DATA_FIELD_OPTIONS}
                placeholder="Select data field"
                searchable
                ariaLabel="Data field"
                minMenuWidth={360}
              />
            </div>
            <div className="zs-field">
              <div className="ia-field-name">Rate of change</div>
              <Dropdown
                value={current.rate}
                onChange={(rate) => commit({ rate: rate as ZoomRate })}
                options={RATE_OPTIONS}
                ariaLabel="Rate of change"
              />
            </div>
          </div>
        )}

        <p className="zs-range">
          data range: {zMin} - {zMax}
        </p>

        <div className="zs-stops">
          {current.stops.map((stop, i) => (
            <div key={i} className="zs-row">
              {custom ? (
                <div className="zs-row__split">
                  <div className="zs-input">
                    <input
                      value={stop.zoom}
                      inputMode="decimal"
                      aria-label={`Stop ${i + 1} zoom`}
                      onChange={(e) => updateStop(i, { zoom: e.target.value })}
                    />
                  </div>
                  <div className="zs-input zs-input--scale">
                    <input
                      value={stop.scale}
                      inputMode="decimal"
                      aria-label={`Stop ${i + 1} scale`}
                      onChange={(e) => updateStop(i, { scale: e.target.value })}
                    />
                    <span className="zs-input__unit">{meterSuffix(stop.scale)}</span>
                  </div>
                </div>
              ) : (
                <div className="zs-input zs-input--combo">
                  <input
                    className="zs-input__zoom"
                    value={stop.zoom}
                    inputMode="decimal"
                    aria-label={`Stop ${i + 1} zoom`}
                    onChange={(e) => updateStop(i, { zoom: e.target.value })}
                  />
                  <span className="zs-input__derived">
                    <input
                      value={stop.scale}
                      inputMode="decimal"
                      aria-label={`Stop ${i + 1} scale`}
                      onChange={(e) => updateStop(i, { scale: e.target.value })}
                    />
                    <span className="zs-input__unit">{meterSuffix(stop.scale)}</span>
                  </span>
                </div>
              )}
              <button
                type="button"
                className="zs-row__del"
                aria-label={`Remove stop ${i + 1}`}
                disabled={current.stops.length <= 2}
                onClick={() =>
                  commit({ stops: current.stops.filter((_, j) => j !== i) })
                }
              >
                <TrashIcon width={20} height={20} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>

        <button type="button" className="cp-add" onClick={addStop}>
          <PlusIcon width={20} height={20} aria-hidden="true" />
          <span>Add Another Stop</span>
        </button>
      </div>

      {!dataRangeOnly && showStyleAcrossZoom && (
        <div className={"ia-toggle-flat zs-style-toggle" + (current.styleAcrossZoom ? " is-open" : "")}>
          <div className="ia-toggle-line">
            <div className="ia-toggle-line-label">
              <strong>Style Across Zoom Range</strong>
            </div>
            <span
              role="switch"
              aria-checked={current.styleAcrossZoom}
              className={"ia-mini-switch" + (current.styleAcrossZoom ? " on" : "")}
              onClick={() => commit({ styleAcrossZoom: !current.styleAcrossZoom })}
            />
          </div>
          {current.styleAcrossZoom && (
            <StyleAcrossZoomEditor
              stops={current.styleStops}
              onChange={(styleStops) => commit({ styleStops })}
            />
          )}
        </div>
      )}
    </div>
  );
}
