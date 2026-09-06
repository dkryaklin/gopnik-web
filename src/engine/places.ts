/** The seven places you can walk into: market, dealers, vet, girl, den, club, gym. */

import { P, E, W } from './state'
import { PRICE, BEER_HEAL } from './tables'
import { random } from './rng'
import { levelUp } from './levelup'
import { genEnemy } from './enemy'
import { fight } from './fight'
import { typeName } from './screens'
import * as io from './io'
import type { MsgKey } from '../i18n'

/** Prices are dark grey when you can afford them and red when you cannot. */
const afford = (price: number) => ({ c: price > P.money ? '4' : '0' })
const affordGe = (price: number) => ({ c: P.money >= price ? '0' : '4' })

// ---- market ---------------------------------------------------------------

export async function market(): Promise<void> {
  io.println('market.welcome')
  io.println('market.steal')
  io.println('market.buy')
  io.println('market.item1', PRICE.hotdog, afford(PRICE.hotdog))
  io.println('market.item2', PRICE.beer, BEER_HEAL, afford(PRICE.beer))
  io.println('market.item3', PRICE.glasses, afford(PRICE.glasses))
  io.println('market.item4', PRICE.abibas, afford(PRICE.abibas))
  io.println('market.item5', PRICE.boots, afford(PRICE.boots))
  if (W.district > 1) {
    io.println('market.item6', PRICE.leather, afford(PRICE.leather))
    io.println('market.item7', PRICE.adidas, afford(PRICE.adidas))
  }
  if (W.district > 2) io.println('market.item8', PRICE.bootsCool, afford(PRICE.bootsCool))
  if (W.district > 3) io.println('market.item9', PRICE.leatherCool, afford(PRICE.leatherCool))

  for (;;) {
    io.print('market.prompt')
    let sub = await io.readCmd()

    if (sub === '1') {
      if (P.jawBroken === 1) io.println('market.jaw')
      else if (P.hp >= P.maxHp) io.println('market.notHungry')
      else if (PRICE.hotdog > P.money) io.println('market.noMoneyFood')
      else {
        P.money -= PRICE.hotdog
        P.hp += random(2) + 3
        if (P.hp > P.maxHp) P.hp = P.maxHp
        io.println('market.ateHotdog')
      }
    }

    if (sub === '2') {
      if (PRICE.beer > P.money) io.println('market.notEnough')
      else {
        P.money -= PRICE.beer
        io.println(`market.beer${random(3)}` as MsgKey)
        P.beer++
      }
    }

    if (sub === '3') {
      if (P.sunglasses) io.println('market.hasGlasses')
      else if (PRICE.glasses > P.money) io.println('market.noMoney2')
      else {
        P.sunglasses = 1
        P.money -= PRICE.glasses
        io.println('market.gotGlasses')
      }
    }

    if (sub === '4') {
      if (P.suitAdidas) io.println('market.hasBetterSuit')
      else if (P.suitAbibas) io.println('market.hasSuit')
      else if (PRICE.abibas > P.money) io.println('market.noMoney3')
      else {
        P.suitAbibas = 1
        P.money -= PRICE.abibas
        io.println('market.gotAbibas')
        P.armor++
      }
    }

    if (sub === '5') {
      if (P.bootsCool) io.println('market.hasBetterBoots')
      else if (P.boots) io.println('market.hasBoots')
      else if (PRICE.boots > P.money) io.println('market.noMoney4')
      else {
        P.boots = 1
        P.money -= PRICE.boots
        io.println('market.gotBoots')
        P.dmgMin++
        P.dmgMax++
      }
    }

    if (W.district > 1 && sub === '6') {
      if (P.leatherCool) io.println('market.hasBetterLeather')
      else if (P.leather) io.println('market.hasLeather')
      else if (PRICE.leather > P.money) io.println('market.noMoney5')
      else {
        P.leather = 1
        P.money -= PRICE.leather
        io.println('market.gotLeather')
        P.armor += 2
      }
    }

    // Not district-gated in the original, even though the menu line is.
    if (sub === '7') {
      if (P.suitAdidas) io.println('market.hasAdidas')
      else if (PRICE.adidas > P.money) io.println('market.noMoney3')
      else {
        P.suitAdidas = 1
        P.money -= PRICE.adidas
        io.println('market.gotAdidas')
        if (P.suitAbibas) P.armor++
        else P.armor += 2
      }
    }

    if (W.district > 2 && sub === '8') {
      if (P.bootsCool) io.println('market.hasBoots')
      else if (PRICE.bootsCool > P.money) io.println('market.noMoney4')
      else {
        P.bootsCool = 1
        P.money -= PRICE.bootsCool
        io.println('market.gotBootsCool')
        if (P.boots) {
          P.dmgMin++
          P.dmgMax++
        } else {
          P.dmgMin += 2
          P.dmgMax += 2
        }
      }
    }

    if (W.district > 3 && sub === '9') {
      if (P.leatherCool) io.println('market.hasLeather')
      else if (PRICE.leatherCool > P.money) io.println('market.noMoney5')
      else {
        P.leatherCool = 1
        P.money -= PRICE.leatherCool
        io.println('market.gotLeatherCool')
        if (P.leather) P.armor += 2
        else P.armor += 4
      }
    }

    if (sub === 't') {
      if (P.luck >= random(W.district * 5 + 5) && random(10) < 9) {
        const found = random(P.luck * 2) + 1
        P.money += found
        io.println('thief.found', found)
        io.println('market.stealExp', W.district * 2)
        P.exp += W.district * 2
        levelUp(0)
      } else {
        genEnemy(1)
        io.println('market.caught')
        io.println('market.thisIs', E.level, { type: typeName(E.type) })
        await fight(1)
        io.println('market.copsComing')
        sub = 'w'
        W.marketBan = 5
      }
    }

    if (sub === 'w') return
  }
}

