import { textWidth } from './width'
import ru from './ru'
import en from './en'
import zh from './zh'
import ja from './ja'
import es from './es'
import pt from './pt'
import fr from './fr'
import de from './de'
import id from './id'

/**
 * The languages, by their own name for themselves — that is what a picker
 * wants. Russian first because it is the original, English second because it
 * is the one everything else was translated against.
 */
export const LOCALES = {
  ru: 'Русский',
  en: 'English',
  zh: '中文',
  ja: '日本語',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  id: 'Indonesia',
} as const

export type Locale = keyof typeof LOCALES
export type MsgKey = keyof typeof ru

/**
 * A message used as a value inside another message — the enemy's type in the
 * middle of a sentence about him, the word for a broken jaw after his health.
 *
 * It stays a key right up to the moment the line is written, so the line can
 * be written again in another language and come back whole rather than with
 * the words it was built out of still in the old one. `cells` pads the result
 * out to a column of the 80-column screen, which is the one thing that cannot
 * be done afterwards: the padding depends on how wide the word turned out.
 */
export interface Ref {
  key: MsgKey
  vars?: Vars
  cells?: number
}

/** Anything a `{named}` slot can be filled with; a list is run together. */
export type Value = string | number | Ref | Value[]
export type Vars = Record<string, Value>

/**
 * Only ru and en are guaranteed whole: the rest are translated one key at a
 * time by tools/i18n/translate.mjs and a missing line falls through to English.
 */
const catalogs: Record<Locale, Partial<Record<MsgKey, string>>> =
  { ru, en, zh, ja, es, pt, fr, de, id }
const STORAGE_KEY = 'gopnik.locale'

function isLocale(value: string): value is Locale {
  return value in LOCALES
}

function detect(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && isLocale(saved)) return saved
  } catch { /* private mode */ }
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en']
  for (const tag of langs) {
    // A browser asks for pt-BR or zh-Hans-CN; the catalogues are one per
    // language, so only the first subtag matters.
    const base = tag.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return 'en'
}

let locale: Locale = detect()
const listeners = new Set<(l: Locale) => void>()

export function getLocale(): Locale {
  return locale
}

export function setLocale(l: Locale): void {
  if (l === locale) return
  locale = l
  try { localStorage.setItem(STORAGE_KEY, l) } catch { /* private mode */ }
  if (typeof document !== 'undefined') document.documentElement.lang = l
  for (const fn of listeners) fn(l)
}

export function onLocaleChange(fn: (l: Locale) => void): void {
  listeners.add(fn)
}

/** Pads a value out to its column, not counting the colour codes it carries. */
function pad(text: string, cells: number): string {
  return text + ' '.repeat(Math.max(1, cells - textWidth(text.replace(/\^\d/g, ''))))
}

function fill(value: Value): string {
  if (Array.isArray(value)) return value.map(fill).join('')
  if (typeof value !== 'object') return String(value)
  const text = t(value.key, value.vars)
  return value.cells === undefined ? text : pad(text, value.cells)
}

/** Looks up a message and fills in its `{named}` placeholders. */
export function t(key: MsgKey, vars?: Vars): string {
  const text = catalogs[locale][key] ?? en[key] ?? ru[key] ?? key
  if (!vars) return text
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? fill(vars[name]) : whole,
  )
}
