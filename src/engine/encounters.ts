/** The two things that can find you on the road: the church and the mage. */

import { P, W } from './state'
import { random } from './rng'
import { levelUp } from './levelup'
import { titleName } from './screens'
import { writeSave, writePlaces } from './save'
import * as io from './io'
import { typeName } from './screens'

/** Church(): a blessing, and God gets ruder every time you turn up. */
export async function church(): Promise<void> {
  if (P.churchVisits === 2) {
    io.println('church.wandering')
    io.println('church.found')
    await io.readKey()
    io.println('church.again1')
    io.println('church.again2')
    await io.readKey()
  }

  if (P.churchVisits === 1) {
    io.println('church.wandering')
    await io.readKey()
    io.println('church.found')
    await io.readKey()
    for (const key of ['church.second1', 'church.second2', 'church.second3',
                       'church.second4', 'church.second5'] as const) {
      io.println(key)
      await io.readKey()
    }
    P.churchVisits++
  }

  if (P.churchVisits === 0) {
    io.println('church.wandering')
    await io.readKey()
    io.println('church.found')
    await io.readKey()
    for (const key of ['church.first1', 'church.first2', 'church.first3',
                       'church.first4', 'church.first5', 'church.first6'] as const) {
      io.println(key)
      await io.readKey()
    }
    io.println('church.first7', { name: P.name, type: typeName(P.classCode) })
    await io.readKey()
    io.println('church.first8')
    await io.readKey()
    io.println('church.first9')
    await io.readKey()
    P.churchVisits++
  }

  const blessing = random(5)
  if (blessing === 0) {
    io.println('church.cool')
    await io.readKey()
    io.println('church.wereNow', { old: titleName(P.level), new: titleName(P.level + 1) })
    P.exp = P.expNext
    levelUp(0)
  } else if (blessing === 1) {
    const which = random(4)
    if (which === 0) {
      io.println('church.str')
      P.str++
      P.maxHp++
      P.hp++
      P.dmgMax++
      P.dmgMin += 1 - (P.str % 2)
    } else if (which === 1) {
      io.println('church.agi')
      P.agi++
    } else if (which === 2) {
      io.println('church.vit')
      P.vit++
      P.maxHp += 5
      P.hp += 5
    } else if (which === 3) {
      io.println('church.luck')
      P.luck++
    }
  } else if (blessing === 2) {
    io.println('church.trinket')
    if (!P.ringPg) {
      io.println('church.ringPg')
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
      io.println('church.megaRing')
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
      io.println('church.ringGp')
      io.println('church.ringGpDesc')
      P.ringHeal = 1
    }
  } else if (blessing === 3) {
    io.println('church.armor')
    P.armor++
  } else if (blessing === 4) {
    io.println('church.gopCool')
    P.cool += W.district * 50 + 50
    io.println('church.take', W.district * 50 + 50)
  }

  await io.readKey()
  if (P.churchVisits < 2) io.println('church.neverAgain')
  else io.println('church.goAway')
  W.evType = 0
  io.blank(1)
  io.println('church.walkOn')
}

/**
 * MageSave(): Rushel Blavo offers a save for district*25 roubles and then
 * charges district*50, exactly as in the original.
 */
export async function mageSave(): Promise<void> {
  io.println('mage.wandering')
  await io.readKey()
  io.println('mage.met')
  await io.readKey()
  io.println('mage.price', W.district * 25)
  await io.readKey()
  io.println('mage.ask')
  const answer = await io.readCmd()
  if (answer !== 'y') {
    io.println('mage.refused')
    return
  }
  if (W.district * 50 > P.money) {
    io.println('mage.noMoney')
    return
  }
  P.money -= W.district * 50
  writeSave(0)
  writePlaces()
  io.println('mage.saved')
}