// ---- dealers --------------------------------------------------------------

export async function dealers(): Promise<void> {
  io.println('dealers.welcome')
  io.println('dealers.junk')
  io.println('dealers.sell')
  io.println('dealers.item1', PRICE.joint, afford(PRICE.joint))
  io.println('dealers.item2', PRICE.mobile, afford(PRICE.mobile))
  io.println('dealers.item3', PRICE.superJoint, afford(PRICE.superJoint))
  io.println('dealers.item4', PRICE.tattoo, afford(PRICE.tattoo))
  if (W.district > 1) io.println('dealers.item5', PRICE.knuckles, afford(PRICE.knuckles))
  if (W.district > 2) io.println('dealers.item6', PRICE.club, afford(PRICE.club))
  if (W.district > 3) {
    io.println('dealers.item7', PRICE.pistol, 20, 30, afford(PRICE.pistol))
    io.println('dealers.item8', PRICE.ammo, afford(PRICE.ammo))
    // The menu shows the ammo price but the silencer costs 60.
    if (P.pistol !== 0 && W.silencerTimer === 25) {
      io.println('dealers.item9', PRICE.ammo, afford(PRICE.silencer))
    }
  }

  for (;;) {
    io.print('dealers.prompt')
    let sub = await io.readCmd()

    if (sub === '1') {
      if (PRICE.joint > P.money) io.println('dealers.noMoney')
      else {
        P.money -= PRICE.joint
        P.joints++
        io.println('dealers.gotJoint')
      }
    }

    if (sub === '2') {
      if (P.mobile) io.println('dealers.hasMobile')
      else if (PRICE.mobile > P.money) io.println('dealers.noMoney2')
      else {
        P.mobile = 1
        P.money -= PRICE.mobile
        io.println('dealers.gotMobile')
      }
    }

    if (sub === '3') {
      if (PRICE.superJoint > P.money) io.println('dealers.notEnough')
      else {
        P.money -= PRICE.superJoint
        io.println('dealers.steroids')
        const which = random(4)
        if (which === 0) {
          P.str++
          io.println('level.str')
          P.dmgMax++
          if (P.str % 2 === 0) P.dmgMin++
          P.maxHp++
          P.hp++
        } else if (which === 1) {
          P.agi++
          io.println('level.agi')
        } else if (which === 2) {
          P.vit++
          io.println('level.vit')
          P.maxHp += 5
          P.hp += 5
        } else if (which === 3) {
          P.luck++
          io.println('level.luck')
        }
      }
    }

    if (sub === '4') {
      if (P.tattoo) io.println('dealers.hasTattoo')
      else if (PRICE.tattoo > P.money) io.println('dealers.noMoney2')
      else {
        P.tattoo = 1
        P.money -= PRICE.tattoo
        io.println('dealers.gotTattoo')
      }
    }

    if (sub === '5') {
      if (P.club && P.knife && P.cleaver) io.println('dealers.betterWeapon')
      else if (P.knuckles) io.println('dealers.hasKnuckles')
      else if (PRICE.knuckles > P.money) io.println('dealers.noMoney3')
      else {
        P.knuckles = 1
        P.money -= PRICE.knuckles
        P.dmgMin += 2
        P.dmgMax += 2
        io.println('dealers.gotKnuckles')
      }
    }

    if (sub === '6') {
      if (P.knife && P.cleaver) io.println('dealers.betterWeapon2')
      else if (P.club) io.println('dealers.hasClub')
      else if (PRICE.club > P.money) io.println('dealers.noMoneyClub')
      else {
        P.club = 1
        P.money -= PRICE.club
        // Original: the club only adds damage if you already own knuckles.
        if (P.knuckles) {
          P.dmgMin += 2
          P.dmgMax += 2
        }
        io.println('dealers.gotClub')
      }
    }

    if (sub === '7') {
      if (P.pistol) io.println('dealers.hasPistol')
      else if (PRICE.pistol > P.money) io.println('dealers.expensive')
      else {
        P.pistol = 1
        P.bullets += 3
        P.money -= PRICE.pistol
        io.println('dealers.gotPistol')
        io.println('dealers.pistolHint')
      }
    }

    if (sub === '8') {
      if (!P.pistol) io.println('dealers.noPistol')
      else if (PRICE.ammo > P.money) io.println('dealers.noMoney4')
      else {
        P.bullets += 5
        P.money -= PRICE.ammo
        io.println('dealers.gotAmmo')
      }
    }

    if (sub === '9' && P.pistol !== 0 && W.silencerTimer === 25) {
      if (P.silencer) io.println('dealers.hasSilencer')
      else if (PRICE.silencer > P.money) io.println('dealers.noMoney5')
      else {
        P.silencer = 1
        P.money -= PRICE.silencer
        io.println('dealers.gotSilencer')
      }
    }

    if (sub === 'x') {
      if (P.junk > 0) {
        P.money += P.junk
        P.junk = 0
        io.println('dealers.soldJunk')
      } else {
        io.println('dealers.noJunk')
      }
    }

    if (sub === 'wes') {
      await sellThings()
      sub = ' '
    }

    if (sub === 'w') return
  }
}

