/** What a field holds, as its chip shows it. */
export type FieldKind = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'

export const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)

export function fieldKind(value: unknown): FieldKind {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (isObject(value)) return 'object'
  return typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'boolean' : 'string'
}

/** `{{path}}` for the rows coming straight in, `{{prefix.path}}` for a named node's. */
export const fieldToken = (prefix: string | null, path: string) => `{{${prefix ? `${prefix}.` : ''}${path}}}`
