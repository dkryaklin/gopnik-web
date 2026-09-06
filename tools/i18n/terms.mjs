#!/usr/bin/env node

/**
 * Finds words that should be the same everywhere and are not.
 *
 *     node tools/i18n/terms.mjs [lang...]
 *
 * The game says "den" in nine different lines and means the same place every
 * time. A translation that calls it a Treffpunkt in the menu and a Bude in the
 * den itself reads as two places, and nothing else here would catch it: every
 * line is a correct translation on its own.
 *
 * There is no way to align words across languages, and no need to. For each
 * term below, take the English lines that use it, look at the translations of
 * those same keys, and find what they have in common: if one word runs through
 * most of them the language is consistent, and if nothing does, the word has
 * drifted. What comes out is a shortlist to read, not a verdict.
 */

import { readCatalog, catalogPath, LANGS } from './translate.mjs'

/**
 * The recurring nouns, by the word the English uses. Grouping by the lines that
 * actually name the thing, not by key section: half of what sits under `gym.`
 * is prices and prompts that never say "gym", and expecting one word to run
 * through those only produces noise. "Club" is left out on purpose — in this
 * game it is both the place you dance in and the thing you hit people with.
 */
const TERMS = {
  den: /\bden\b/i,
  dealers: /\bdealers?\b/i,
  market: /\bmarket\b/i,
  gym: /\bgym\b/i,
  church: /\bchurch\b|\bpriest\b/i,
  crowd: /^Crowd:/,
  girl: /\bbird\b/i,
  beer: /\bbeer\b/i,
  joint: /\bjoints?\b/i,
  roubles: /\brbl\b|\broubles?\b/i,
  coolness: /\bcoolness\b/i,
  cop: /\bcops?\b/i,
  lads: /\blads\b/i,
  rector: /\brector\b/i,
  gopnik: /\bgopnik\b|\bgopota\b/i,
}

const CJK = /[぀-ヿ㐀-䶿一-鿿]/
const COLOUR = /\^(?:\d|\{\w+\})/g

/**
 * The candidate terms in one line: words for an alphabetic script, and runs of
 * two and three characters for Chinese and Japanese, which do not space words.
 */
function candidates(line) {
  const text = line.replace(COLOUR, '').replace(/\{\w+\}/g, ' ')
  const out = new Set()
  for (const word of text.match(/[\p{L}]{3,}/gu) ?? []) {
    if (!CJK.test(word)) out.add(word.toLowerCase())
  }
  // Kanji and katakana only: hiragana is grammar, and a candidate that ends in
  // a particle ("格が") reads as a different word from the same term next to a
  // different particle. One kanji can be a whole word, so runs start at one.
  for (const run of text.match(/[ァ-ヿ㐀-䶿一-鿿]+/g) ?? []) {
    for (let n = 1; n <= 4; n++) {
      for (let i = 0; i + n <= run.length; i++) out.add(run.slice(i, i + n))
    }
  }
  return out
}

/** Which lines a term covers: everything under a key prefix, or matching English. */
function keysFor(pattern, en) {
  return typeof pattern === 'string'
    ? [...en.keys()].filter((k) => k.startsWith(pattern))
    : [...en].filter(([, v]) => pattern.test(v)).map(([k]) => k)
}

const en = readCatalog(catalogPath('en'))
const langs = process.argv.slice(2).filter((a) => a in LANGS)
const targets = langs.length ? langs : Object.keys(LANGS)

for (const lang of targets) {
  const catalog = readCatalog(catalogPath(lang))
  // How many lines of the whole catalogue each word appears in.
  const everywhere = new Map()
  for (const line of catalog.values()) {
    for (const word of candidates(line)) everywhere.set(word, (everywhere.get(word) ?? 0) + 1)
  }
  const rows = []
  for (const [term, pattern] of Object.entries(TERMS)) {
    const keys = keysFor(pattern, en)
    if (keys.length < 3) continue

    // How many of the group's lines each candidate turns up in, weighed against
    // how common it is in the catalogue as a whole - otherwise "der" and "the"
    // win every group they appear in.
    const counts = new Map()
    for (const key of keys) {
      for (const word of candidates(catalog.get(key) ?? '')) {
        counts.set(word, (counts.get(word) ?? 0) + 1)
      }
    }
    const scored = [...counts]
      .filter(([, n]) => n >= 2)
      .map(([word, n]) => [word, n, n * Math.log(catalog.size / (everywhere.get(word) ?? 1))])
      .sort((a, b) => b[2] - a[2] || b[0].length - a[0].length)
    const [best, hits] = scored[0] ?? ['', 0]
    // A word counts as present if the line carries its stem, so a plural or an
    // inflected ending does not read as a different word.
    // Latin words inflect, so match on a stem; a CJK term does not, and cutting
    // it down would match half a word.
    const stem = CJK.test(best) ? best : best.slice(0, Math.max(3, best.length - 2))
    const missing = keys.filter((k) => !(catalog.get(k) ?? '').toLowerCase().includes(stem))
    rows.push({ term, keys, best, share: (keys.length - missing.length) / keys.length, missing })
  }

  rows.sort((a, b) => a.share - b.share)
  console.log(`\n${lang} — ${LANGS[lang].name}`)
  for (const { term, keys, best, share, missing } of rows) {
    const flag = share < 0.6 ? '<<' : '  '
    console.log(`  ${flag} ${term.padEnd(9)} ${String(Math.round(share * 100)).padStart(3)}% of ${String(keys.length).padStart(2)} lines say ${JSON.stringify(best)}`)
    if (share < 0.6) for (const k of missing.slice(0, 4)) console.log(`        ${k}: ${catalog.get(k)}`)
  }
}