/** `wes`: offers each superseded item in turn. Selling never removes its bonus. */
async function sellThings(): Promise<void> {
  let price = 255

  const offer = async (
    ask: MsgKey, sold: MsgKey, roll: number, base: number, take: () => void,
  ): Promise<void> => {
    io.println(ask)
    io.print('dealers.sellPrompt')
    const answer = await io.readCmd()
    price = (random(roll) + base) & 0xff
    if (answer !== 'y') return
    take()
    P.money += price
    io.println(sold, price)
  }

  if (P.suitAbibas && P.suitAdidas) {
    await offer('dealers.sellSuit', 'dealers.soldSuit', 5, 8, () => { P.suitAbibas = 0 })
  }
  if (P.boots && P.bootsCool) {
    await offer('dealers.sellBoots', 'dealers.soldBoots', 5, 8, () => { P.boots = 0 })
  }
  if (P.leather && P.leatherCool) {
    await offer('dealers.sellLeather', 'dealers.soldLeather', 8, 13, () => { P.leather = 0 })
  }
  if (P.knuckles && (P.club || P.knife || P.cleaver)) {
    await offer('dealers.sellKnuckles', 'dealers.soldKnuckles', 8, 13, () => { P.knuckles = 0 })
  }
  if (P.club && (P.knife || P.cleaver)) {
    await offer('dealers.sellClub', 'dealers.soldClub', 15, 25, () => { P.club = 0 })
  }
  if (P.knife && P.cleaver) {
    await offer('dealers.sellKnife', 'dealers.soldKnife', 23, 38, () => { P.knife = 0 })
  }
  if (price === 255) io.println('dealers.nothingToSell')
}

// ---- vet ------------------------------------------------------------------

export async function vet(): Promise<void> {
  io.println('vet.welcome')
  const healthy = () => P.hp >= P.maxHp && P.jawBroken === 0 && P.legBroken === 0
  if (!healthy()) {
    io.println('vet.doc')
    io.println('vet.heal', affordGe(3))
    io.println('vet.fix', affordGe(7))
  }

  for (;;) {
    if (healthy()) {
      io.println('vet.healthy')
      return
    }
    io.print('vet.prompt')
    const sub = await io.readCmd()

    if (sub === 'r' && (P.jawBroken === 1 || P.legBroken === 1)) {
      if (P.money >= 7) {
        P.money -= 7
        P.jawBroken = 0
        P.legBroken = 0
        io.println('vet.truck')
        io.println('vet.fixed')
      } else {
        io.println('vet.noMoney')
      }
    }

    if (sub === 'h' && P.hp < P.maxHp) {
      if (P.money >= 3) {
        P.money -= 3
        P.hp += 5
        if (P.hp > P.maxHp) P.hp = P.maxHp
        const line = random(3)
        if (line === 1) io.println('vet.line1')
        else if (line === 2) io.println('vet.line2')
        else {
          io.println('vet.line3a')
          io.println('vet.line3b')
        }
        io.println('vet.health', P.hp, P.maxHp)
      } else {
        io.println('vet.noMoney')
      }
    }

    if (sub === 'w' || sub === 'e') return
  }
}

