#!/usr/bin/env node

/**
 * Fills in a message catalogue with Gemini.
 *
 * Every call carries the whole Russian original and the whole English
 * rendering, because this text only makes sense as a whole: the register is the
 * point, and a line like "^4Чмо!" cannot be translated out of context. The keys
 * to do are appended at the end in batches, so the two catalogues stay a
 * constant prefix and the model's context cache keeps paying for itself.
 *
 *     GOOGLE_GENERATIVE_AI_API_KEY=... node tools/i18n/translate.mjs de
 *     node tools/i18n/translate.mjs all --batch 40
 *     node tools/i18n/translate.mjs fr --keys fight.hit,fight.miss
 *
 * Work is saved after every batch, so an interrupted run picks up where it
 * stopped: a key that is already in src/i18n/<lang>.ts is left alone unless
 * --force or --keys names it.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const I18N = join(ROOT, 'src/i18n')
const PROMPT = join(ROOT, 'tools/i18n/prompt.md')
const COLS = 80
// The model the other project translates with, and the one that actually
// answers: gemini-3.8-flash turns away a 70k-character prompt with 503 "high
// demand" every time. --model overrides it.
const MODEL = 'gemini-3.1-flash-lite'

/**
 * The languages, with the note each one gets in its prompt. The note is only
 * what a translator could not guess: which variety, and where that language's
 * own street register lives.
 */
export const LANGS = {
  zh: {
    name: 'Chinese (Simplified)',
    header: 'Simplified Chinese',
    note: 'Mainland Simplified Chinese, the register of 贴吧/网吧 talk rather than '
      + 'anything literary. A gopnik is a 小混混; the game is 《小混混》. Remember that '
      + 'every character costs two of the 80 columns, so lines have to be half as '
      + 'long — which suits Chinese, since it says the same thing in far fewer.\n\n'
      + 'The money is Russian: 卢布, every time. Not 元 and not 块 — the game is '
      + 'set in Novosibirsk and the player is buying beer with roubles.',
  },
  ja: {
    name: 'Japanese',
    header: 'Japanese',
    note: 'The voice is ヤンキー/不良: rough male speech, 〜だろ, 〜やがる, テメー, '
      + 'ぶっ殺す. Katakana for the loan words. Every full-width character costs two '
      + 'of the 80 columns, so keep lines short and lean on kanji.\n\n'
      + 'Two words carry the game and must not be swapped for each other: the '
      + 'gopnik of type.5, the title of the game, is ヤンキー; the lad of '
      + 'intro.class0, of type.3 and of every rung of the title ladder is 不良. '
      + 'Rung 21 is exactly 不良 and every rung above it is 不良 with different '
      + 'words around it. The rank below it, the dude of rungs 9-17, needs a word '
      + 'of its own that is not 不良 and not ヤンキー — 兄ちゃん, 若造 and チンピラ '
      + 'are all free, and rung 10 is that word bare.\n\n'
      + 'Four more words that must not drift, because the game says each of them '
      + 'in a dozen different lines and means the same thing every time: a cop is '
      + 'ポリ (never 警官 or サツ), the dealers are 売人 (never 闇屋), the '
      + 'coolness stat is 格 (never 評価), and the gopota out on the streets are '
      + 'ヤンキー — 不良 is the lad of the title ladder and nobody else.\n\n'
      + 'The money is Russian: ルーブル, every time, never 円. The game is set in '
      + 'Novosibirsk and the player is buying beer with roubles.',
  },
  es: {
    name: 'Spanish',
    header: 'Spanish',
    note: 'Peninsular Spanish, the street register: macarra, chungo, hostia, tío, '
      + 'gilipollas. Keep ¡ and ¿ — the font has them.\n\n'
      + 'The money is Russian: rublos, every time a price or an amount is '
      + 'named — never your own currency and never a slang unit that implies '
      + 'one. Slang for money in general stays slang.',
  },
  pt: {
    name: 'Portuguese (Brazilian)',
    header: 'Brazilian Portuguese',
    note: 'Brazilian Portuguese, periferia register: mano, treta, porrada, otário, '
      + 'moleque. Not European Portuguese.\n\n'
      + 'The money is Russian: rublos, every time a price or an amount is '
      + 'named — never your own currency and never a slang unit that implies '
      + 'one. Slang for money in general stays slang.',
  },
  fr: {
    name: 'French',
    header: 'French',
    note: 'The banlieue register: caillera, meuf, thune, bâtard, foutre sur la '
      + 'gueule. Verlan where it is natural. The font has no œ ligature — write "oe".\n\n'
      + 'The money is Russian: roubles, every time a price or an amount is '
      + 'named — never your own currency and never a slang unit that implies '
      + 'one. Slang for money in general stays slang.',
  },
  de: {
    name: 'German',
    header: 'German',
    note: 'Prollo/Assi German: Alter, Digga, Fresse, abziehen, verkloppen. German '
      + 'runs long and the screen is 80 columns wide, so cut hard rather than '
      + 'translate every word.\n\n'
      + 'The four ranks are four different people and must not share a word: the '
      + 'gopnik of type.5, the title of the game, is Prollo; the lad of '
      + 'intro.class0, of type.3 and of the title ladder from rung 18 up is Typ; '
      + 'the dude of rungs 9-17 needs a word of its own — Kerl, Bursche and '
      + 'Kumpel are all free, and rung 10 is that word bare.',
  },
  id: {
    name: 'Indonesian',
    header: 'Indonesian',
    note: 'Jakarta street Indonesian, not the formal register: preman, gue/lo, '
      + 'bacot, hajar, anjir. A gopnik is a preman.\n\n'
      + 'The four ranks are four different people and must not share a word: the '
      + 'gopnik of type.5, the title of the game, is Preman; the lad of '
      + 'intro.class0, of type.3 and of the title ladder from rung 18 up is Anak '
      + 'Gaul; the dude of rungs 9-17 needs a word of its own — Bocah, Cowok and '
      + 'Bujang are all free, and rung 10 is that word bare.\n\n'
      + 'The money is Russian: rubel, every time a price or an amount is '
      + 'named — never your own currency and never a slang unit that implies '
      + 'one. Slang for money in general stays slang.',
  },
}

