import { MOCK_DATASET, columnLabel, type MockDataset } from "./mockDataset";

type Props = {
  chartId?: string;
  dataset?: MockDataset;
};

export default function ChartDataQueryPreview({ dataset = MOCK_DATASET }: Props) {
  const table = {
    columns: dataset.columns.map((c) => c.name),
    rows: dataset.rows,
  };

  return (
    <div className="chart-data-query">
      <div className="chart-data-query__meta">
        <span className="chart-data-query__label">{dataset.name}</span>
        <span className="chart-data-query__count">{table.rows.length} rows</span>
      </div>
      <div className="chart-data-query__table-wrap">
        <table className="chart-data-query__table">
          <thead>
            <tr>
              {table.columns.map((col) => (
                <th key={col} scope="col">
                  {columnLabel(col, dataset)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, index) => (
              <tr key={index}>
                {table.columns.map((col) => (
                  <td key={col}>{row[col]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
