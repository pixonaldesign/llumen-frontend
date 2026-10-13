/**
 * Demo maps offered for the comparison split: other slides of the story, maps from other
 * stories, the same map earlier in its time series, or the same map under another filter.
 */
import type { StoryFilter, StorySlide } from './storyDemoData'
import type { StoryMapLayerVisibility } from './StoryMap'
import type { TimelineRange } from './storyTimeline'

export type ComparisonSource = 'slides' | 'stories' | 'time' | 'filters'

export const COMPARISON_SOURCES: { id: ComparisonSource; label: string }[] = [
  { id: 'slides', label: 'This Story' },
  { id: 'stories', label: 'Other Stories' },
  { id: 'time', label: 'Time Series' },
  { id: 'filters', label: 'Filters' },
]

export type ComparisonMapOption = {
  id: string
  source: ComparisonSource
  sceneIndex: number
  /** How far back along the shared time series this map sits, as a share of the range. */
  phaseOffset: number
  layers: StoryMapLayerVisibility
  eyebrow: string
  title: string
}

const ALL_LAYERS: StoryMapLayerVisibility = { junctions: true, distribution: true }

const OTHER_STORY_MAPS = [
  {
    id: 'r2',
    story: 'Brand Repositioning Strategy for the Next-Gen Consumer Market',
    title: 'Vehicle Idle Hotspots',
    sceneIndex: 2,
  },
  {
    id: 'r3',
    story: 'User Onboarding Redesign: Reducing Time-to-Value by 40%',
    title: 'Corridor Heat Concentration',
    sceneIndex: 1,
  },
  {
    id: 'r4',
    story: 'Enterprise Pipeline Acceleration: Lessons From Q3 Wins',
    title: 'Monitored Junction Coverage',
    sceneIndex: 0,
  },
  {
    id: 'r5',
    story: 'Streamlining Cross-Team Workflows With Automation',
    title: 'Port Approach Freight Windows',
    sceneIndex: 2,
  },
]

/** Kept to a few per source: every preview is a live map. */
const TIME_OFFSETS = [0.125, 0.25, 0.5, 0.75]

/** Filters that change what is counted rather than where the map looks. */
const SCOPE_FILTER_IDS = new Set(['loc', 'year'])

/** Demo stand-in for the data a different filter returns. */
const FILTER_PHASE_OFFSETS = [0.15, 0.4, 0.6, 0.85]

function rangeAgo(range: TimelineRange, share: number) {
  const amount = Math.max(1, Math.round(range.amount * share))
  return `${amount} ${range.unit}${amount === 1 ? '' : 's'} earlier`
}

export function comparisonOptions({
  slides,
  activeSlideIndex,
  filters,
  range,
}: {
  slides: StorySlide[]
  activeSlideIndex: number
  filters: StoryFilter[]
  range: TimelineRange
}): ComparisonMapOption[] {
  const active = slides[activeSlideIndex]
  const slideOptions = slides.flatMap((slide, index): ComparisonMapOption[] =>
    index === activeSlideIndex
      ? []
      : [
          {
            id: `slide-${slide.id}`,
            source: 'slides',
            sceneIndex: index,
            phaseOffset: 0,
            layers: ALL_LAYERS,
            eyebrow: `Slide ${index + 1}`,
            title: slide.title,
          },
        ],
  )
  const storyOptions = OTHER_STORY_MAPS.map(
    (map): ComparisonMapOption => ({
      id: `story-${map.id}`,
      source: 'stories',
      sceneIndex: map.sceneIndex,
      phaseOffset: 0,
      layers: ALL_LAYERS,
      eyebrow: map.story,
      title: map.title,
    }),
  )
  const timeOptions = TIME_OFFSETS.map(
    (share): ComparisonMapOption => ({
      id: `time-${share}`,
      source: 'time',
      sceneIndex: activeSlideIndex,
      phaseOffset: share,
      layers: ALL_LAYERS,
      eyebrow: rangeAgo(range, share),
      title: active.title,
    }),
  )
  const filterOptions = filters
    .filter((filter) => !SCOPE_FILTER_IDS.has(filter.id))
    .slice(0, FILTER_PHASE_OFFSETS.length)
    .map(
      (filter, index): ComparisonMapOption => ({
        id: `filter-${filter.id}`,
        source: 'filters',
        sceneIndex: activeSlideIndex,
        phaseOffset: FILTER_PHASE_OFFSETS[index],
        layers: ALL_LAYERS,
        eyebrow: `Without ${filter.label}`,
        title: active.title,
      }),
    )
  return [...slideOptions, ...storyOptions, ...timeOptions, ...filterOptions]
}

export function matchesComparisonQuery(option: ComparisonMapOption, query: string) {
  const needle = query.trim().toLowerCase()
  return !needle || `${option.eyebrow} ${option.title}`.toLowerCase().includes(needle)
}

/** The option's point on the shared time series loop. */
export function comparisonPhase(framePhase: number, option: ComparisonMapOption) {
  return (((framePhase - option.phaseOffset) % 1) + 1) % 1
}
