/*
 * Expressions in conditions: `{{path}}` references to the row, with numbers, quoted text, true/false/null,
 * `+ - * / %` and brackets between them. `+` joins when either side is text. Anything that doesn't parse,
 * like `{{first}} {{last}}`, reads as a template: the references filled in, the rest kept as written.
 */

const REFERENCE = /\{\{\s*([^{}]*?)\s*\}\}/g
const ONLY_REFERENCE = /^\{\{\s*([^{}]*?)\s*\}\}$/

export type Resolve = (path: string) => unknown

type Token = { kind: 'ref'; path: string } | { kind: 'value'; value: unknown } | { kind: 'op'; op: string }

const asText = (value: unknown) =>
  value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)

/** The references an expression reads, in order, e.g. `hair.color`. */
export const referencesIn = (text: string) => [...text.matchAll(REFERENCE)].map((match) => match[1].trim()).filter(Boolean)

/** The path when the expression is exactly one reference, e.g. `{{ age }}` gives `age`. */
export const singleReference = (text: string) => ONLY_REFERENCE.exec(text.trim())?.[1].trim() || undefined

export const referenceToken = (path: string) => `{{ ${path} }}`

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = []
  let index = 0
  while (index < text.length) {
    const rest = text.slice(index)
    const space = /^\s+/.exec(rest)
    if (space) {
      index += space[0].length
      continue
    }
    const ref = /^\{\{\s*([^{}]*?)\s*\}\}/.exec(rest)
    const number = /^\d+(\.\d+)?/.exec(rest)
    const quoted = /^(['"])((?:\\.|(?!\1).)*)\1/.exec(rest)
    const word = /^(true|false|null)\b/.exec(rest)
    if (ref) tokens.push({ kind: 'ref', path: ref[1].trim() })
    else if (number) tokens.push({ kind: 'value', value: Number(number[0]) })
    else if (quoted) tokens.push({ kind: 'value', value: quoted[2].replace(/\\(.)/g, '$1') })
    else if (word) tokens.push({ kind: 'value', value: word[0] === 'null' ? null : word[0] === 'true' })
    else if ('+-*/%()'.includes(rest[0])) tokens.push({ kind: 'op', op: rest[0] })
    else return null
    index += (ref ?? number ?? quoted ?? word)?.[0].length ?? 1
  }
  return tokens
}

const finite = (value: number) => (Number.isFinite(value) ? value : null)

function apply(op: string, left: unknown, right: unknown): unknown {
  if (op === '+' && (typeof left === 'string' || typeof right === 'string' || typeof left === 'object' || typeof right === 'object')) {
    return asText(left) + asText(right)
  }
  const a = Number(left)
  const b = Number(right)
  if (op === '+') return finite(a + b)
  if (op === '-') return finite(a - b)
  if (op === '*') return finite(a * b)
  if (op === '/') return finite(a / b)
  return finite(a % b)
}

/** Recursive descent over the tokens: sums of products of signed terms. */
function parse(tokens: readonly Token[], resolve: Resolve): { ok: true; value: unknown } | { ok: false } {
  let at = 0
  const fail = { ok: false } as const
  const peek = () => tokens[at]
  const isOp = (token: Token | undefined, ops: string): token is { kind: 'op'; op: string } => token?.kind === 'op' && ops.includes(token.op)

  function primary(): { value: unknown } | null {
    const token = tokens[at++]
    if (!token) return null
    if (token.kind === 'ref') return { value: resolve(token.path) }
    if (token.kind === 'value') return { value: token.value }
    if (token.op === '(') {
      const inner = sum()
      if (!inner || !isOp(tokens[at++], ')')) return null
      return inner
    }
    if (token.op === '-') {
      const operand = primary()
      return operand ? { value: finite(-Number(operand.value)) } : null
    }
    return null
  }

  function product(): { value: unknown } | null {
    let left = primary()
    while (left && isOp(peek(), '*/%')) {
      const { op } = tokens[at++] as { op: string }
      const right = primary()
      left = right ? { value: apply(op, left.value, right.value) } : null
    }
    return left
  }

  function sum(): { value: unknown } | null {
    let left = product()
    while (left && isOp(peek(), '+-')) {
      const { op } = tokens[at++] as { op: string }
      const right = product()
      left = right ? { value: apply(op, left.value, right.value) } : null
    }
    return left
  }

  const result = sum()
  return result && at === tokens.length ? { ok: true, value: result.value } : fail
}

/** The expression's value for one row; a lone reference keeps its type, so a list stays a list. */
export function evaluateExpression(text: string, resolve: Resolve): unknown {
  const trimmed = text.trim()
  if (!trimmed) return undefined
  const only = singleReference(trimmed)
  if (only) return resolve(only)
  // `2026-11-02` is a date, not two subtractions.
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed
  const tokens = tokenize(trimmed)
  const parsed = tokens?.length ? parse(tokens, resolve) : { ok: false as const }
  if (parsed.ok) return parsed.value
  return trimmed.replace(REFERENCE, (_whole, path: string) => asText(resolve(path.trim())))
}

/** The expression split into plain text and references, for highlighting. */
export function expressionParts(text: string): { text: string; reference: boolean }[] {
  const parts: { text: string; reference: boolean }[] = []
  let last = 0
  for (const match of text.matchAll(REFERENCE)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), reference: false })
    parts.push({ text: match[0], reference: true })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), reference: false })
  return parts
}