// ---------------------------------------------------------------------------
// The catalogue files
//
// Every catalogue is one key per line, so it is read and written a line at a
// time: the file keeps its section comments and its key order, and a run only
// ever rewrites the string literals.

const KEY_LINE = /^(\s*)'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',\s*$/

function unquote(literal) {
  return literal.replace(/\\(.)/g, (_, c) => (c === 'n' ? '\n' : c === 't' ? '\t' : c))
}

function quote(text) {
  return text.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
}

export function catalogPath(lang) {
  return join(I18N, `${lang}.ts`)
}

/** Reads a catalogue as a key -> string map, in file order. */
export function readCatalog(path) {
  const out = new Map()
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = KEY_LINE.exec(line)
    if (m) out.set(unquote(m[2]), unquote(m[3]))
  }
  return out
}

/**
 * Writes a catalogue by re-typing en.ts with other strings in it, which is what
 * keeps the section comments, the key order and the trailing `as const`.
 */
export function writeCatalog(lang, translated) {
  const lines = readFileSync(catalogPath('en'), 'utf8').split('\n')
  const end = lines.indexOf(' */')
  const header = [
    '/**',
    ` * ${LANGS[lang].header} rendering of the original text. Same keys, the same`,
    ' * `^N` colour codes and the same `#` integer slots in the same order, so the',
    ' * engine cannot tell the difference.',
    ' *',
    ' * Written by tools/i18n/translate.mjs from ru.ts and en.ts; the register it',
    ' * aims at is spelled out in tools/i18n/prompt.md. Hand edits survive: the tool',
    ' * only fills in keys that are missing.',
    ' */',
  ]
  const body = lines.slice(end + 1).map((line) => {
    const m = KEY_LINE.exec(line)
    if (!m) return line
    const key = unquote(m[2])
    if (!translated.has(key)) return null
    return `${m[1]}'${m[2]}': '${quote(translated.get(key))}',`
  })
  writeFileSync(catalogPath(lang), [...header, ...body.filter((l) => l !== null)].join('\n'))
}

// ---------------------------------------------------------------------------
// What the screen can take
//
// The console eats the colour codes before anything is drawn, so they cost no
// columns; an ideograph costs two. This is the same arithmetic as cellWidth()
// in src/i18n/width.ts, kept here so the tool has no build step.

const COLOUR = /\^(?:\d|\{\w+\})/g

function cellWidth(code) {
  const wide =
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)
  return wide ? 2 : 1
}

export function textWidth(text) {
  let width = 0
  for (const ch of text.replace(COLOUR, '')) width += cellWidth(ch.codePointAt(0))
  return width
}

/**
 * Re-centres a line the author centred by hand.
 *
 * The original pads with spaces to put a line where it looks right, which is
 * rarely the exact middle of the screen. A translation is a different length,
 * so the padding is recomputed to hold the same centre point rather than
 * trusted to the model, which cannot count columns.
 */
