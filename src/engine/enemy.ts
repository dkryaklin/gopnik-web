import { E, P, W } from './state'
import { WEIGHTS } from './tables'
import { random, round, div, byte } from './rng'

/**
 * GenEnemy(mode) — mode 0 street, 1 caught (capped at Беспредельщик),
 * 2 a cop. The type comes out of a triangular table, the level off the
 * player's own, and the stat points are spent with the type's weights.
 */
export function genEnemy(mode: number): void {
  // Type: subtract 1, 2, 3 ... from Random(51)+1 until it goes negative.
  const r = random(51) + 1
  let rest = r
  let type = r
  for (let k = 1; k <= 10; k++) {
    if (rest - k < 0) {
      type = 10 - k
      break
    }
    rest -= k
  }
  type += random(W.district)
  if (W.inArea) type += random(4)
  if (type > 9) type = 9
  if (mode === 1 && type > 7) type = 7
  if (mode === 2) type = 8
  E.type = type

  // Level.
  const base = 4 * random(W.district)
  const spread = random(5)
  const mul = 1 + random(2)
  const divisor = 1 + random(2)
  let level = base + round((P.level * mul) / divisor + spread - 2)
  if (level < 0) level = 0
  if (W.inArea) level = round(level * 1.5)
  E.level = level

  // Stats: 3 points per level, counted in a byte, spread by the type weights.
  E.str = 0
  E.agi = 0
  E.vit = 0
  E.luck = 0
  const w = WEIGHTS[E.type]
  const total = byte(w[0] + w[1] + w[2] + w[3])
  const points = byte(3 * E.level)
  for (let i = 1; i <= points; i++) {
    const pick = random(total) + 1
    if (w[0] >= pick) E.str++
    else if (w[0] + w[1] >= pick) E.agi++
    else if (w[0] + w[1] + w[2] >= pick) E.vit++
    else if (w[0] + w[1] + w[2] + w[3] >= pick) E.luck++
  }

  E.dmgMin = div(E.str, 2)
  E.dmgMax = E.str
  E.maxHp = E.vit * 5 + E.str + 10
  E.hp = E.maxHp
  E.jawBroken = 0
  E.legBroken = 0

  // Loot.
  const loot = () => round((E.type * E.level) / 5) + div(E.level, 2)
  let junk = random(6)
  junk += 2 * random(loot()) - loot()
  E.junk = junk < 0 ? 0 : junk
  let money = random(6)
  money += random(loot()) - div(loot(), 2)
  E.money = money < 0 ? 0 : money
  E.beer = random(2) + div(E.level, 10) + 1

  const armour = 2 * (W.district - 1) * (W.district - 1)
  E.armor = byte(armour + random(armour))
}

/** InitRector(mode): 0 is the fake rector, 1 the real one. No loot either way. */
export function initRector(mode: number): void {
  E.type = 10
  if (mode === 0) {
    E.level = 125
    E.str = 41
    E.agi = 50
    E.vit = 123
    E.luck = 36
    E.armor = 60
  }
  if (mode === 1) {
    E.level = 160
    E.str = 50
    E.agi = 60
    E.vit = 188
    E.luck = 32
    E.armor = 80
  }
  E.dmgMin = div(E.str, 2)
  E.dmgMax = E.str
  E.maxHp = E.vit * 5 + E.str + 10
  E.hp = E.maxHp
  E.jawBroken = 0
  E.legBroken = 0
  E.money = 0
  E.beer = 0
  E.junk = 0
}
