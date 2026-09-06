/** Banner, end screen, win animation and the two stats screens. */

import { P, E, W, HaltGame } from './state'
import { WEIGHTS, MAX_LEVEL, LAST_TITLE } from './tables'
import { BANNER, END_LOGO, WIN_LETTERS } from './art'
import { random, div } from './rng'
import { endSession } from './save'
import * as io from './io'
import type { MsgKey, Ref, Value } from '../i18n'

/**
 * A line under the art saying what it reads.
 *
 * The art is Cyrillic drawn out of box characters, and it stays that way in
 * every language: it is the logo, not a string. So the other languages get a
 * gloss beneath it instead. Russian leaves these keys empty and nothing is
 * printed, which keeps the original screen exactly as it was.
 */
function gloss(key: MsgKey): void {
  // Printed by key rather than as text, so a change of language redraws it.
  if (io.msg(key)) io.printlnArt(key)
}

/**
 * Blank rows of a drawn screen. They are part of the composition, so they are
 * scaled with the rest of it rather than staying a full row tall.
 */
function space(count: number): void {
  for (let i = 0; i < count; i++) io.printArtLine('')
}

function typeKey(index: number): MsgKey {
  return `type.${Math.max(0, Math.min(10, index))}` as MsgKey
}

function titleKey(level: number): MsgKey {
  if (level < 0) level = 0
  return level > LAST_TITLE ? 'title.none' : `title.${level}` as MsgKey
}

export function typeName(index: number): string {
  return io.msg(typeKey(index))
}

export function titleName(level: number): string {
  return io.msg(titleKey(level))
}

/**
 * The same two words as the message they still are, for dropping into a
 * sentence. A line built out of these is written again, whole, in whatever
 * language is set later; one built out of their text is not.
 */
export function typeRef(index: number, cells?: number): Ref {
  return { key: typeKey(index), cells }
}

export function titleRef(level: number): Ref {
  return { key: titleKey(level) }
}

export async function banner(): Promise<void> {
  space(5)
  for (const line of BANNER) io.printArtLine(line)
  gloss('art.banner')
  space(1)
  io.printlnArt('common.bannerVersion')
  space(3)
  io.printlnArt('common.pressKey')
  space(4)
  io.printlnArt('common.bannerCredits')
  await io.readKey()
  io.clrScr()
}

/** EndScreen(win): the logo, a key press, and then the program is over. */
export async function endScreen(win: boolean): Promise<never> {
  // Won or dead, the run is over: there is no session left to come back to.
  endSession()
  io.clrScr()
  const colour = win ? '2' : '4'
  space(2)
  io.printlnArt(win ? 'common.won' : 'common.died')
  space(3)
  for (const line of END_LOGO) io.printArtLine(`          ^${colour}${line}`)
  gloss('art.endLogo')
  space(5)
  io.printlnArt('common.pressKey')
  space(4)
  await io.readKey()
  io.clrScr()
  throw new HaltGame()
}

/** The "ТЫ СУПЕР ГОП" colour cycle that plays after the rector is beaten. */
export async function winAnim(): Promise<void> {
  let frame = 0
  for (;;) {
    const colours: string[] = []
    for (let i = 1; i <= 10; i++) colours[i] = String((i + frame - 1) % 8)
    io.clrScr()
    let line = ' '.repeat(32)
    for (let i = 0; i < WIN_LETTERS.length; i++) line += `^${colours[10 - i]}${WIN_LETTERS[i]}`
    io.printArtLine(line)
    gloss('art.win')
    frame = frame >= 8 ? 0 : frame + 1
    if (await keyOrDelay(5000)) break
  }
  await io.readKey()
}

/** Waits out the frame, but lets a key press cut it short (KeyPressed). */
function keyOrDelay(ms: number): Promise<boolean> {
  return Promise.race([
    io.delay(ms).then(() => false),
    io.readKey().then(() => true),
  ])
}

function accuracy(agi: number): void {
  if (agi <= 14) {
    io.println('stats.accuracy', 20 + agi * 5)
    return
  }
  io.print('stats.accuracy90')
  let rest = agi - 14
  let kicks = 1
  while (rest > 18) {
    rest -= 18
    kicks++
  }
  if (kicks === 1) io.println('stats.secondKick', rest * 5)
  if (kicks > 1) io.println('stats.manyKicks', kicks, kicks + 1, rest * 5)
}

function healthColour(hp: number, maxHp: number): string {
  let c = '4'
  if (hp / maxHp > 0.25) c = '6'
  if (hp / maxHp > 0.5) c = '2'
  return c
}

