/**
 * A scrolling DOS text screen.
 *
 * The original writes to the BIOS console with Crt: characters flow, the line
 * wraps at the right edge and ClrScr wipes everything. That is all this
 * reproduces — there is no cursor addressing in the game, so none here either.
 *
 * It does not lay the text out. A printed line is one element and the browser
 * breaks it, which is the one thing about this screen a browser already knows
 * how to do better: `white-space: pre-wrap` keeps the author's own spacing and
 * still wraps, and the line breaking underneath it is Unicode's — kinsoku and
 * all — for every language rather than for the ones somebody thought to code.
 * It also means a wrapped line is still one line: it copies, and it is read
 * out, as the line the game printed rather than as the pieces it was drawn in.
 *
 * What is left here is the plumbing DOS had and CSS has not: colour runs, a
 * block cursor, a scrollback, and a way to say that a line belongs to one of
 * the drawn screens and must not be reflowed at all.
 */

/** The screen the game is written for: every message is authored to fit it. */
export const COLS = 80
export const ROWS = 25
const SCROLLBACK = 600

export class Terminal {
  readonly el: HTMLElement
  private line!: HTMLElement
  private lines: HTMLElement[] = []
  /** The span the text is flowing into; a new colour starts a new one. */
  private run: HTMLElement | null = null
  private color = 15
  private caret: HTMLElement | null = null
  private pinned = true

  constructor(el: HTMLElement) {
    this.el = el
    this.open()
    el.addEventListener('scroll', () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      this.pinned = gap < 4
    })
  }

  setColor(c: number): void {
    const next = c & 15
    if (next === this.color) return
    this.color = next
    this.run = null
  }

  getColor(): number {
    return this.color
  }

  write(text: string): void {
    if (!text) return
    if (!this.run) {
      this.run = document.createElement('span')
      this.run.style.color = `var(--c${this.color})`
      this.line.insertBefore(this.run, this.caret)
    }
    this.run.textContent += text
    this.scroll()
  }

  /**
   * Says the line being written belongs to a screen the author drew rather than
   * wrote — the title, the win animation, the end logo. Those keep their 80
   * columns and are scaled to the screen, because a reflowed picture is not a
   * smaller picture.
   */
  markArt(): void {
    this.line.classList.add('art')
  }

  newline(): void {
    this.open()
    this.scroll()
  }

  clear(): void {
    this.el.replaceChildren()
    this.lines = []
    this.pinned = true
    this.open()
    this.scroll()
  }

  /** Shows a blinking block cursor after the last written character. */
  showCaret(): void {
    if (this.caret) return
    this.caret = document.createElement('span')
    this.caret.className = 'caret'
    this.caret.textContent = ' '
    this.line.appendChild(this.caret)
    this.scroll()
  }

  hideCaret(): void {
    this.caret?.remove()
    this.caret = null
  }

  /** Erases the last character of the current line (line editing only). */
  backspace(): boolean {
    const showing = this.caret !== null
    this.hideCaret()
    let last = this.line.lastElementChild as HTMLElement | null
    while (last && !last.textContent) {
      last.remove()
      last = this.line.lastElementChild as HTMLElement | null
    }
    if (last) {
      // Pops a whole character rather than a UTF-16 unit, so an ideograph in a
      // player's name goes in one press.
      const chars = [...last.textContent!]
      chars.pop()
      last.textContent = chars.join('')
      if (!last.textContent) last.remove()
      // Whatever span was open is now gone, or is one another colour left.
      this.run = null
    }
    if (showing) this.showCaret()
    return last !== null
  }

  private open(): void {
    const line = document.createElement('div')
    line.className = 'line'
    this.el.appendChild(line)
    this.lines.push(line)
    while (this.lines.length > SCROLLBACK) this.lines.shift()!.remove()
    this.line = line
    this.run = null
    if (this.caret) line.appendChild(this.caret)
  }

  private scroll(): void {
    if (this.pinned) this.el.scrollTop = this.el.scrollHeight
  }
}