export function recentre(english, text) {
  const pad = /^ +/.exec(english)
  if (!pad || pad[0].length < 2) return text
  const centre = pad[0].length + (textWidth(english) - pad[0].length) / 2
  const body = text.replace(/^\s+/, '')
  const left = Math.max(0, Math.round(centre - textWidth(body) / 2))
  return ' '.repeat(Math.min(left, Math.max(0, COLS - textWidth(body)))) + body
}

// ---------------------------------------------------------------------------
// Checking a batch
//
// io.build() fills `#` from a list of numbers and `{name}` from a map, so a
// dropped `#` shifts every number after it and a dropped `{name}` prints the
// placeholder. Neither shows up as an error anywhere: the game just prints
// nonsense. So the tool refuses the line and asks again.

const tokens = (text) => (text.match(COLOUR) ?? []).join('')
const slots = (text) => (text.match(/#/g) ?? []).length
const vars = (text) => (text.match(/\{\w+\}/g) ?? []).filter((v) => !/^\{c\d*\}$/.test(v)).sort().join(',')

export function problems(english, text) {
  const out = []
  if (typeof text !== 'string') return ['not a string']
  if (!english.trim()) return text.trim() ? ['must be empty, as the English is'] : []
  if (!text.trim()) out.push('empty')
  if (slots(text) !== slots(english)) out.push(`has ${slots(text)} "#" slots, needs ${slots(english)}`)
  if (tokens(text) !== tokens(english)) out.push(`colour codes are "${tokens(text)}", need "${tokens(english)}"`)
  if (vars(text) !== vars(english)) out.push(`placeholders are "${vars(text)}", need "${vars(english)}"`)
  if (english.endsWith(' ') && !text.endsWith(' ')) out.push('must end with a space, as the English does')
  // A handful of the author's own lines run past column 80 and wrap; a
  // translation is allowed to be as long as its English line, no longer.
  const budget = Math.max(COLS, textWidth(english))
  const width = textWidth(recentre(english, text))
  if (width > budget) out.push(`is ${width} columns wide, the most it may be is ${budget}`)
  return out
}

// ---------------------------------------------------------------------------
// Gemini

const API = 'https://generativelanguage.googleapis.com/v1beta/models'

/**
 * The shape the answer has to come back in.
 *
 * Without it the model mirrors the batch instead of answering it: the batch is
 * a JSON array of {key, ru, en}, so it returns that same array with the French
 * written into the `en` field, and not one key of the batch is found. Asking
 * for the shape in words was not enough; the schema settles it.
 */
const ANSWER = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: { key: { type: 'STRING' }, text: { type: 'STRING' } },
    required: ['key', 'text'],
    propertyOrdering: ['key', 'text'],
  },
}

/** Reads an answer as a key -> line map, whichever way round it came. */
function readAnswer(raw) {
  const out = new Map()
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (item && typeof item.key === 'string') {
        const line = item.text ?? item.translation ?? item.value ?? item.en
        if (typeof line === 'string') out.set(item.key, line)
      }
    }
  } else if (parsed && typeof parsed === 'object') {
    for (const [key, line] of Object.entries(parsed)) {
      if (typeof line === 'string') out.set(key, line)
    }
  }
  return out
}

/**
 * The game is 650 lines of thugs swearing at each other, which the default
 * filters take badly: an answer now and then comes back empty with
 * PROHIBITED_CONTENT. Only the top threshold is lifted, so the model still
 * refuses anything genuinely severe.
 */
const SAFETY = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
].map((category) => ({ category, threshold: 'BLOCK_ONLY_HIGH' }))

async function generate(model, key, system, prompt) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API}/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        safetySettings: SAFETY,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json',
          responseSchema: ANSWER,
        },
      }),
    })
    if (res.ok) {
      const body = await res.json()
      const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
      if (text.trim()) return text
      throw new Error(`empty answer (${body.candidates?.[0]?.finishReason ?? 'no candidate'})`)
    }
    const detail = await res.text()
    // 429 is the free tier's per-minute quota and 503 is the model being busy;
    // both clear on their own, so wait rather than lose the batch.
    if ((res.status === 429 || res.status >= 500) && attempt <= 5) {
      const wait = 15 * attempt
      console.log(`    ${res.status} from the API, waiting ${wait}s`)
      await new Promise((r) => setTimeout(r, wait * 1000))
      continue
    }
    throw new Error(`${res.status} ${detail.slice(0, 300)}`)
  }
}

// ---------------------------------------------------------------------------
// A run

function catalogText(path) {
  return [...readCatalog(path)].map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join('\n')
}

