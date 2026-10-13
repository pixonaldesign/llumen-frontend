import type { StoryScene } from './storyDemoScenes'
import type { ChartCardId } from './storyKpi'

/** Approach 2: chart cards re-scoped to a past period while the map stays as is. */
export const CHART_PERIOD_LABEL = '2024–2025'
export const PERIOD_VOLUME_X = ['Jan 24', 'Jul 24', 'Jan 25', 'Jul 25', 'Dec 25']
export const PERIOD_LOAD_X = ['Q1', 'Q2', 'Q3', 'Q4', 'Q1', 'Q2', 'Q3', 'Q4']
export const PERIOD_VOLUME_LEGEND: [string, string] = ['2025', '2024']

export type ChatComponent = { id: ChartCardId; label: string }

const CHART_CARD_IDS: ChartCardId[] = ['emissions', 'groundwater', 'biodiversity', 'sites']

export function isChartCard(id: string): id is ChartCardId {
  return (CHART_CARD_IDS as string[]).includes(id)
}

export function periodPrompt(labels: string[]) {
  const list =
    labels.length === 0
      ? 'these charts'
      : labels.length === 1
        ? labels[0]
        : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
  return `Show me the ${list} data from 2024 to 2025.`
}

function clampY(y: number) {
  return Math.max(2, Math.min(98, y))
}

/** The same scene with its chart values swapped for the 2024–2025 period. */
export function periodScene(scene: StoryScene): StoryScene {
  const insight = scene.insight
  const junctions = insight.terrestrial + insight.marine
  const marine = Math.min(junctions, Math.round(insight.marine * 1.24))
  const online = Math.max(0, Math.min(insight.sites, insight.online - 21))
  return {
    ...scene,
    insight: {
      ...insight,
      emissionsLabels: ['10k', '6.5k', '3k', '0'],
      emissionsWarp: (x, y) =>
        clampY(insight.emissionsWarp(x, y) * 0.74 + 10 - 9 * Math.sin((2 * Math.PI * x) / 46)),
      groundwaterValue: Math.min(100, Math.round(insight.groundwaterValue * 1.11)),
      groundwaterWarp: (x, y) =>
        clampY(insight.groundwaterWarp(x, y) - 12 - 7 * Math.sin((2 * Math.PI * x) / 62)),
      terrestrial: junctions - marine,
      marine,
      online,
      uptime: Math.round((online / Math.max(1, insight.sites)) * 100),
      offlineBars: [...insight.offlineBars, 9, 28].filter((bar, index, bars) => bars.indexOf(bar) === index),
    },
  }
}
