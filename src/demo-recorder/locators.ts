import type { DemoLocator, DemoTarget } from './types'

const INTERACTIVE = [
  'button',
  'a[href]',
  'input',
  'textarea',
  'select',
  'summary',
  'label',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="option"]',
  '[role="menuitem"]',
  '[role="menuitemradio"]',
  '[role="menuitemcheckbox"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="slider"]',
  '[role="treeitem"]',
  '[data-demo]',
  '[data-testid]',
].join(',')

const IMPLICIT_ROLES: Record<string, string> = {
  BUTTON: 'button',
  A: 'link',
  SELECT: 'combobox',
  TEXTAREA: 'textbox',
  SUMMARY: 'button',
}

/** The element a person meant: the nearest interactive ancestor, else what is under the pointer. */
export function intendedElement(node: Element): Element {
  return node.closest(INTERACTIVE) ?? node
}

export function isInteractive(node: Element) {
  return node.matches(INTERACTIVE)
}

function roleOf(el: Element): string | null {
  const explicit = el.getAttribute('role')
  if (explicit) return explicit.split(' ')[0]
  if (el instanceof HTMLInputElement) {
    if (['button', 'submit', 'reset'].includes(el.type)) return 'button'
    if (el.type === 'checkbox') return 'checkbox'
    if (el.type === 'radio') return 'radio'
    if (el.type === 'range') return 'slider'
    return 'textbox'
  }
  return IMPLICIT_ROLES[el.tagName] ?? null
}

const clean = (value: string | null | undefined) => (value ?? '').replace(/\s+/g, ' ').trim()

/** Close to the accessible name Playwright computes, which is enough to find the element again. */
function nameOf(el: Element): string {
  const label = clean(el.getAttribute('aria-label'))
  if (label) return label
  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    const text = clean(
      labelledBy
        .split(' ')
        .map((id) => document.getElementById(id)?.textContent)
        .join(' '),
    )
    if (text) return text
  }
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const forLabel = el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null
    const text = clean(forLabel?.textContent ?? el.closest('label')?.textContent)
    if (text) return text
    return clean(el.getAttribute('title') ?? el.placeholder)
  }
  return clean(el.textContent) || clean(el.getAttribute('title'))
}

/** Ids from React (`:r1:`), Radix (`radix-…`) or counters change between runs. */
const stableId = (id: string) => id && !/[:]|^radix-|\d{3,}/.test(id)

/** Hashed CSS-module classes (`_panel_1x2y3_12`) are stable per build but meaningless; skip them. */
const stableClass = (name: string) => /^[a-z][a-z0-9-]*$/i.test(name) && !/^_/.test(name)

function cssPath(el: Element): string {
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.body && parts.length < 6) {
    if (node.id && stableId(node.id)) {
      parts.unshift(`#${CSS.escape(node.id)}`)
      break
    }
    const attr = node.getAttribute('data-demo') ?? node.getAttribute('data-testid')
    if (attr) {
      parts.unshift(`[${node.hasAttribute('data-demo') ? 'data-demo' : 'data-testid'}="${CSS.escape(attr)}"]`)
      break
    }
    let part = node.tagName.toLowerCase()
    const classes = [...node.classList].filter(stableClass).slice(0, 2)
    if (classes.length) part += classes.map((name) => `.${CSS.escape(name)}`).join('')
    const parent: Element | null = node.parentElement
    if (parent) {
      const siblings = [...parent.children].filter((child) => child.tagName === node!.tagName)
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`
    }
    parts.unshift(part)
    node = parent
  }
  return parts.join(' > ')
}

function nthAmong(el: Element, candidates: Iterable<Element>) {
  const list = [...candidates]
  return list.length > 1 ? list.indexOf(el) : undefined
}

export function describeTarget(el: Element, point: [number, number]): DemoTarget {
  const locators: DemoLocator[] = []
  const testid = el.getAttribute('data-demo') ?? el.getAttribute('data-testid')
  if (testid) locators.push({ kind: 'testid', value: testid })
  if (el.id && stableId(el.id)) locators.push({ kind: 'css', value: `#${CSS.escape(el.id)}` })

  const role = roleOf(el)
  const name = role ? nameOf(el).slice(0, 80) : ''
  if (role && name) {
    const same = [...document.querySelectorAll('*')].filter((other) => roleOf(other) === role && nameOf(other).slice(0, 80) === name)
    locators.push({ kind: 'role', role, name, nth: nthAmong(el, same) })
  }
  if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.placeholder) {
    const same = document.querySelectorAll(`[placeholder="${CSS.escape(el.placeholder)}"]`)
    locators.push({ kind: 'placeholder', value: el.placeholder, nth: nthAmong(el, same) })
  }
  const text = clean(el.textContent)
  if (!role && text && text.length <= 60 && el.children.length === 0) {
    locators.push({ kind: 'text', value: text })
  }
  const css = cssPath(el)
  if (css) locators.push({ kind: 'css', value: css, nth: nthAmong(el, document.querySelectorAll(css)) })

  const label = role && name ? `${role} "${name}"` : text ? `${el.tagName.toLowerCase()} "${text.slice(0, 40)}"` : el.tagName.toLowerCase()
  return { label, locators, viewport: [Math.round(point[0]), Math.round(point[1])] }
}

/** Where inside the element the pointer was, 0–1 on each axis. */
export function relativePoint(el: Element, x: number, y: number): [number, number] {
  const box = el.getBoundingClientRect()
  if (!box.width || !box.height) return [0.5, 0.5]
  const round = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 1000) / 1000
  return [round((x - box.left) / box.width), round((y - box.top) / box.height)]
}
