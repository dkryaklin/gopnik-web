/**
 * Fight(mode) — mode 0 street, 1 caught pickpocketing, 2 caught cheating at
 * cards, 3 the fake rector, 4 the real one, 5 a cop after a failed job,
 * 6 the den's errand. The enemy only ever swings back when you type `k`.
 */

import { P, E, W } from './state'
import { random, round, div } from './rng'
import { MAX_LEVEL } from './tables'
import { levelUp } from './levelup'
import { drinkBeer, eatJoint } from './consumables'
import { showStats, showEnemy, typeName, endScreen, winAnim } from './screens'
import * as io from './io'
import type { MsgKey } from '../i18n'

export async function fight(mode: number): Promise<void> {
  await intro(mode)

  // How many kicks each side gets: high agility takes kicks off the other one.
  const eBase = E.agi + 4
  const pBase = P.agi + 4
  const eEff = reduce(eBase, pBase)
  if (pBase > 18 && div(eEff, 18) < div(eBase, 18)) {
    io.println('fight.yourAgi', div(eEff - 1, 18) + 1, div(eBase - 1, 18) + 1)
  }
  const pEff = reduce(pBase, eBase)
  if (eBase > 18 && div(pEff, 18) < div(pBase, 18)) {
    io.println('fight.enemyAgi', div(pEff - 1, 18) + 1, div(pBase - 1, 18) + 1)
  }

  let over = false
  let rounds = 0

  while (!over) {
    if (rounds < 5) {
      rounds++
      if (rounds === 5) io.println('fight.crowd')
    }
    if (W.rectorMode === 0 && rounds === 5 && random(10) === 0) crowdLine()

    io.print('fight.prompt')
    const sub = await io.readCmd()

    if (sub === 'k') {
      playerAttack(pEff)
      if (E.hp > 0) enemyAttack(eEff)
    }

    if (sub === 'run') {
      if (W.rectorMode === 1) io.println('run.rector')
      else if (P.legBroken === 1) io.println('run.leg')
      else {
        runAway()
        over = true
      }
    }

    drinkBeer(sub)
    if (sub === 'kos') eatJoint(true)
    if (sub === 's') showStats()
    if (sub === 'sv') showEnemy()
    if (sub === 'e') io.halt()

    if (W.help >= 1 && sub === 'k') {
      W.help++
      if (W.help === 3) io.println('help.arrived')
    }

    if (sub === 'v') callBackup()
    if (E.hp > 0 && W.help >= 3) gangAttack()
    if (sub === 'f') shoot()

    if (P.hp <= 0) {
      if (W.rectorMode === 1) {
        io.println('death.rector')
        await io.readKey()
        await endScreen(false)
      } else if (W.knowDen === 1 && P.cool >= 10) {
        io.println('death.rescued')
        P.cool -= 10
        P.money -= round((P.maxHp / 5) * 3)
        P.hp = P.maxHp
        if (P.jawBroken === 1 || P.legBroken === 1) {
          P.money -= 7
          P.jawBroken = 0
          P.legBroken = 0
        }
        if (P.money < 0) {
          P.cool += P.money
          P.money = 0
        }
      } else {
        io.println('death.dead')
        await io.readKey()
        await endScreen(false)
      }
      over = true
    }

    if (E.hp <= 0) {
      await victory(mode)
      over = true
    }
  }

  W.help = 0
}

async function intro(mode: number): Promise<void> {
  if (mode === 0 || mode === 6) {
    if (E.type <= 2) {
      io.println('fight.hey1')
      io.println('fight.hey2')
    } else if (E.type <= 6) {
      io.println('fight.lad1')
      io.println('fight.lad2')
    } else if (E.type === 7) {
      io.println('fight.outlaw')
    } else if (E.type === 8) {
      io.println('fight.cop', { name: P.name, type: typeName(E.type) })
    } else if (E.type === 9) {
      io.println('fight.maniac1')
      io.println('fight.maniac2', { type: typeName(E.type) })
    }
    return
  }
  if (mode === 1) {
    io.println('fight.wallet')
    return
  }
  if (mode === 3) {
    for (const key of ['fight.rector1', 'fight.rector2', 'fight.rector3', 'fight.rector4'] as const) {
      io.println(key)
      await io.readKey()
    }
    return
  }
  if (mode === 4) {
    for (const key of ['fight.realRector1', 'fight.realRector2', 'fight.realRector3', 'fight.realRector4'] as const) {
      io.println(key)
      await io.readKey()
    }
  }
}

