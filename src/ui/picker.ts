/**
 * The language picker.
 *
 * A native `<select>` is a hole in the screen: the browser draws the closed
 * control and the list it opens itself, in its own colours, and neither can be
 * made to look like the game around it. This is that control drawn in the
 * game's own palette — a DOS panel, a one-pixel rule, the row under the cursor
 * in inverse video — wired to the combobox pattern the platform one gets for
 * free: a button that says what is chosen, a listbox that is only in the tree
 * while it is open, and the arrow keys, Home, End, Escape and type-ahead.
 *
 * Focus never leaves the button. The row the keyboard is on is named by
 * `aria-activedescendant`, which is how a screen reader is told about a
 * selection that moves inside a control the user has not left.
 */

export interface Choice {
  value: string
  label: string
  /** The language the label is written in, when it is not the page's own. */
  lang?: string
}

/** How long a run of typed letters counts as one search. */
const TYPE_AHEAD = 700

export class Picker {
  readonly el: HTMLElement
  /** Called when the player picks something other than what was chosen. */
  onChange: (value: string) => void = () => {}
  /**
   * Called once the player is done with the control. The game takes every key
   * it is not typed into, so a picker that kept focus after a language was
   * chosen would be a player pressing keys at a game that no longer hears
   * them. Cancelling with Escape does not count: nothing was chosen, and a
   * keyboard should stay where it was.
   */
  onDone: () => void = () => {}

  private button: HTMLButtonElement
  private caption: HTMLSpanElement
  private list: HTMLUListElement
  private options: HTMLLIElement[] = []
  private choices: readonly Choice[]
  private chosen = 0
  private active = 0
  private open = false
  private search = ''
  private searchAt = 0

  constructor(id: string, choices: readonly Choice[]) {
    this.choices = choices

    this.el = document.createElement('div')
    this.el.className = 'pick'

    this.button = document.createElement('button')
    this.button.type = 'button'
    this.button.className = 'pick-open'
    this.button.setAttribute('role', 'combobox')
    this.button.setAttribute('aria-haspopup', 'listbox')
    this.button.setAttribute('aria-expanded', 'false')
    this.button.setAttribute('aria-controls', `${id}-list`)

    this.caption = document.createElement('span')
    const arrow = document.createElement('span')
    arrow.className = 'pick-arrow'
    arrow.textContent = '▼'
    arrow.setAttribute('aria-hidden', 'true')
    this.button.append(this.caption, arrow)

    this.list = document.createElement('ul')
    this.list.className = 'pick-list'
    this.list.id = `${id}-list`
    this.list.setAttribute('role', 'listbox')
    this.list.hidden = true

    choices.forEach((choice, index) => {
      const option = document.createElement('li')
      option.id = `${id}-opt-${choice.value}`
      option.setAttribute('role', 'option')
      option.setAttribute('aria-selected', 'false')
      // The chosen language is marked by a tick as well as by its colour, so
      // it is still the chosen one to somebody who cannot tell the two apart.
      const mark = document.createElement('span')
      mark.className = 'pick-mark'
      mark.setAttribute('aria-hidden', 'true')
      const text = document.createElement('span')
      text.textContent = choice.label
      // Each language is listed under its own name, so each name is read out
      // in the language it is written in rather than in the page's.
      if (choice.lang) text.lang = choice.lang
      option.append(mark, text)
      // Taking the press rather than the click keeps focus on the button, so
      // the list is never closed out from under the finger that opened it.
      option.addEventListener('pointerdown', (e) => e.preventDefault())
      option.addEventListener('click', () => {
        this.choose(index)
        this.close()
        this.onDone()
      })
      option.addEventListener('pointermove', () => this.point(index))
      this.list.appendChild(option)
      this.options.push(option)
    })

    this.button.addEventListener('click', () => {
      if (this.open) this.close()
      else this.show(this.chosen)
    })
    this.button.addEventListener('keydown', (e) => this.onKeyDown(e))
    this.el.addEventListener('focusout', (e) => {
      const next = e.relatedTarget as Node | null
      if (!next || !this.el.contains(next)) this.close()
    })
    // A press anywhere else puts the list away, exactly as the native one does.
    document.addEventListener('pointerdown', (e) => {
      if (this.open && !this.el.contains(e.target as Node)) this.close()
    }, true)

    this.el.append(this.button, this.list)
    this.paint()
  }