// ---- girlfriend -----------------------------------------------------------

export function girlfriend(): void {
  if (P.money < 12) {
    io.println('girl.noMoney')
    return
  }
  io.println('girl.visit')
  if (random(2) === 0 && W.knowClub === 0) {
    io.println('girl.club')
    W.knowClub = 1
  }
  io.println('girl.spent')
  io.println('girl.rested')
  P.hp = P.maxHp
  P.money -= 12
  W.marketBan = 0
}

// ---- den ------------------------------------------------------------------

const askAvailable = () =>
  (W.knowDealers === 0 || W.knowGym === 0) &&
  5 * (P.level - 10 * (W.district - 1) - 5) + P.cool >= 40

export async function den(): Promise<void> {
  io.print('den.came')
  if (W.district === 1) io.println('den.name1', random(6) + 3)
  if (W.district === 2) io.println('den.name2')
  if (W.district === 3) io.println('den.name3')
  if (W.district === 4) io.println('den.name4')

  io.blank(1)
  if (W.denHelpQuest === 1) io.println('den.questHint')
  if (W.denJob !== 0 && P.cool >= 100) io.println('den.jobHint')
  if (askAvailable()) io.println('den.askHint')

  io.blank(1)
  io.println('den.leave')
  io.println('den.beer', { c: P.beer !== 0 ? '0' : '4' })
  if (W.loans > 0) io.println('den.borrow', { c: P.cool >= 2 ? '0' : '4' })
  if (W.denHelpQuest === 1) io.println('den.quest')
  io.println('den.status')
  if (askAvailable()) io.println('den.ask')
  if (P.cool >= 100 && W.denJob !== 0) io.println('den.job')

  for (;;) {
    io.print('den.prompt')
    const sub = await io.readCmd()

    if (sub === 'p') {
      if (P.beer > 0) {
        P.beer--
        P.cool += 5
        io.println('den.treated')
      } else {
        io.println('den.noBeer')
      }
    }

    if (sub === 'r') {
      if (W.loans > 0) {
        if (P.cool > 0) {
          P.money += 2
          P.cool -= 2
          W.loans--
          io.println('den.borrowed')
        } else {
          io.println('den.cantBorrow')
        }
      } else {
        io.println('den.noLoans')
      }
    }

    if (W.denHelpQuest === 1 && sub === 'hp') {
      genEnemy(1)
      io.println('market.thisIs', E.level, { type: typeName(E.type) })
      await fight(6)
      W.denHelpQuest = 0
    }

    if (sub === 's') {
      io.println('den.coolIs', P.cool)
      if (W.district * 10 + 10 <= P.cool) io.println('den.weBackYou')
    }

    // The menu offers this on a stricter test than the one that grants it.
    if ((W.knowDealers === 0 || W.knowGym === 0) &&
        2 * (P.level - 10 * (W.district - 1)) + P.cool >= 40 && sub === 'a') {
      W.knowDealers = 1
      W.knowGym = 1
      io.println('den.places1')
      io.println('den.places2')
    }

    if (sub === 'd' && P.cool >= 100 && W.denJob !== 0) {
      io.println('den.hurry')
      io.println('den.stealing')
      if (P.luck >= random(W.district * 15)) {
        io.println('den.stole')
        P.money += W.district * 10 + random(W.district * 10)
        P.junk += W.district * 10 + random(W.district * 10)
        io.println('den.expJob', W.district * 12)
        P.exp += W.district * 12
        levelUp(0)
      } else {
        io.println('den.cops')
        if (P.luck >= random(W.district * 15)) {
          io.println('den.escaped')
        } else {
          genEnemy(2)
          await fight(5)
          io.println('den.runAway')
        }
      }
      W.denJob = 0
    }

    if (sub === 'w') return
  }
}

// ---- club -----------------------------------------------------------------