export function showStats(): void {
  io.println('stats.you', P.level, { type: typeRef(P.classCode), title: titleRef(P.level) })
  io.println('stats.name', { name: P.name })
  if (P.level <= 39) io.println('stats.exp', P.exp, P.expNext)

  let c1 = '7', c2 = '7', c3 = '7', c4 = '7'
  if (P.highTurns > 0 || P.ringPg || P.megaRing) c1 = '1'
  if (P.ringPg || P.megaRing) { c2 = '1'; c3 = '1' }
  if (P.cross || P.ringGs || P.ringPg || P.megaRing) c4 = '1'
  io.println('stats.skills', P.str, P.agi, P.vit, P.luck, { c1, c2, c3, c4 })

  if (P.cross || P.ringGs) {
    io.print('stats.trinkets')
    if (P.cross) io.print('stats.cross')
    if (P.ringGs) io.print('stats.ringGs')
    io.printRawLine('')
  }
  if (P.ringPg || P.megaRing || P.ringHeal) {
    io.print('stats.bigTrinkets')
    if (P.ringPg) io.print('stats.ringPg')
    if (P.megaRing) io.print('stats.megaRing')
    if (P.ringHeal) io.print('stats.ringGp')
    io.printRawLine('')
  }
  if (P.mobile) io.println('stats.mobile')
  if (P.sunglasses) io.println('stats.sunglasses')
  if (P.tattoo) io.println('stats.tattoo')
  if (P.pistol) {
    io.printRawLine('')
    io.print('stats.pistol')
    if (P.silencer) io.print('stats.silencer')
    if (P.bullets > 0) io.println('stats.bullets', P.bullets)
    if (P.bullets <= 2 && P.bullets > 0) io.println('stats.fewBullets')
    if (P.bullets <= 0) io.println('stats.noBullets')
    io.printRawLine('')
  }

  const armed = P.highTurns > 0 || P.boots || P.bootsCool || P.knuckles || P.club || P.knife || P.cleaver
  io.print('stats.damage', P.dmgMin, P.dmgMax, { c: armed ? '1' : '7' })
  if (P.boots && !P.bootsCool) io.print('stats.boots')
  if (P.boots && P.bootsCool) io.print('stats.bootsOld')
  if (P.bootsCool) io.print('stats.bootsCool')
  if (P.knuckles && !P.knife && !P.club && !P.cleaver) io.print('stats.knuckles')
  if (P.knuckles && (P.knife || P.club || P.cleaver)) io.print('stats.knucklesOld')
  if (P.club && !P.knife && !P.cleaver) io.print('stats.club')
  if (P.club && (P.knife || P.cleaver)) io.print('stats.clubOld')
  if (P.knife && !P.cleaver) io.print('stats.knife')
  if (P.knife && P.cleaver) io.print('stats.knifeOld')
  if (P.cleaver) io.print('stats.cleaver')
  io.printRawLine('')

  const flags: Value[] = []
  if (P.jawBroken === 1) flags.push({ key: 'stats.jawBroken' })
  if (P.toothGuard === 1) flags.push({ key: 'stats.toothGuard' })
  if (P.legBroken === 1) flags.push({ key: 'stats.legBroken' })
  if (P.highTurns > 0) flags.push({ key: 'stats.high' })
  io.println('stats.health', P.hp, P.maxHp, { c: healthColour(P.hp, P.maxHp), flags })

  accuracy(P.agi)

  if (P.armor > 0) {
    io.print('stats.armor', P.armor)
    if (P.suitAbibas && P.suitAdidas) { io.print('stats.abibasOld'); io.print('stats.adidas') }
    else if (P.suitAbibas) io.print('stats.abibas')
    if (P.suitAdidas && !P.suitAbibas) io.print('stats.adidas')
    if (P.leather && P.leatherCool) { io.print('stats.leatherOld'); io.print('stats.leatherCool') }
    else if (P.leather) io.print('stats.leather')
    if (P.leatherCool && !P.leather) io.print('stats.leatherCool')
    io.printRawLine('')
  }

  if (P.joints > 0) io.println('stats.joints', P.joints)
  if (P.beer > 0) io.println('stats.beer', div(P.beer, 2), ((P.beer % 2) * 5) % 10)
  else io.println('stats.noBeer')
  if (P.money > 0) io.println('stats.money', P.money)
  else io.println('stats.noMoney')
  if (P.junk > 0) io.println('stats.junk', P.junk)
}

export function showEnemy(): void {
  const named: Ref = E.level <= MAX_LEVEL ? titleRef(E.level) : { key: 'title.none' }
  const title: Value = E.type >= 8 ? '' : [{ key: 'enemy.titleSep' }, named]
  io.println('enemy.this', E.level, { type: typeRef(E.type), title })
  io.println('enemy.skills', E.str, E.agi, E.vit, E.luck)
  io.println('enemy.damage', E.dmgMin, E.dmgMax)

  const flags: Value[] = []
  if (E.jawBroken === 1) flags.push({ key: 'stats.jawBroken' })
  if (E.legBroken === 1) flags.push({ key: 'stats.legBroken' })
  io.println('enemy.health', E.hp, E.maxHp, { c: healthColour(E.hp, E.maxHp), flags })

  accuracy(E.agi)
  if (E.armor > 0) io.println('stats.armor', E.armor)
}

export function help(): void {
  const type = typeRef(P.classCode)
  const strWeight = WEIGHTS[P.classCode][0]
  io.println('help.intro', { type, name: P.name })
  io.println('help.first')
  io.println('help.example', { type })
  io.println('help.sum1', strWeight)
  io.println('help.sum2', strWeight)
  io.println('help.sum3')
  io.println('help.blank')
  io.println('help.str')
  io.println('help.agi')
  io.println('help.vit')
  io.println('help.luck')
  io.println('help.blank2')
  io.println('help.hp')
  io.println('help.dmg')
  io.println('help.acc')
  io.println('help.armor')
  io.println('help.blank')
  io.println('help.things')
  io.println('help.places')
  if (W.district > 1) io.println('help.newDistrict')
  io.println('help.whatFor')
  io.println('help.market')
  io.println('help.vet')
  io.println('help.girl1')
  io.println('help.girl2')
  io.println('help.den1')
  io.println('help.den2')
  io.println('help.den3')
  io.println('help.club1')
  io.println('help.club2')
  io.println('help.gym')
  io.println('help.dealers1')
  io.println('help.dealers2')
  io.println('help.screen')
}

/** Kept here so the win animation can pick a spectator line the same way. */
export function randomCrowdLine(): number {
  return random(18)
}
