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
  con.write(build(key, args))
}

export function println(key: MsgKey, ...args: Arg[]): void {
  con.writeLine(build(key, args))
}

/** Prints text that is already composed (ASCII art, concatenated lines). */
export function printRaw(text: string): void {
  con.write(text)
}

export function printRawLine(text: string): void {
  con.writeLine(text)
}

/**
 * Prints a line of a screen the author drew rather than wrote: the title, the
 * win animation, the end logo and the captions placed around them. They hold
 * their 80 columns whatever the screen is, and are scaled to fit it.
 */
export function printArtLine(text: string): void {
  con.writeArtLine(text)
}

export function printlnArt(key: MsgKey, ...args: Arg[]): void {
  con.writeArtLine(build(key, args))
}

/** Bare WriteLn calls; the original uses them for vertical layout. */
export function blank(count = 1): void {
  for (let i = 0; i < count; i++) con.writeLine('')
}

export function msg(key: MsgKey, vars?: Vars): string {
  return t(key, vars)
}

export function clrScr(): void {
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
