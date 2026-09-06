import { P } from './state'
import { div } from './rng'
import * as io from './io'

const half = (beer: number) => div(beer, 2)
const rest = (beer: number) => ((beer % 2) * 5) % 10

/**
 * DrinkBeer(cmd) — `h` drinks one bottle, `mh` drinks until full or dry.
 * It runs on every command line, in town and in a fight alike.
 */
export function drinkBeer(cmd: string): void {
  if (cmd !== 'h' && cmd !== 'mh') return
  const startHp = P.hp

  if (P.jawBroken === 1) {
    io.println('beer.jaw')
    tail(cmd, startHp)
    return
  }

  for (;;) {
    if (P.hp >= P.maxHp) {
      io.println('beer.enough')
      return
    }
    if (P.beer <= 0) {
      if (cmd === 'h') io.println('beer.none')
      break
    }
    P.beer--
    if (P.maxHp - P.hp < 5) {
      if (cmd === 'h') io.print('beer.adds', P.maxHp - P.hp)
      P.hp = P.maxHp
      if (cmd === 'h') io.println('beer.health', P.hp, P.maxHp, half(P.beer), rest(P.beer))
    } else {
      P.hp += 5
      if (cmd === 'h') {
        io.println('beer.addsFull', 5, P.hp, P.maxHp, half(P.beer), rest(P.beer))
      }
    }
    if (cmd === 'h') break
    if (!(P.hp < P.maxHp && P.beer > 0)) break
  }

  tail(cmd, startHp)
}

function tail(cmd: string, startHp: number): void {
  if (cmd !== 'mh') return
  if (P.hp !== startHp) {
    io.println('beer.addsFull', P.hp - startHp, P.hp, P.maxHp, half(P.beer), rest(P.beer))
  }
  if (P.hp !== startHp && P.beer <= 0) io.println('beer.ranOut')
  if (P.hp === startHp && P.beer <= 0) io.println('beer.none')
}

/** `kos` — a joint lasts 10 turns in town but only 3 in a fight. */
export function eatJoint(inFight: boolean): void {
  if (P.jawBroken === 1) {
    io.println('joint.jaw')
    return
  }
  if (P.highTurns !== 0) {
    io.println('joint.already')
    return
  }
  if (P.joints <= 0) {
    io.println('joint.none')
    return
  }
  P.joints--
  P.highTurns = inFight ? 3 : 10
  P.str += 2
  P.dmgMin++
  P.dmgMax += 2
  if (P.maxHp - P.hp < 10) {
    io.print('joint.adds', P.maxHp - P.hp)
    P.hp = P.maxHp
    io.println('joint.health', P.hp, P.maxHp, P.joints)
  } else {
    P.hp += 10
    io.println(inFight ? 'joint.addsFull' : 'joint.addsFull2', 10, P.hp, P.maxHp, P.joints)
  }
  io.println('joint.str')
}
