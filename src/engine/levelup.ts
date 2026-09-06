import { P } from './state'
import { WEIGHTS, MAX_LEVEL } from './tables'
import { random } from './rng'
import * as io from './io'

/**
 * LevelUp(force): spends banked experience. Two weighted stat rolls per level,
 * remembered in levelHist so running away can take them back again.
 */
export function levelUp(force: number): void {
  if (P.exp < P.expNext) return

  let levels = 0
  do {
    P.exp -= P.expNext
    P.expNext += 10
    levels++
  } while (P.exp >= P.expNext)

  for (let i = 1; i <= levels; i++) {
    if (force === 0 && P.level === MAX_LEVEL) break
    P.level++
    io.print('level.up')
    const w = WEIGHTS[P.classCode]
    const total = w[0] + w[1] + w[2] + w[3]
    for (let roll = 1; roll <= 2; roll++) {
      const r = random(total) + 1
      if (w[0] >= r) {
        P.str++
        io.print('level.str')
        remember('1')
        P.dmgMax++
        if (P.str % 2 === 0) P.dmgMin++
        P.maxHp++
        P.hp++
      } else if (w[0] + w[1] >= r) {
        P.agi++
        io.print('level.agi')
        remember('2')
      } else if (w[0] + w[1] + w[2] >= r) {
        P.vit++
        io.print('level.vit')
        remember('3')
        P.maxHp += 5
        P.hp += 5
      } else if (w[0] + w[1] + w[2] + w[3] >= r) {
        P.luck++
        io.print('level.luck')
        remember('4')
      }
    }
    io.printRawLine('')
  }

  if (force === 0) io.println('level.exp', P.exp, P.expNext)
}

function remember(digit: string): void {
  if (P.level > MAX_LEVEL) return
  P.levelHist[P.level] = ((P.levelHist[P.level] ?? '') + digit).slice(0, 2)
}