/** Takes 18 points off `base` for every 18 points of the opponent's, floor 10. */
function reduce(base: number, budget: number): number {
  let eff = base
  let left = budget
  if (eff > 10) {
    while (left > 18) {
      if (eff >= 28) {
        eff -= 18
        left -= 18
      } else {
        eff = 10
        break
      }
    }
  }
  return eff
}

function crowdLine(): void {
  const line = random(18)
  if (line === 4 || line === 17) {
    io.println(`crowd.${line}` as MsgKey, { name: P.name })
  } else {
    io.println(`crowd.${line}` as MsgKey)
  }
  if (line === 8) io.println('crowd.8b')
}

function playerAttack(base: number): void {
  let cur = base
  for (;;) {
    const roll = random(100) + 1
    if (5 * cur >= roll && roll <= 90) {
      const before = E.hp
      let dmg = P.dmgMin + random(P.dmgMax - P.dmgMin) + 1
      if (P.luck * 3 > random(100) + 1) {
        dmg += P.dmgMax
        io.println(`fight.crit${random(3)}` as MsgKey)
      }
      dmg -= E.armor
      if (dmg < 0) dmg = 0
      E.hp -= dmg
      if (P.luck * 3 > random(200 + E.luck * 3) + 1) {
        if (random(2) === 0) {
          if (E.jawBroken === 0) {
            io.println('fight.brokeJaw')
            E.jawBroken = 1
          }
        } else if (E.legBroken === 0) {
          io.println('fight.brokeLeg')
          E.legBroken = 1
        }
      }
      io.println('fight.hit', before - E.hp, E.hp)
    } else {
      io.println('fight.miss')
    }
    cur -= 18
    if (E.hp <= 0) return
    if (cur > 0) io.println('fight.kickAgain')
    if (!(cur > 0 && E.hp >= 0)) return
  }
}

function enemyAttack(base: number): void {
  let cur = base
  for (;;) {
    const roll = random(100) + 1
    if (5 * cur >= roll && roll <= 90) {
      const before = P.hp
      let dmg = E.dmgMin + random(E.dmgMax - E.dmgMin) + 1
      if (E.luck * 3 > random(100) + 1) {
        dmg += E.dmgMax
        io.println(`fight.enemyCrit${random(3)}` as MsgKey)
      }
      dmg -= P.armor
      if (dmg < 0) dmg = 0
      P.hp -= dmg
      if (E.luck * 3 > random(200 + P.luck * 3) + 1) {
        if (random(2) === 0) {
          if (P.jawBroken === 0) {
            if (P.toothGuard === 0) {
              io.println('fight.jawBroken')
              P.jawBroken = 1
            } else if (random(4) === 0) {
              io.println('fight.jawBrokenGuard')
              P.jawBroken = 1
            } else {
              io.println('fight.guardSaved')
            }
          }
        } else if (P.legBroken === 0) {
          io.println('fight.legBroken')
          P.legBroken = 1
        }
      }
      io.println('fight.enemyHit', before - P.hp, P.hp)
    } else {
      io.println('fight.enemyMiss')
    }
    cur -= 18
    if (cur > 0) io.println('fight.enemyKickAgain')
    if (!(cur > 0 && P.hp >= 0)) return
  }
}