  get value(): string {
    return this.choices[this.chosen].value
  }

  set value(v: string) {
    const index = this.choices.findIndex((c) => c.value === v)
    if (index < 0 || index === this.chosen) return
    this.chosen = index
    this.paint()
  }

  /** The name the control is read out under, in the language now set. */
  setLabel(text: string): void {
    this.button.title = text
    this.button.setAttribute('aria-label', text)
    this.list.setAttribute('aria-label', text)
  }

  // ---- the list -----------------------------------------------------------

  private show(at: number): void {
    if (this.open) return
    this.open = true
    this.list.hidden = false
    this.button.setAttribute('aria-expanded', 'true')
    this.point(at)
  }

  private close(): void {
    if (!this.open) return
    this.open = false
    this.list.hidden = true
    this.button.setAttribute('aria-expanded', 'false')
    this.button.removeAttribute('aria-activedescendant')
    this.options[this.active]?.classList.remove('on')
  }

  private point(at: number): void {
    const index = Math.max(0, Math.min(this.options.length - 1, at))
    this.options[this.active]?.classList.remove('on')
    this.active = index
    const option = this.options[index]
    option.classList.add('on')
    this.button.setAttribute('aria-activedescendant', option.id)
    option.scrollIntoView({ block: 'nearest' })
  }

  private choose(index: number): void {
    if (index === this.chosen) return
    this.chosen = index
    this.paint()
    this.onChange(this.value)
  }

  private paint(): void {
    const choice = this.choices[this.chosen]
    this.caption.textContent = choice.label
    if (choice.lang) this.caption.lang = choice.lang
    this.options.forEach((option, index) => {
      const selected = index === this.chosen
      option.setAttribute('aria-selected', String(selected))
      option.firstElementChild!.textContent = selected ? '✓' : ''
    })
  }

  // ---- keys ---------------------------------------------------------------

  private onKeyDown(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey) return
    const last = this.options.length - 1

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!this.open) this.show(e.altKey ? this.chosen : Math.min(last, this.chosen + 1))
        else this.point(Math.min(last, this.active + 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        if (!this.open) this.show(e.altKey ? this.chosen : Math.max(0, this.chosen - 1))
        else this.point(Math.max(0, this.active - 1))
        return
      case 'Home':
      case 'PageUp':
        if (!this.open) return
        e.preventDefault()
        this.point(0)
        return
      case 'End':
      case 'PageDown':
        if (!this.open) return
        e.preventDefault()
        this.point(last)
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (!this.open) this.show(this.chosen)
        else {
          this.choose(this.active)
          this.close()
          this.onDone()
        }
        return
      case 'Escape':
        if (!this.open) return
        e.preventDefault()
        this.close()
        return
      case 'Tab':
        // Tab leaves the control, and leaving it takes what it was left on.
        if (this.open) {
          this.choose(this.active)
          this.close()
        }
        return
    }

    if (e.altKey || e.key.length !== 1) return
    e.preventDefault()
    this.type(e.key)
  }

  /**
   * Type-ahead. A language is listed under its own name, so `d` finds Deutsch
   * and `日` finds 日本語; the two-letter code works too, for a keyboard that
   * cannot reach the name.
   */
  private type(ch: string): void {
    const now = Date.now()
    this.search = now - this.searchAt > TYPE_AHEAD ? ch : this.search + ch
    this.searchAt = now
    const needle = this.search.toLowerCase()
    const from = this.open ? this.active : this.chosen
    // A second letter narrows the name the search is already on; a fresh one
    // moves off it, so holding a key walks the languages that start with it.
    const first = this.search.length > 1 ? 0 : 1
    for (let step = first; step < first + this.choices.length; step++) {
      const index = (from + step) % this.choices.length
      const choice = this.choices[index]
      if (choice.label.toLowerCase().startsWith(needle) ||
          choice.value.startsWith(needle)) {
        if (this.open) this.point(index)
        else this.choose(index)
        return
      }
    }
  }
}
