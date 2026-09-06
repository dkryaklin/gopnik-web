/**
 * The author's print unit, in TypeScript: `#` takes the next integer argument
 * and `^0`..`^7` pick a colour (handled downstream by the console).
 */

import type { DosConsole } from '../ui/console'
import { t, type MsgKey, type Vars } from '../i18n'
import { HaltGame } from './state'

export type Arg = number | Vars

let con: DosConsole

export function bindConsole(c: DosConsole): void {
  con = c
  journal.length = 0
}

/**
 * The screen kept as the calls that drew it rather than as the text they drew.
 *
 * A message is a key and its arguments right up to the moment it is written,
 * so a screen that is remembered that way can be written again in another
 * language. That is the whole of what the language picker does: it sets the
 * locale and asks for the journal back, and the game the player is looking at
 * is in the new language, not just the next thing it says.
 *
 * Arguments that were already text when they were passed — an enemy's type
 * dropped into the middle of a sentence — come back in the language they were
 * resolved in. The game prints those screens again on its own soon enough.
 */
interface Entry {
  /** A key to translate, or null when the text was composed by the caller. */
  key: MsgKey | null
  args: Arg[]
  text: string
  /** Whether the entry ends its line, and whether the line is drawn art. */
  line: boolean
  art: boolean
}

/** Deeper than the terminal's own scrollback, so a redraw fills the screen. */
const JOURNAL = 2000
const journal: Entry[] = []

function keep(entry: Entry): Entry {
  journal.push(entry)
  if (journal.length > JOURNAL) journal.splice(0, journal.length - JOURNAL)
  return entry
}

function draw(entry: Entry): void {
  const text = entry.key === null ? entry.text : build(entry.key, entry.args)
  if (entry.art) con.writeArtLine(text)
  else if (entry.line) con.writeLine(text)
  else con.write(text)
}

function emit(entry: Entry): void {
  draw(keep(entry))
}

/**
 * Remembers something the console put on the screen by itself — the line the
 * player typed, echoed back a character at a time as they typed it.
 */
export function recordLine(text: string): void {
  keep({ key: null, args: [], text, line: true, art: false })
}

/** Draws the whole screen again, in whatever language is now set. */
export function redraw(): void {
  con.redraw(() => { for (const entry of journal) draw(entry) })
}

function build(key: MsgKey, args: Arg[]): string {
  let vars: Vars | undefined
  const nums: number[] = []
  for (const a of args) {
    if (typeof a === 'number') nums.push(a)
    else vars = vars ? { ...vars, ...a } : a
  }
  let i = 0
  // Substitution happens on the finished string, so a `#` inside a player's
  // name eats an argument exactly as it does in the original.
  return t(key, vars).replace(/#/g, () => String(nums[i++] ?? 0))
}

export function print(key: MsgKey, ...args: Arg[]): void {
  emit({ key, args, text: '', line: false, art: false })
}

export function println(key: MsgKey, ...args: Arg[]): void {
  emit({ key, args, text: '', line: true, art: false })
}

/** Prints text that is already composed (ASCII art, concatenated lines). */
export function printRaw(text: string): void {
  emit({ key: null, args: [], text, line: false, art: false })
}

export function printRawLine(text: string): void {
  emit({ key: null, args: [], text, line: true, art: false })
}

/**
 * Prints a line of a screen the author drew rather than wrote: the title, the
 * win animation, the end logo and the captions placed around them. They hold
 * their 80 columns whatever the screen is, and are scaled to fit it.
 */
export function printArtLine(text: string): void {
  emit({ key: null, args: [], text, line: true, art: true })
}

export function printlnArt(key: MsgKey, ...args: Arg[]): void {
  emit({ key, args, text: '', line: true, art: true })
}

/** Bare WriteLn calls; the original uses them for vertical layout. */
export function blank(count = 1): void {
  for (let i = 0; i < count; i++) printRawLine('')
}

export function msg(key: MsgKey, vars?: Vars): string {
  return t(key, vars)
}

export function clrScr(): void {
  journal.length = 0
  con.clear()
}

export function delay(ms: number): Promise<void> {
  return con.delay(ms)
}

export function readKey(): Promise<string> {
  return con.readKey()
}

export function readLine(): Promise<string> {
  return con.readLine()
}

/** Turbo Pascal-ish: only ASCII letters are folded, exactly like the original. */
export function lowerCase(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    out += c >= 65 && c <= 90 ? String.fromCharCode(c + 32) : ch
  }
  return out
}

/** Reads a command line and lower-cases it, as every prompt in the game does. */
export async function readCmd(): Promise<string> {
  return lowerCase(await readLine())
}

export function halt(): never {
  throw new HaltGame()
}
