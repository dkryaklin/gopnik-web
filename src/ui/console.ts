/**
 * Keyboard, touch and text output glued together into the blocking console the
 * DOS game expects: ReadKey waits for one key, ReadLn waits for a line.
 */

import { Terminal } from './terminal'

export type KeyMode = 'idle' | 'key' | 'line'

export interface ConsoleHost {
  onModeChange?: (mode: KeyMode) => void
}

const MAX_LINE = 255

export class DosConsole {
  private term: Terminal
  private sink: HTMLInputElement
  private mode: KeyMode = 'idle'
  private resolveKey: ((k: string) => void) | null = null
  private resolveLine: ((s: string) => void) | null = null
  private buffer = ''
  private typeAhead: string[] = []
  private host: ConsoleHost

  constructor(term: Terminal, sink: HTMLInputElement, host: ConsoleHost = {}) {
    this.term = term
    this.sink = sink
    this.host = host

    // Keys are taken from the window so the game works whatever has focus;
    // the hidden input only exists to raise the on-screen keyboard on phones.
    window.addEventListener('keydown', (e) => this.onKeyDown(e))
    sink.addEventListener('beforeinput', (e) => this.onBeforeInput(e as InputEvent))
    sink.addEventListener('input', () => { sink.value = '' })
    sink.addEventListener('blur', () => setTimeout(() => this.focus(), 0))
  }

  focus(): void {
    this.sink.focus({ preventScroll: true })
  }

  getMode(): KeyMode {
    return this.mode
  }

  private setMode(m: KeyMode): void {
    this.mode = m
    this.host.onModeChange?.(m)
  }

  // ---- output -------------------------------------------------------------

  /**
   * Writes one Print() call: `^0`..`^7` switch to the bright colour 8+digit,
   * and the colour is reset to white before and after the call, exactly as the
   * author's print unit does.
   */
  write(text: string): void {
    this.term.hideCaret()
    this.term.setColor(15)
    let i = 0
    let run = ''
    const flush = () => { if (run) { this.term.write(run); run = '' } }
    while (i < text.length) {
      const ch = text[i]
      if (ch === '^') {
        const digit = text.charCodeAt(i + 1) - 48
        if (digit >= 0 && digit <= 7) {
          flush()
          this.term.setColor(8 + digit)
          i += 2
          continue
        }
        i += 2 // a caret with no colour digit swallows the next character too
        continue
      }
      run += ch
      i++
    }
    flush()
    this.term.setColor(15)
  }

  writeLine(text: string): void {
    this.write(text)
    this.term.newline()
  }

  /**
   * Writes a line of one of the drawn screens - the title, the win, the end.
   * They were laid out by hand in 80 columns and are scaled to a narrower
   * screen rather than reflowed onto it.
   */
  writeArtLine(text: string): void {
    this.term.markArt()
    this.writeLine(text)
  }

  clear(): void {
    this.term.clear()
  }

  delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms))
  }

  // ---- input --------------------------------------------------------------

  readKey(): Promise<string> {
    const buffered = this.typeAhead.shift()
    if (buffered !== undefined) return Promise.resolve(buffered)
    this.setMode('key')
    return new Promise<string>((resolve) => {
      this.resolveKey = resolve
    })
  }

  readLine(): Promise<string> {
    this.setMode('line')
    this.buffer = ''
    this.term.showCaret()
    const promise = new Promise<string>((resolve) => {
      this.resolveLine = resolve
    })
    // Keys pressed while the game was busy are typed ahead, as DOS would.
    const buffered = this.typeAhead.splice(0, this.typeAhead.length)
    for (const ch of buffered) this.pressKey(ch)
    return promise
  }

  /** Feeds one character as if it were typed (touch bar, tap to continue). */
  pressKey(ch: string): void {
    if (this.mode === 'idle') {
      if (this.typeAhead.length < 16) this.typeAhead.push(ch)
      return
    }
    if (this.mode === 'key') {
      const resolve = this.resolveKey
      this.resolveKey = null
      // The mode flips before the waiter runs, so keys typed in the same tick
      // land in the type-ahead buffer instead of being dropped.
      this.setMode('idle')
      resolve?.(ch)
    } else if (this.mode === 'line') {
      if (ch === '\n' || ch === '\r') this.submitLine()
      else if (ch === '\b') this.backspace()
      else this.insert(ch)
    }
  }

  /** Types a whole command and submits it (touch bar). */
  pressCommand(cmd: string): void {
    if (this.mode === 'key') {
      this.pressKey(cmd[0] ?? ' ')
      return
    }
    if (this.mode !== 'line') return
    while (this.buffer.length) this.backspace()
    this.insert(cmd)
    this.submitLine()
  }

  private insert(text: string): void {
    for (const ch of text) {
      if (ch < ' ') continue
      if (this.buffer.length >= MAX_LINE) return
      this.buffer += ch
      this.term.hideCaret()
      this.term.write(ch)
      this.term.showCaret()
    }
  }

  private backspace(): void {
    if (!this.buffer.length) return
    this.buffer = this.buffer.slice(0, -1)
    this.term.backspace()
  }

  private submitLine(): void {
    this.term.hideCaret()
    this.term.newline()
    const line = this.buffer
    this.buffer = ''
    const resolve = this.resolveLine
    this.resolveLine = null
    this.setMode('idle')
    resolve?.(line)
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const target = e.target as HTMLElement | null
    if (target && target !== this.sink && target.tagName === 'BUTTON') return
    if (e.key === 'Unidentified' || e.key === 'Process') return
    if (e.key === 'Tab' || e.key === 'F5' || e.key.startsWith('Arrow')) return
    if (this.mode === 'idle') {
      if (e.key.length === 1 || e.key === 'Enter') {
        e.preventDefault()
        this.pressKey(e.key === 'Enter' ? '\r' : e.key)
      }
      return
    }
    if (this.mode === 'key') {
      if (e.key.length === 1 || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.pressKey(e.key === 'Enter' ? '\r' : e.key)
      }
      return
    }
    if (this.mode !== 'line') return
    if (e.key === 'Enter') {
      e.preventDefault()
      this.submitLine()
    } else if (e.key === 'Backspace') {
      e.preventDefault()
      this.backspace()
    }
  }

  private onBeforeInput(e: InputEvent): void {
    e.preventDefault()
    if (this.mode === 'idle') {
      if (e.inputType === 'insertText' && e.data) this.pressKey(e.data[0])
      return
    }
    switch (e.inputType) {
      case 'insertText':
      case 'insertCompositionText':
      case 'insertFromPaste':
        if (this.mode === 'key') this.pressKey((e.data ?? ' ')[0])
        else this.insert(e.data ?? '')
        break
      case 'insertLineBreak':
      case 'insertParagraph':
        this.pressKey('\r')
        break
      case 'deleteContentBackward':
      case 'deleteByCut':
        if (this.mode === 'line') this.backspace()
        break
    }
  }
}
