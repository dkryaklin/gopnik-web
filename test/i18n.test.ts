import { describe, it, expect } from 'vitest'
import ru from '../src/i18n/ru'
import en from '../src/i18n/en'
import zh from '../src/i18n/zh'
import ja from '../src/i18n/ja'
import es from '../src/i18n/es'
import pt from '../src/i18n/pt'
import fr from '../src/i18n/fr'
import de from '../src/i18n/de'
import id from '../src/i18n/id'
import { LOCALES, type Locale } from '../src/i18n'
import { COLS } from '../src/ui/terminal'
import { cellWidth, textWidth } from '../src/i18n/width'

/**
 * A catalogue is not prose: `io.build` fills the `#` from a list of numbers in
 * order and the console reads the `^N` codes as it draws, so a translation that
 * loses one prints the wrong number or the wrong colour and nothing anywhere
 * complains. Every language is checked against the English line, which is the
 * one they were all translated from.
 */

const catalogs: Record<Locale, Record<string, string>> = { ru, en, zh, ja, es, pt, fr, de, id }
// ru is the original and en was written against it by hand; the rest were
// translated from the pair of them and are held to the English line.
const translated = Object.entries(catalogs).filter(([locale]) => locale !== 'ru' && locale !== 'en')
const original = catalogs.ru
const english = catalogs.en

const COLOUR = /\^(?:\d|\{\w+\})/g
const colours = (text: string) => (text.match(COLOUR) ?? []).join('')
const slots = (text: string) => (text.match(/#/g) ?? []).length
// `^{c}` is a colour the game picks, not a value substituted into the text.
const vars = (text: string) =>
  (text.match(/\{\w+\}/g) ?? []).filter((v) => !/^\{c\d*\}$/.test(v)).sort().join(',')
const width = (text: string) => textWidth(text.replace(COLOUR, ''))

describe('the 80 columns a message has', () => {
  it('counts one cell for everything the code page can draw', () => {
    for (const ch of 'Az0 ЖщЁ─┼█áñÜß¿«') {
      expect(cellWidth(ch.codePointAt(0)!)).toBe(1)
    }
  })

  it('counts two cells for ideographs, kana and fullwidth punctuation', () => {
    for (const ch of '你好中国駅ゲーム終わり。！') {
      expect(cellWidth(ch.codePointAt(0)!)).toBe(2)
    }
  })

  it('measures a line in cells, not in characters', () => {
    expect(textWidth('HP 34/60')).toBe(8)
    expect('你好'.length).toBe(2)
    expect(textWidth('你好')).toBe(4)
    expect(textWidth('HP 你好')).toBe(7)
  })
})

describe('the message catalogues', () => {
  it('covers every language in the picker', () => {
    expect(Object.keys(catalogs).sort()).toEqual(Object.keys(LOCALES).sort())
  })

  it('answers in English every key the original prints', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(original).sort())
    for (const [key, line] of Object.entries(original)) {
      expect({ key, slots: slots(english[key]) }).toEqual({ key, slots: slots(line) })
      expect({ key, vars: vars(english[key]) }).toEqual({ key, vars: vars(line) })
    }
  })

  it.each(translated)('%s has exactly the keys of the original', (_locale, catalog) => {
    expect(Object.keys(catalog).sort()).toEqual(Object.keys(original).sort())
  })

  it.each(translated)('%s keeps the arguments and colours of the English line', (_locale, catalog) => {
    for (const [key, line] of Object.entries(english)) {
      // The art is Cyrillic in every language; Russian alone glosses nothing.
      if (!line.trim()) continue
      if (catalog[key] === undefined) continue   // reported by the key test above
      expect({ key, slots: slots(catalog[key]) }).toEqual({ key, slots: slots(line) })
      expect({ key, colours: colours(catalog[key]) }).toEqual({ key, colours: colours(line) })
      expect({ key, vars: vars(catalog[key]) }).toEqual({ key, vars: vars(line) })
    }
  })

  it.each(translated)('%s calls the player what he chose to be', (_locale, catalog) => {
    // showStats prints typeName(classCode) and classCode is the menu choice + 3,
    // so picking intro.class2 gets you called type.5. class0 is exempt: the
    // author misspelled type.3 and both ru and en keep the slip.
    for (const choice of [1, 2, 3]) {
      const menu = catalog[`intro.class${choice}`].replace(/^\d-/, '').trim()
      expect({ choice, menu }).toEqual({ choice, menu: catalog[`type.${choice + 3}`].trim() })
    }
  })

  it.each(translated)('%s keeps its four ranks four different people', (_locale, catalog) => {
    // The ladder climbs through ranks - scum, dude, lad - and the gopnik of
    // type.5 is a fourth kind of person again. Sharing a word between two of
    // them means the top of the ladder promotes you to what you already were.
    const ranks = ['title.2', 'title.10', 'title.21', 'type.5'].map((k) => catalog[k])
    expect(new Set(ranks).size).toBe(ranks.length)
  })

  it.each(translated)('%s climbs a ladder of 43 distinct titles', (_locale, catalog) => {
    // title.0 to title.42 are the rungs of the player's reputation, one per
    // level. Two rungs reading the same means a level up that shows nothing.
    const titles = [...Array(43).keys()].map((i) => catalog[`title.${i}`])
    expect(new Set(titles).size).toBe(titles.length)
  })

  it.each(translated)('%s stays inside the screen', (_locale, catalog) => {
    for (const [key, line] of Object.entries(english)) {
      if (catalog[key] === undefined) continue
      // A few of the author's own lines already run past column 80 and wrap.
      // A translation may be as long as the line it came from, no longer.
      const budget = Math.max(COLS, width(line))
      expect({ key, width: Math.min(width(catalog[key]), budget) })
        .toEqual({ key, width: width(catalog[key]) })
    }
  })
})
