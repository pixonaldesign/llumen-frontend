import { useCallback, useLayoutEffect, useRef } from "react";

const QUERY_COLUMNS = [
  "grid_id",
  "longitude",
  "latitude",
  "area_size_km2",
  "population_count",
  "population_density",
];

const QUERY_COLUMN_WIDTHS = ["10%", "14%", "14%", "17%", "20%", "25%"];

const QUERY_ROWS = Array.from({ length: 30 }, (_, index) => {
  const population = 98_000 + ((index * 23_000) % 89_000);
  const areaSize = 9.8 + ((index * 1.3) % 7.2);

  return [
    String(index + 1),
    (54.363716 + index * 0.005613).toFixed(6),
    (24.488927 - index * 0.007369).toFixed(6),
    areaSize.toFixed(1),
    population.toLocaleString("en-US"),
    Math.round(population / areaSize).toLocaleString("en-US"),
  ];
});

export default function DataSourceQueryPreview() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const syncScrollIndicator = useCallback(() => {
    const scroller = scrollRef.current;
    const indicator = indicatorRef.current;
    if (!scroller || !indicator) return;
    const { clientHeight, scrollHeight, scrollTop } = scroller;
    const scrollable = scrollHeight > clientHeight + 1;
    indicator.hidden = !scrollable;
    if (!scrollable) return;
    const trackHeight = Math.max(0, clientHeight - 4);
    const indicatorHeight = Math.max(
      24,
      (clientHeight / scrollHeight) * trackHeight,
    );
    const maxScrollTop = scrollHeight - clientHeight;
    const maxIndicatorTop = Math.max(0, trackHeight - indicatorHeight);
    const indicatorTop =
      scroller.offsetTop +
      2 +
      (scrollTop / Math.max(maxScrollTop, 1)) * maxIndicatorTop;
    indicator.style.height = `${indicatorHeight}px`;
    indicator.style.transform = `translateY(${indicatorTop}px)`;
  }, []);

  useLayoutEffect(() => {
    syncScrollIndicator();
    const scroller = scrollRef.current;
    if (!scroller) return;
    const observer = new ResizeObserver(syncScrollIndicator);
    observer.observe(scroller);
    const table = scroller.querySelector("table");
    if (table) observer.observe(table);
    return () => observer.disconnect();
  }, [syncScrollIndicator]);

  return (
    <div className="data-source-query-preview" aria-label="Query results">
      <table className="data-source-query-preview__header">
        <colgroup>
          {QUERY_COLUMN_WIDTHS.map((width, index) => (
            <col key={QUERY_COLUMNS[index]} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {QUERY_COLUMNS.map((column) => (
              <th key={column} scope="col">
                {column}
              </th>
            ))}
          </tr>
        </thead>
      </table>
      <div
        ref={scrollRef}
        className="data-source-query-preview__scroll"
        onScroll={syncScrollIndicator}
      >
        <table aria-label="Query result rows">
          <colgroup>
            {QUERY_COLUMN_WIDTHS.map((width, index) => (
              <col key={QUERY_COLUMNS[index]} style={{ width }} />
            ))}
          </colgroup>
          <tbody>
            {QUERY_ROWS.map((row) => (
              <tr key={row[0]}>
                {row.map((value, index) => (
                  <td key={QUERY_COLUMNS[index]}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span
        ref={indicatorRef}
        className="data-source-query-preview__scroll-indicator"
        aria-hidden="true"
      />
    </div>
  );
}
