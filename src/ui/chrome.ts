/** The little browser controls that live outside the DOS screen. */

import { getLocale, onLocaleChange, setLocale, t, LOCALES, type Locale } from '../i18n'
import { Picker } from './picker'

export interface ChromeHost {
  /** Start the game over from the top. */
  onRestart: () => void
  /** A control is finished with, and the game should have the keyboard back. */
  onDone: () => void
}

export function mountChrome(root: HTMLElement, host: ChromeHost): void {
  const bar = document.createElement('div')
  bar.className = 'chrome'

  // Two languages fitted on a toggle; nine need a list.
  const lang = new Picker('lang',
    Object.entries(LOCALES).map(([value, label]) => ({ value, label, lang: value })))

  const fullscreen = document.createElement('button')
  const restart = document.createElement('button')

  const paint = () => {
    lang.value = getLocale()
    lang.setLabel(t('ui.language'))
    fullscreen.textContent = '⛶'
    fullscreen.title = t('ui.fullscreen')
    fullscreen.setAttribute('aria-label', t('ui.fullscreen'))
    restart.textContent = '⟳'
    restart.title = t('ui.restart')
    restart.setAttribute('aria-label', t('ui.restart'))
  }

  lang.onChange = (value) => setLocale(value as Locale)
  lang.onDone = host.onDone
  onLocaleChange(paint)

  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
    host.onDone()
  })

  restart.addEventListener('click', () => {
    if (confirm(t('ui.restartConfirm'))) host.onRestart()
    else host.onDone()
  })

  paint()
  bar.append(lang.el, fullscreen, restart)
  root.appendChild(bar)
}

/** Commands worth a button on a touch screen, in rough order of use. */
export const TOUCH_KEYS: readonly string[] = [
  'w', 'k', 'run', 'y', 'h', 'mh', 'kos', 's', 'sv', 'i', 'v', 'f',
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '0',
  'mar', 'bmar', 'rep', 'girl', 'pr', 'kl', 'trn',
  't', 'x', 'wes', 'p', 'r', 'hp', 'a', 'd',
  'name', 'help', 'e',
]
