import './styles.css'
import { Terminal, COLS, ROWS } from './ui/terminal'
import { DosConsole } from './ui/console'
import { mountChrome, TOUCH_KEYS } from './ui/chrome'
import { bindConsole } from './engine/io'
import { HaltGame } from './engine/state'
import { run } from './engine/game'
import { getLocale, onLocaleChange, t } from './i18n'

const app = document.getElementById('app')!
document.documentElement.lang = getLocale()

const stage = document.createElement('div')
stage.className = 'stage'
const screen = document.createElement('div')
screen.className = 'screen'
screen.setAttribute('role', 'log')
screen.setAttribute('aria-live', 'polite')

const hint = document.createElement('div')
hint.className = 'hint'
stage.append(screen, hint)

const sink = document.createElement('input')
sink.className = 'sink'
sink.type = 'text'
sink.autocapitalize = 'off'
sink.autocomplete = 'off'
sink.spellcheck = false
sink.setAttribute('aria-hidden', 'true')
sink.tabIndex = -1

const bar = document.createElement('div')
bar.className = 'bar'
const coarse = window.matchMedia('(pointer: coarse)').matches
if (!coarse) bar.classList.add('off')

mountChrome(app, () => location.reload())
app.append(stage, bar, sink)

const term = new Terminal(screen)
const con = new DosConsole(term, sink, {
  onModeChange: (mode) => {
    hint.classList.toggle('on', coarse && mode === 'key')
  },
})
bindConsole(con)

for (const key of TOUCH_KEYS) {
  const button = document.createElement('button')
  button.className = key.length > 1 ? 'key wide' : 'key'
  button.type = 'button'
  button.textContent = key
  button.addEventListener('click', (e) => {
    e.preventDefault()
    con.pressCommand(key)
    con.focus()
  })
  bar.appendChild(button)
}
const enter = document.createElement('button')
enter.className = 'key'
enter.type = 'button'
enter.textContent = '↵'
enter.setAttribute('aria-label', 'Enter')
enter.addEventListener('click', (e) => {
  e.preventDefault()
  con.pressKey('\r')
  con.focus()
})
bar.appendChild(enter)

stage.addEventListener('pointerdown', () => {
  if (con.getMode() === 'key') con.pressKey(' ')
  con.focus()
})

const paintHint = () => { hint.textContent = t('ui.tapToContinue') }
paintHint()
onLocaleChange(paintHint)

/** The cell the font was drawn on: 8x16, so 16px of type is one cell tall. */
const BASE_FONT = 16

/**
 * Fits the screen to the view.
 *
 * A DOS text cell is twice as tall as it is wide, so everything follows from
 * one number: how wide the font draws a character. The screen wants to be the
 * author's 80 columns, but a phone cannot draw 80 of them at a size anybody
 * would read, so it takes as many whole columns as fit at 16px and the terminal
 * lays the text out again to that width. Where 80 do fit, the cell grows in
 * steps instead, until either the columns or the 25 rows would run out.
 *
 * The steps are not arbitrary. The glyphs are pixel rectangles and the
 * box-drawing strokes are one pixel thick, so a glyph pixel has to cover a
 * whole number of device pixels or the strokes fall between the display's own:
 * lines come out uneven and the thin ones fade. That leaves one cell size per
 * whole number, and the largest that still holds the screen is the one to use.
 */
function fit(): void {
  const probe = document.createElement('span')
  probe.style.cssText =
    `position:absolute;visibility:hidden;white-space:pre;font-size:${BASE_FONT}px`
  probe.textContent = '0'.repeat(100)
  screen.appendChild(probe)
  const unit = probe.getBoundingClientRect().width / 100
  probe.remove()

  const room = stage.getBoundingClientRect()
  if (!unit || !room.width || !room.height) return

  const dpr = window.devicePixelRatio || 1
  const step = 1 / ((unit / 8) * dpr)   // the smallest scale that keeps glyph pixels whole
  // 80 columns if they fit at 16px, and as many as do if they do not.
  const want = Math.min(COLS, Math.floor(room.width / unit))

  interface Grid { scale: number; cw: number; ch: number; cols: number; rows: number }
  let full: Grid | undefined    // the largest that keeps both the columns and the rows
  let base: Grid | undefined    // the largest that keeps the columns, up to 16px type
  let any: Grid | undefined     // the largest that keeps the columns at all
  for (let n = 1; n <= 128; n++) {
    const scale = n * step
    const cw = unit * scale
    const ch = 2 * unit * scale
    const cols = Math.floor(room.width / cw)
    if (cols < want) break
    const grid: Grid = { scale, cw, ch, cols: Math.min(cols, COLS), rows: Math.floor(room.height / ch) }
    any = grid
    if (scale <= 1) base = grid
    if (grid.rows >= ROWS) full = grid
  }
  // Losing a row or two is worth less than dropping below the size the font was
  // drawn at, so a short view keeps its 16px and shows what rows it can.
  const grid = full && full.scale >= 1 ? full : (base ?? full ?? any)
  if (!grid) return

  const root = document.documentElement.style
  root.setProperty('--cell-w', `${grid.cw}px`)
  root.setProperty('--cell-h', `${grid.ch}px`)
  root.setProperty('--font', `${BASE_FONT * grid.scale}px`)
  // A drawn screen holds its 80 columns; this is how much of them there is room
  // for. The lines that are not drawn need nothing: the browser reflows them.
  root.setProperty('--art-scale', String(Math.min(1, grid.cols / COLS)))
  screen.style.width = `${grid.cols * grid.cw}px`
  screen.style.height = `${Math.max(1, grid.rows) * grid.ch}px`

  // Centring can still leave the screen on half a device pixel, which smears
  // the whole grid again; nudge it back onto the device's pixel grid.
  screen.style.transform = ''
  const placed = screen.getBoundingClientRect()
  const dx = (Math.round(placed.left * dpr) - placed.left * dpr) / dpr
  const dy = (Math.round(placed.top * dpr) - placed.top * dpr) / dpr
  if (dx || dy) screen.style.transform = `translate(${dx}px, ${dy}px)`
}

const view = window.visualViewport
/** The keyboard takes room off the screen rather than covering the bar. */
function resize(): void {
  if (view) app.style.height = `${view.height}px`
  fit()
}

window.addEventListener('resize', resize)
window.addEventListener('orientationchange', resize)
view?.addEventListener('resize', resize)
resize()
void (async () => {
  try {
    await document.fonts?.load(`${BASE_FONT}px "DOS"`)
    await document.fonts?.ready
  } catch { /* no font loading API */ }
  fit()
})()

async function boot(): Promise<void> {
  for (;;) {
    try {
      await run()
    } catch (error) {
      if (!(error instanceof HaltGame)) throw error
      // The DOS program has exited; starting it again is one key away.
    }
  }
}

con.focus()
void boot()