export async function club(): Promise<void> {
  if (W.clubBan > 0) {
    io.println('club.banned')
    return
  }
  io.println('club.welcome')
  io.println('club.cards')
  io.println('club.item1', affordGe(15))
  if (W.district > 1) io.println('club.item2', affordGe(22))
  W.bet = 5

  for (;;) {
    io.print('club.prompt')
    let sub = await io.readCmd()

    if (sub === 'p') {
      if (W.bet > P.money) {
        io.println('club.noMoney', W.bet)
      } else {
        io.println('club.bet', W.bet)
        P.money -= W.bet
        if (P.luck >= random(W.district * 12)) {
          P.money += 2 * W.bet
          io.println('club.won', W.bet)
          W.bet += 2
          io.println('den.expJob', W.district)
          P.exp += W.district
          levelUp(0)
        } else {
          io.println('club.lost', W.bet)
          W.bet = 5
        }
        if (W.bet < 17 && W.bet > 5) io.println('club.betChanged', W.bet)
        if (W.bet >= 17) {
          genEnemy(1)
          io.println('club.cheat')
          io.println('market.thisIs', E.level, { type: typeName(E.type) })
          io.println('club.expWin', W.district * 5)
          P.exp += W.district * 5
          levelUp(0)
          await fight(2)
          io.println('club.thrownOut')
          W.clubBan = 5
          sub = 'w'
        }
      }
    }

    if (sub === '1') {
      if (P.money >= 15) {
        P.money -= 15
        io.println('club.agi')
        P.agi++
        io.println('level.agi')
      } else {
        io.println('market.notEnough')
      }
    }

    if (W.district > 1 && sub === '2') {
      if (P.money >= 22) {
        P.money -= 22
        io.println('club.luck')
        P.luck++
        io.println('level.luck')
      } else {
        io.println('market.notEnough')
      }
    }

    if (sub === 'w') return
  }
}

// ---- gym ------------------------------------------------------------------

export async function gym(): Promise<void> {
  let absArmor = P.armor
  if (P.suitAbibas && !P.suitAdidas) absArmor--
  if (P.suitAdidas) absArmor -= 2
  if (P.leather && !P.leatherCool) absArmor -= 2
  if (P.leatherCool) absArmor -= 4

  io.println('gym.welcome')
  io.println('gym.item1', affordGe(20))
  io.println('gym.item2', affordGe(20))
  if (W.district > 1 && W.district * 10 - 3 > P.level) io.println('gym.item3', 10, affordGe(10))
  if (W.district > 1) io.println('gym.item4', affordGe(30))
  if (W.district > 2 && absArmor < W.district * 2) io.println('gym.item5', affordGe(20))

  for (;;) {
    io.print('gym.prompt')
    const sub = await io.readCmd()

    if (sub === '1') {
      if (P.money >= 20) {
        P.money -= 20
        io.println('gym.str')
        P.str++
        P.maxHp++
        P.hp++
        if (P.str % 2 === 0) P.dmgMin++
        P.dmgMax++
        io.println('level.str')
      } else {
        io.println('market.notEnough')
      }
    }

    if (sub === '2') {
      if (P.money >= 20) {
        P.money -= 20
        io.println('gym.vit')
        P.vit++
        P.maxHp += 5
        P.hp += 5
        io.println('gym.vitPlus')
      } else {
        io.println('market.notEnough')
      }
    }

    if (W.district > 1 && sub === '3') {
      if (W.district * 10 - 3 <= P.level) io.println('gym.tooCool')
      else if (P.money < 10) io.println('dealers.noMoney3')
      else {
        P.money -= 10
        io.println('gym.training')
        P.exp += 10
        io.println('gym.expPlus', 10)
        if (P.exp >= P.expNext) levelUp(0)
      }
    }

    if (W.district > 1 && sub === '4') {
      if (P.toothGuard) io.println('gym.hasGuard')
      else if (P.money < 30) io.println('gym.noMoney')
      else {
        P.money -= 30
        P.toothGuard = 1
        io.println('gym.gotGuard')
      }
    }

    if (W.district > 2 && sub === '5') {
      if (absArmor >= (W.district - 2) * 10) {
        io.println('gym.maxAbs')
        if (W.district < 4) io.println('gym.nextDistrict')
      } else if (P.money < 20) {
        io.println('gym.noMoney2')
      } else {
        P.money -= 20
        io.println('gym.abs')
        P.armor++
        absArmor++
        io.println('gym.armorPlus')
      }
    }

    if (sub === 'w') return
  }
}
