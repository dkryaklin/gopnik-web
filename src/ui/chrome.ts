/** The little browser controls that live outside the DOS screen. */

import { getLocale, setLocale, t, LOCALES, type Locale } from '../i18n'

export function mountChrome(root: HTMLElement, onRestart: () => void): void {
  const bar = document.createElement('div')
  bar.className = 'chrome'

  // Two languages fitted on a toggle; nine need a list.
  const lang = document.createElement('select')
  lang.className = 'lang'
  for (const [code, name] of Object.entries(LOCALES)) {
    const option = document.createElement('option')
    option.value = code
    option.textContent = name
    lang.appendChild(option)
  }

  const fullscreen = document.createElement('button')
  const restart = document.createElement('button')

  const paint = () => {
    lang.value = getLocale()
    lang.title = t('ui.language')
    lang.setAttribute('aria-label', t('ui.language'))
    fullscreen.textContent = '⛶'
    fullscreen.title = t('ui.fullscreen')
    fullscreen.setAttribute('aria-label', t('ui.fullscreen'))
    restart.textContent = '⟳'
    restart.title = t('ui.restart')
    restart.setAttribute('aria-label', t('ui.restart'))
  }

  lang.addEventListener('change', () => {
    setLocale(lang.value as Locale)
    paint()
  })

  fullscreen.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  })

  restart.addEventListener('click', () => {
    if (confirm(t('ui.restartConfirm'))) onRestart()
  })

  paint()
  bar.append(lang, fullscreen, restart)
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
