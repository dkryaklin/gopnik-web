/**
 * How wide a message is on the screen.
 *
 * Nothing draws with this — the browser lays the text out and measures its own
 * glyphs. It is the authoring rule: the screen the game was written for is 80
 * columns, and a translation that runs past them wraps where the author's line
 * did not. `test/i18n.test.ts` holds every catalogue to it and
 * `tools/i18n/translate.mjs` hands a line back to the model when it fails.
 */

/**
 * How many cells a character occupies.
 *
 * DOS CJK systems - UCDOS, DOS/V, PC-98 - drew an ideograph in a 16x16 cell,
 * exactly two of the 8x16 cells everything else uses, and counted it as two of
 * the 80 columns. A browser does the same with a fullwidth glyph, which is one
 * em against the half-em the DOS face advances.
 */
export function cellWidth(code: number): 1 | 2 {
  const wide =
    (code >= 0x1100 && code <= 0x115f) ||   // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) ||   // radicals, Kangxi, CJK punctuation
    (code >= 0x3041 && code <= 0x33ff) ||   // kana, Bopomofo, enclosed CJK
    (code >= 0x3400 && code <= 0x4dbf) ||   // CJK extension A
    (code >= 0x4e00 && code <= 0x9fff) ||   // CJK unified ideographs
    (code >= 0xa000 && code <= 0xa4cf) ||   // Yi
    (code >= 0xac00 && code <= 0xd7a3) ||   // Hangul syllables
    (code >= 0xf900 && code <= 0xfaff) ||   // CJK compatibility ideographs
    (code >= 0xfe30 && code <= 0xfe6f) ||   // CJK compatibility forms
    (code >= 0xff00 && code <= 0xff60) ||   // fullwidth forms
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x20000 && code <= 0x3fffd)    // CJK extensions B and beyond
  return wide ? 2 : 1
}

/** The cells a whole string occupies, which is not its length once CJK is in it. */
export function textWidth(text: string): number {
  let width = 0
  for (const ch of text) width += cellWidth(ch.codePointAt(0)!)
  return width
}