/** Running away hands back the level you gained last, stat by stat. */
function runAway(): void {
  if (P.level <= 0) {
    io.println('run.coward0')
    return
  }
  io.print('run.coward')
  const history = P.levelHist[P.level] ?? ''
  P.levelHist[P.level] = ''
  for (let i = 0; i < 2; i++) {
    switch (history[i]) {
      case '1':
        P.str--
        io.print('run.str')
        P.dmgMax--
        if (P.str % 2 === 1) P.dmgMin--
        P.maxHp--
        if (P.hp > P.maxHp) P.hp = P.maxHp
        break
      case '2':
        P.agi--
        io.print('run.agi')
        break
      case '3':
        P.vit--
        io.print('run.vit')
        P.maxHp -= 5
        if (P.hp > P.maxHp) P.hp = P.maxHp
        break
      case '4':
        P.luck--
        io.print('run.luck')
        break
    }
  }
  io.printRawLine('')
  // Original bug: the message says you are not welcome, the flag says you are.
  if (P.classCode !== 5 && P.level - 10 * (W.district - 1) === 3) {
    W.knowDen = 1
    io.println('run.den')
  }
  P.level--
  P.expNext -= 10
  if (P.exp >= P.expNext) P.exp = P.expNext - 1
}

function callBackup(): void {
  if (W.knowDen === 1 && W.district * 10 + 10 <= P.cool) {
    if (W.help === 0) W.help = 1
    if (P.mobile === 1) {
      W.help = 3
      io.println('help.arrivedNow')
    }
  } else if (W.knowDen !== 0) {
    io.println('help.nobody')
  } else {
    io.println('help.notFriends')
  }

  if (W.help <= 0) return
  if (W.help < 3) io.println('help.holdOn', 3 - W.help)
  else if (!(W.help === 3 && P.mobile !== 0)) io.println('help.alreadyHere')
}

function gangAttack(): void {
  const before = E.hp
  let dmg = 3 * W.district + random(E.hp * 4) - div(E.armor, 3)
  if (dmg < 0) dmg = 0
  E.hp -= dmg
  io.println('help.gangHit', before - E.hp, E.hp)
  if (random(2) === 0) {
    W.help++
    if (W.help === 3) io.println('help.gangCame')
  }
  if (W.help === 7) {
    W.help = 0
    io.println('help.gangBeaten')
  }
  P.cool -= W.district * 5
  if (P.cool <= 0) {
    W.help = 0
    io.println('help.gangLeft')
  }
}

function shoot(): void {
  if (P.pistol === 0) return
  if (W.inArea === 0 && P.silencer === 0) {
    io.println('shoot.notHere')
    return
  }
  if (P.bullets <= 0) {
    io.println('shoot.noAmmo')
    return
  }
  P.bullets--
  if (P.agi > random(50)) {
    const before = E.hp
    E.hp -= 20 + random(10)
    io.println('shoot.hit', before - E.hp, E.hp, P.bullets)
  } else {
    io.println('shoot.miss')
  }
}

async function victory(mode: number): Promise<void> {
  if (mode === 4) {
    P.exp = P.expNext
    levelUp(1)
    for (const key of ['win.rector1', 'win.rector2', 'win.rector3', 'win.rector4'] as const) {
      io.println(key)
      await io.readKey()
    }
    io.println('win.result')
    showStats()
    await io.readKey()
    await winAnim()
    await endScreen(true)
    return
  }

  if (mode === 3) {
    P.exp = P.expNext
    levelUp(1)
    io.println('win.fakeRector1')
    await io.readKey()
    io.println('win.fakeRector2')
    await io.readKey()
  } else {
    io.println('win.enemyDead')
  }

  if (mode !== 3 && mode !== 4) {
    const gained = E.str + E.agi + E.vit + E.luck
    io.println('win.exp', gained)
    P.exp += gained
  }

  if (P.exp < P.expNext) {
    if (mode !== 3 && mode !== 4) {
      io.println('win.tooWeak')
      io.println('win.expNow', P.exp, P.expNext)
    }
  } else {
    levelUp(0)
  }

  P.beer += E.beer
  P.money += E.money
  P.junk += E.junk
  io.println('win.beer')
  P.hp += 5
  if (P.hp > P.maxHp) P.hp = P.maxHp
  P.cool += E.type + 1 + div(E.level, 3)

  if (W.knowDen === 0 && P.level - 10 * (W.district - 1) >= 3) {
    W.knowDen = 1
    io.println('win.denOpen')
  }

  if (random(30) === 0) ringDrop()
  if (P.luck >= random(W.district * 25) && E.type === 2) {
    P.joints += random(3)
    io.println('win.joint')
  }
  if (P.luck >= random(W.district * 40)) itemDrop()

  if (mode === 6) {
    P.cool += W.district * 20
    io.println('win.denQuest', W.district * 20)
    io.println('win.denQuestExp', W.district * 10)
    P.exp += W.district * 10
    levelUp(0)
  }
}

