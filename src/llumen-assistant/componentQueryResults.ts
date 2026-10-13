import type { CreatedComponent } from './assistantReplyTypes'
import { airQualityMapQueryTable } from './airQualityMapDemoData'

export type QueryResultTable = {
  columns: string[]
  rows: string[][]
}

const QUERY_RESULTS_BY_ID: Record<string, QueryResultTable> = {
  'air-quality-monitoring-map': airQualityMapQueryTable(),
  'air-quality-index': {
    columns: ['Timestamp', 'Station', 'AQI', 'Category', 'Dominant pollutant'],
    rows: [
      ['08:00', 'Network average', '96', 'Moderate', 'NO₂'],
      ['10:00', 'Network average', '108', 'Unhealthy for Sensitive', 'NO₂'],
      ['12:00', 'Network average', '121', 'Unhealthy for Sensitive', 'NO₂'],
      ['14:00', 'Network average', '118', 'Unhealthy for Sensitive', 'PM₂.₅'],
      ['16:00', 'Network average', '125', 'Unhealthy for Sensitive', 'NO₂'],
    ],
  },
  'pollutant-readings': {
    columns: ['Pollutant', 'Value', 'Unit', 'Threshold', 'Classification'],
    rows: [
      ['NO₂', '430', 'µg/m³', '200', 'Critical'],
      ['PM₂.₅', '70', 'µg/m³', '55', 'Critical'],
      ['PM₁₀', '82', 'µg/m³', '150', 'Normal'],
      ['O₃', '54', 'µg/m³', '180', 'Normal'],
      ['SO₂', '18', 'µg/m³', '125', 'Normal'],
      ['CO', '0.6', 'mg/m³', '10', 'Normal'],
    ],
  },
  'population-exposure': {
    columns: ['Cohort', 'Population', 'Share', 'Priority'],
    rows: [
      ['Youth (0–14)', '420,000', '52.5%', 'High'],
      ['Seniors (65+)', '380,000', '47.5%', 'High'],
      ['Working age (15–64)', '1,960,000', '—', 'Standard'],
      ['Outdoor workers', '95,000', '—', 'Elevated'],
    ],
  },
  'land-use-distribution': {
    columns: ['Land use', 'Area share', 'Near elevated stations', 'Source risk'],
    rows: [
      ['Industrial', '34%', 'Yes', 'High'],
      ['Transport / roads', '22%', 'Yes', 'High'],
      ['Residential', '28%', 'Adjacent', 'Medium'],
      ['Commercial', '11%', 'Partial', 'Low'],
      ['Open / vacant', '5%', 'No', 'Low'],
    ],
  },
  'wind-direction': {
    columns: ['Hour', 'Direction', 'Speed (m/s)', 'Aligned with corridor'],
    rows: [
      ['10:00', 'NW', '3.2', 'Yes'],
      ['11:00', 'NNW', '3.8', 'Yes'],
      ['12:00', 'N', '4.1', 'Yes'],
      ['13:00', 'NNE', '3.6', 'Partial'],
      ['14:00', 'NE', '2.9', 'No'],
    ],
  },
  'high-heat-districts': {
    columns: ['District', 'Demand (AED)', 'QoQ change', 'Share of total'],
    rows: [
      ['Marina', '2.4B', '+8.1%', '31.6%'],
      ['Downtown', '1.9B', '+7.4%', '25.0%'],
      ['JLT', '1.1B', '+4.2%', '14.5%'],
      ['Business Bay', '0.9B', '+5.8%', '11.8%'],
      ['Other high-heat', '1.3B', '+3.9%', '17.1%'],
    ],
  },
  'price-gap-benchmark': {
    columns: ['Category', 'Gap (pp)', 'QoQ change (pp)', 'Trend'],
    rows: [
      ['Network average', '17.8', '−4.1', 'Improving'],
      ['Grocery', '14.2', '−3.6', 'Improving'],
      ['Electronics', '22.5', '−5.2', 'Improving'],
      ['Apparel', '19.1', '−2.8', 'Improving'],
      ['Home', '16.4', '−4.7', 'Improving'],
    ],
  },
  'store-traffic-index': {
    columns: ['Store', 'Corridor', 'Traffic index', 'vs prior period'],
    rows: [
      ['Marina Walk A', 'Marina', '128', '+14%'],
      ['Pier 7', 'Marina', '121', '+11%'],
      ['JBR Plaza', 'Marina', '117', '+9%'],
      ['Bluewaters link', 'Marina', '109', '+6%'],
      ['Network avg', '—', '104', '+3%'],
    ],
  },
  'returns-rate': {
    columns: ['District', 'Net returns %', 'MoM change (pp)', 'Volume'],
    rows: [
      ['Coastal North', '3.1%', '−0.5', '1,842'],
      ['Coastal Central', '3.4%', '−0.4', '2,106'],
      ['Inland East', '4.2%', '−0.1', '1,455'],
      ['Inland West', '3.9%', '−0.2', '1,288'],
      ['Network', '3.6%', '−0.3', '6,691'],
    ],
  },
}

function fallbackTable(component: CreatedComponent): QueryResultTable {
  return {
    columns: ['Field', 'Value'],
    rows: [
      ['Component', component.title],
      ['Semantic ID', component.semanticId ?? '—'],
      ['Type', component.type],
      ['Description', component.description],
    ],
  }
}

export function queryResultsForComponent(component: CreatedComponent): QueryResultTable {
  return QUERY_RESULTS_BY_ID[component.id] ?? fallbackTable(component)
}
