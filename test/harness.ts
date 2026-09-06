import type { DosConsole } from '../src/ui/console'
import { bindConsole } from '../src/engine/io'
import { HaltGame } from '../src/engine/state'

export class ScriptEnd extends Error {}

/** A console that answers from a script and records everything printed. */
export function scripted(lines: string[]) {
  const out: string[] = []
  let current = ''
  const con = {
    write(text: string) { current += text },
    writeLine(text: string) { out.push(current + text); current = '' },
    writeArtLine(text: string) { out.push(current + text); current = '' },
    clear() { out.push('--- clrscr ---') },
    delay() { return Promise.resolve() },
    readKey() { return Promise.resolve(' ') },
    readLine() {
      if (!lines.length) throw new ScriptEnd('script exhausted')
      const value = lines.shift()!
      out.push(current + value)
      current = ''
      return Promise.resolve(value)
    },
  }
  bindConsole(con as unknown as DosConsole)
  return { out, text: () => out.join('\n') }
}

export async function play(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (error instanceof HaltGame || error instanceof ScriptEnd) return
    throw error
  }
}