function ringDrop(): void {
  if (!P.ringPg || !P.megaRing || !P.ringHeal) io.println('win.ring')
  if (!P.ringPg) {
    io.println('win.ringPg')
    P.str++
    P.agi++
    P.vit++
    P.luck++
    P.maxHp += 6
    P.hp += 6
    P.dmgMax++
    P.dmgMin += 1 - (P.str % 2)
    P.ringPg = 1
  } else if (!P.megaRing) {
    io.println('win.megaRing')
    P.str += 4
    P.agi += 4
    P.vit += 4
    P.luck += 4
    P.maxHp += 24
    P.hp += 24
    P.dmgMax += 4
    P.dmgMin += 2
    P.megaRing = 1
  } else if (!P.ringHeal) {
    io.println('win.ringGp')
    io.println('win.ringGpDesc')
    P.ringHeal = 1
  }
}

/**
 * Weapon drops. The damage bonuses are compiled from boolean comparisons that
 * misfire in the original (a club alone gives +6 with a knife, +12 with a
 * cleaver); the comparisons are reproduced exactly as they were compiled.
 */
function itemDrop(): void {
  if (E.type === 1) {
    const which = random(3)
    if (which === 0 && !P.cross) {
      P.luck += 2
      io.println('win.cross')
      P.cross = 1
    } else if (which === 1 && !P.ringGs) {
      P.luck++
      io.println('win.ringGs')
      P.ringGs = 1
    } else if (which === 2 && !P.mobile) {
      io.println('win.mobile')
      P.mobile = 1
    }
    return
  }

  if (E.type >= 3 && E.type <= 6) {
    const which = random(2)
    if (which === 0 && !P.knuckles) {
      P.knuckles = 1
      io.println('win.knuckles')
      if (!P.knife && !P.club && !P.cleaver) {
        P.dmgMin += 2
        P.dmgMax += 2
      } else {
        io.println('win.betterWeapon')
      }
    } else if (which === 1 && !P.club) {
      P.club = 1
      io.println('win.club')
      if (!P.knife && !P.cleaver) {
        if (P.knuckles) {
          P.dmgMin += 2
          P.dmgMax += 2
        } else {
          P.dmgMin += 4
          P.dmgMax += 4
        }
      } else {
        io.println('win.betterWeapon')
      }
    }
    return
  }

  if (E.type === 7) {
    const which = random(2)
    if (which === 0 && !P.sunglasses) {
      P.sunglasses = 1
      io.println('win.sunglasses')
    } else if (which === 1 && !P.mobile) {
      io.println('win.mobile')
      P.mobile = 1
    }
    return
  }

  if (E.type !== 9) return
  const which = random(2)
  if (which === 0) {
    if (P.knife) return
    P.knife = 1
    io.println('win.knife')
    const flag = P.club === 0 ? 1 : 0
    if (flag === P.knuckles) {
      P.dmgMin += 4
      P.dmgMax += 4
    }
    if (P.club !== 0) {
      P.dmgMin += 2
      P.dmgMax += 2
    }
    if (!P.knuckles && !P.club && !P.cleaver) {
      P.dmgMin += 6
      P.dmgMax += 6
    }
    if (P.cleaver) io.println('win.cleaverBetter')
    return
  }
  if (which !== 1 || P.cleaver) return
  P.cleaver = 1
  io.println('win.cleaver')
  const flag = P.club === 0 && P.knife === 0 ? 1 : 0
  if (flag === P.knuckles) {
    P.dmgMin += 7
    P.dmgMax += 7
  }
  if (P.club !== 0 && P.knife === 0) {
    P.dmgMin += 5
    P.dmgMax += 5
  }
  if (P.knife !== 0) {
    P.dmgMin += 3
    P.dmgMax += 3
  }
  if (!P.knuckles && !P.club && !P.knife) {
    P.dmgMin += 9
    P.dmgMax += 9
  }
}

export { MAX_LEVEL }