export async function translate(lang, { batchSize, model, apiKey, only, force }) {
  const ru = readCatalog(catalogPath('ru'))
  const en = readCatalog(catalogPath('en'))
  const system = readFileSync(PROMPT, 'utf8')
  // The constant half of the prompt, first, so the cache can hold it.
  const context = [
    `# Target language: ${LANGS[lang].name}`,
    '',
    LANGS[lang].note,
    '',
    '## Russian original',
    '',
    catalogText(catalogPath('ru')),
    '',
    '## English rendering',
    '',
    catalogText(catalogPath('en')),
    '',
  ].join('\n')

  const done = existsSync(catalogPath(lang)) ? readCatalog(catalogPath(lang)) : new Map()
  const wanted = [...en.keys()].filter((k) => (only ? only.has(k) : force || !done.has(k)))
  console.log(`\n${lang}: ${done.size} of ${en.size} already translated, ${wanted.length} to do`)

  // A key being redone must not also appear as settled, or the model reads its
  // own old answer as the established wording and hands it straight back.
  const redoing = new Set(wanted)

  let failed = 0
  for (let i = 0; i < wanted.length; i += batchSize) {
    const batch = wanted.slice(i, i + batchSize)
    const items = batch.map((k) => ({ key: k, ru: ru.get(k), en: en.get(k) }))
    process.stdout.write(`  ${lang} ${i + 1}-${i + batch.length} of ${wanted.length}`)

    let outstanding = items
    let complaints = ''
    for (let attempt = 1; attempt <= 3 && outstanding.length; attempt++) {
      const translatedSoFar = [...done]
        .filter(([k]) => en.has(k) && !redoing.has(k))
        .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
        .join('\n')
      const prompt = [
        context,
        translatedSoFar ? `## Already translated\n\n${translatedSoFar}\n` : '',
        complaints,
        '## Batch',
        '',
        JSON.stringify(outstanding, null, 1),
      ].join('\n')

      let answer
      try {
        answer = readAnswer(await generate(model, apiKey, system, prompt))
      } catch (err) {
        process.stdout.write(`\n    attempt ${attempt} failed: ${err.message}\n`)
        continue
      }

      const rejected = []
      for (const item of outstanding) {
        const line = answer.get(item.key)
        if (line === undefined) {
          rejected.push({ ...item, why: 'missing from the answer' })
          continue
        }
        const why = problems(item.en, line)
        if (why.length) rejected.push({ ...item, why: why.join('; '), was: line })
        else done.set(item.key, recentre(item.en, line))
      }
      outstanding = rejected
      complaints = rejected.length
        ? '## Fix these\n\nYour last answer was rejected for these keys. Redo them:\n\n'
          + rejected.map((r) => `- ${r.key}: you wrote ${JSON.stringify(r.was ?? '')} — it ${r.why}.`).join('\n')
          + '\n'
        : ''
      if (rejected.length) process.stdout.write(`\n    ${rejected.length} rejected, asking again`)
    }

    for (const item of outstanding) {
      console.log(`\n    ! ${item.key}: gave up (${item.why ?? 'the model never answered'})`)
      failed++
    }
    // Written after every batch: a run can be stopped and resumed.
    writeCatalog(lang, new Map([...en.keys()].filter((k) => done.has(k)).map((k) => [k, done.get(k)])))
    process.stdout.write('\n')
  }

  const missing = [...en.keys()].filter((k) => !done.has(k))
  console.log(`${lang}: ${en.size - missing.length}/${en.size} done`
    + (missing.length ? `, ${missing.length} missing` : '')
    + (failed ? `, ${failed} gave up this run` : ''))
  return missing.length
}

// ---------------------------------------------------------------------------

// The tool is also its own library: importing it gets the catalogue reader and
// the checks without starting a run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2)
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`)
    return i === -1 ? fallback : argv[i + 1]
  }
  const targets = argv[0] === 'all' ? Object.keys(LANGS) : argv.filter((a) => a in LANGS)

  if (!targets.length) {
    console.error(`Usage: node tools/i18n/translate.mjs <${Object.keys(LANGS).join('|')}|all>`
      + ' [--batch N] [--model M] [--keys a,b] [--force]')
    process.exit(1)
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) {
    console.error('GOOGLE_GENERATIVE_AI_API_KEY is not set')
    process.exit(1)
  }

  const options = {
    batchSize: Number(flag('batch', 40)),
    model: flag('model', MODEL),
    only: argv.includes('--keys') ? new Set(flag('keys', '').split(',')) : null,
    force: argv.includes('--force'),
    apiKey,
  }

  let incomplete = 0
  for (const lang of targets) incomplete += await translate(lang, options)
  process.exit(incomplete ? 1 : 0)
}
