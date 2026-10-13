import type { CreatedComponent } from './assistantReplyTypes'

export type VizSectionId = 'mapping' | 'customization' | 'insights' | 'readout'

export type VizStaticField =
  | { kind: 'value'; label: string; value: string; required?: boolean }
  | { kind: 'toggle'; label: string; enabled: boolean }
  | { kind: 'color'; label: string; hex: string; opacity: number; palette: string; paletteType: string }

export type VizStaticSection = {
  title: string
  fields: VizStaticField[]
}

export type VisualizationConfig = {
  visualType: string
  sections: Record<VizSectionId, VizStaticSection[]>
}

const BAR_CHART_CONFIG: VisualizationConfig = {
  visualType: 'Vertical Bar Chart',
  sections: {
    mapping: [
      {
        title: 'Field Mapping',
        fields: [
          { kind: 'value', label: 'X Axis', value: 'value', required: true },
          { kind: 'value', label: 'Y Axis', value: 'category', required: true },
          { kind: 'value', label: 'Series', value: 'timestamp' },
        ],
      },
      {
        title: 'Data Transformation',
        fields: [{ kind: 'value', label: 'Aggregation', value: 'Sum' }],
      },
    ],
    customization: [
      {
        title: 'Colors',
        fields: [
          {
            kind: 'color',
            label: 'Color Palette',
            palette: 'Blue',
            paletteType: 'Sequential · Single',
            hex: '#73ADF5',
            opacity: 100,
          },
        ],
      },
      {
        title: 'Layout & Visibility',
        fields: [
          { kind: 'toggle', label: 'Show Title', enabled: true },
          { kind: 'toggle', label: 'Show Insight', enabled: true },
          { kind: 'toggle', label: 'Show Data Labels', enabled: true },
        ],
      },
      {
        title: 'Legend',
        fields: [
          { kind: 'toggle', label: 'Show Legend', enabled: true },
          { kind: 'value', label: 'Placement', value: 'Top left' },
        ],
      },
      {
        title: 'Status Badge',
        fields: [
          { kind: 'toggle', label: 'Show Status Badge', enabled: true },
          { kind: 'value', label: 'Position', value: 'Under KPI (above chart)' },
        ],
      },
    ],
    insights: [
      {
        title: 'Story Card KPI',
        fields: [
          { kind: 'value', label: 'KPI Value Field', value: 'category' },
          { kind: 'value', label: 'KPI Value Calculation', value: 'Hidden' },
        ],
      },
      {
        title: 'Annotations / Guidelines',
        fields: [
          { kind: 'value', label: 'Source', value: 'Average' },
          { kind: 'value', label: 'Label', value: 'Manual value' },
          { kind: 'toggle', label: 'Show Caption on Chart', enabled: true },
        ],
      },
    ],
    readout: [
      {
        title: 'Axes',
        fields: [
          { kind: 'value', label: 'Axis Label', value: 'Manual value' },
          { kind: 'toggle', label: 'Show Label', enabled: true },
          { kind: 'toggle', label: 'Show Ticks', enabled: true },
          { kind: 'toggle', label: 'Show Tick Labels', enabled: true },
          { kind: 'toggle', label: 'Show Gridlines', enabled: false },
        ],
      },
      {
        title: 'Tooltips',
        fields: [
          { kind: 'toggle', label: 'Enable Tooltip', enabled: true },
          { kind: 'toggle', label: 'Show on Hover', enabled: true },
          { kind: 'toggle', label: 'Show on Click', enabled: false },
        ],
      },
    ],
  },
}

const LINE_CHART_CONFIG: VisualizationConfig = {
  ...BAR_CHART_CONFIG,
  visualType: 'Line Chart',
  sections: {
    ...BAR_CHART_CONFIG.sections,
    mapping: [
      {
        title: 'Field Mapping',
        fields: [
          { kind: 'value', label: 'X Axis', value: 'quarter', required: true },
          { kind: 'value', label: 'Y Axis', value: 'demand_aed', required: true },
          { kind: 'value', label: 'Series', value: 'district' },
        ],
      },
      {
        title: 'Data Transformation',
        fields: [{ kind: 'value', label: 'Aggregation', value: 'Sum' }],
      },
    ],
  },
}

const KPI_CONFIG: VisualizationConfig = {
  visualType: 'KPI Card',
  sections: {
    mapping: [
      {
        title: 'Field Mapping',
        fields: [
          { kind: 'value', label: 'Value Field', value: 'gap_pp', required: true },
          { kind: 'value', label: 'Comparison Field', value: 'benchmark_pp', required: true },
        ],
      },
    ],
    customization: [
      {
        title: 'Layout & Visibility',
        fields: [
          { kind: 'toggle', label: 'Show Title', enabled: true },
          { kind: 'toggle', label: 'Show Delta', enabled: true },
          { kind: 'toggle', label: 'Show Sparkline', enabled: false },
        ],
      },
    ],
    insights: BAR_CHART_CONFIG.sections.insights,
    readout: BAR_CHART_CONFIG.sections.readout,
  },
}

export function getVisualizationConfig(component: CreatedComponent): VisualizationConfig {
  if (component.id === 'high-heat-districts') return LINE_CHART_CONFIG
  if (component.id === 'price-gap-benchmark') return BAR_CHART_CONFIG
  if (component.type === 'kpi') return KPI_CONFIG
  return BAR_CHART_CONFIG
}
