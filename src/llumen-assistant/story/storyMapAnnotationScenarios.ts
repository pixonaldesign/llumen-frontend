/**
 * Approach 3: one scenario per map annotation type, offered from the rail composer's
 * annotation menu after the first prompt. Each scenario's prompt is typed into the composer
 * when the user clicks it, like Approach 2's suggested prompts.
 */

export type MapAnnotationType = 'marker' | 'text' | 'line' | 'arrow' | 'polygon' | 'rectangle' | 'circle'

export type MapAnnotationScenario = {
  type: MapAnnotationType
  label: string
  /** One line under the label in the menu. */
  description: string
  /** GeoJSON geometry the annotation is stored as. */
  geometry: 'Point' | 'LineString' | 'Polygon'
  /** Feature-anchored annotations follow a data entity; geometry-anchored ones stay on their area. */
  anchor: 'feature' | 'geometry'
  prompt: string
}

export const MAP_ANNOTATION_SCENARIOS: MapAnnotationScenario[] = [
  {
    type: 'marker',
    label: 'Marker',
    description: 'Marks a geographic point',
    geometry: 'Point',
    anchor: 'feature',
    prompt:
      'Mark the top 10 schools with the busiest junctions around them in 2024–2025, and mark those junctions on the map too.',
  },
  {
    type: 'text',
    label: 'Text',
    description: 'Adds text anchored to a point',
    geometry: 'Point',
    anchor: 'geometry',
    prompt: 'Add a label over Al Markaziyah on the map showing its average junction load for 2024–2025.',
  },
  {
    type: 'line',
    label: 'Line',
    description: 'Connects geographic points',
    geometry: 'LineString',
    anchor: 'feature',
    prompt: 'Draw a line connecting the 5 busiest junctions along the Corniche for 2024–2025.',
  },
  {
    type: 'arrow',
    label: 'Arrow',
    description: 'Directional line between points',
    geometry: 'LineString',
    anchor: 'geometry',
    prompt: 'Show with an arrow where the morning traffic flows from Al Mussafah onto the island in 2024–2025.',
  },
  {
    type: 'polygon',
    label: 'Polygon',
    description: 'Highlights an arbitrary area',
    geometry: 'Polygon',
    anchor: 'geometry',
    prompt: "Highlight the area where congested junctions cluster in 2024–2025 and annotate what's driving it.",
  },
  {
    type: 'rectangle',
    label: 'Rectangle',
    description: 'Highlights a rectangular area',
    geometry: 'Polygon',
    anchor: 'geometry',
    prompt: 'Highlight the downtown grid around Al Markaziyah with a rectangle and summarize its junction load for 2024–2025.',
  },
  {
    type: 'circle',
    label: 'Circle',
    description: 'Highlights an area around a point',
    geometry: 'Polygon',
    anchor: 'geometry',
    prompt: 'Circle a 1 km radius around Sheikh Zayed Bridge and show how many of its junctions were congested in 2024–2025.',
  },
]

export function mapAnnotationScenario(type: MapAnnotationType): MapAnnotationScenario {
  return MAP_ANNOTATION_SCENARIOS.find((scenario) => scenario.type === type) ?? MAP_ANNOTATION_SCENARIOS[0]
}
