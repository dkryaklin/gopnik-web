/** CP866 <-> Unicode, so saved games are byte-identical to the DOS ones. */
const HIGH =
  'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ '

const toUnicode = new Map<number, string>()
const toCp866 = new Map<string, number>()
for (let i = 0; i < HIGH.length; i++) {
  toUnicode.set(0x80 + i, HIGH[i])
  toCp866.set(HIGH[i], 0x80 + i)
}

export function encodeCp866(s: string): number[] {
  const out: number[] = []
  for (const ch of s) {
    const code = ch.codePointAt(0)!
    if (code < 0x80) out.push(code)
    else out.push(toCp866.get(ch) ?? 0x3f)
  }
  return out
}

export function decodeCp866(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += b < 0x80 ? String.fromCharCode(b) : (toUnicode.get(b) ?? '?')
  return s
}
