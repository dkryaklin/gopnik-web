/** Intro, the district loop, a turn on the street, and the command prompt. */

import { P, E, W, assign, newPlayer, newWorld, SAVE_HEADER } from './state'
import { random, randomize, div } from './rng'
import {
  listSaves, readSave, readPlaces, writeSave,
  listSessions, loadSession, eraseSession, beginSession, saveSession,
  type SessionInfo,
} from './save'
import { genEnemy, initRector } from './enemy'
import { fight } from './fight'
import { drinkBeer, eatJoint } from './consumables'
import { banner, showStats, help, typeRef } from './screens'
import { market, dealers, vet, girlfriend, den, club, gym } from './places'
import { church, mageSave } from './encounters'
import * as io from './io'
import type { MsgKey } from '../i18n'
import { textWidth } from '../i18n/width'

export async function run(): Promise<void> {
  assign(P, newPlayer())
  assign(W, newWorld())
  await intro()
  await mainLoop()
}

// ---- start ----------------------------------------------------------------

async function intro(): Promise<void> {
  io.clrScr()
  await banner()
  randomize()

  if (listSessions().length > 0 && await sessionMenu()) return

  const saves = listSaves()
  if (saves.length > 0) {
    let first = true
    for (const slot of saves) {
      if (!first) io.println('load.or')
      first = false
      if (slot !== 0) io.println('load.district', { n: slot })
      else io.println('load.continue')
    }
    io.println('load.pressDigit')
    const key = await io.readKey()
    if (key === '0' || key === '2' || key === '3' || key === '4' || key === '5') {
      const slot = Number(key)
      const loaded = readSave(slot)
      if (loaded) {
        assign(P, loaded)
        W.district = slot
        io.println('load.loaded', { n: key })
        if (W.district === 0) {
          if (readPlaces()) {
            io.println('load.loadedPlaces')
          } else {
            W.knowVet = 0
            W.knowMarket = 0
            if (P.classCode !== 3) W.knowClub = 0
            W.knowGym = 0
            if (P.classCode !== 3) W.hasGirl = 0
            W.knowDealers = 0
            if (P.classCode !== 5) W.knowDen = 0
            io.println('load.placesFailed')
          }
          W.district = div(P.level, 10) + 1
        }
        await arrive()
        claimSession()
        return
      }
      io.println('load.saveFailed')
    }
  }

  await newGame()
  await arrive()
  claimSession()
}

// ---- the saved sessions ---------------------------------------------------

/**
 * The menu the web build opens with when there is something to come back to.
 *
 * Not a screen the original had - it saved a character on the way out of a
 * district, not a game you had walked away from - so it is drawn the way its
 * own menus are: the list, then the `\` prompt, a digit to carry on, `n` to
 * start again and `d` with a digit to wipe one. Returns true when a session was
 * loaded and the caller has nothing left to do but play it.
 */
async function sessionMenu(): Promise<boolean> {
  for (;;) {
    const list = listSessions()
    if (list.length === 0) return false
    showSessions(list)

    io.print('common.prompt')
    const cmd = await io.readCmd()
    if (cmd === 'n') return false

    if (cmd.startsWith('d')) {
      const slot = val(cmd.slice(1))
      if (list.some((s) => s.slot === slot)) {
        eraseSession(slot)
        io.println('session.erased')
      }
      continue
    }

    const slot = val(cmd)
    if (list.some((s) => s.slot === slot) && loadSession(slot)) {
      io.println('session.resumed')
      showStats()
      return true
    }
  }
}

/** The columns the list is set in, in cells of the 80 the screen has. */
const NAME_COL = 16
const TYPE_COL = 12
const LEVEL_COL = 9

/** Pads the player's own name out to its column; the rest pad themselves. */
function pad(text: string, cells: number): string {
  return text + ' '.repeat(Math.max(1, cells - textWidth(text.replace(/\^\d/g, ''))))
}

function showSessions(list: SessionInfo[]): void {
  io.println('session.title')
  const newest = list.reduce((a, b) => (a.at >= b.at ? a : b))
  for (const s of list) {
    io.println('session.slot', {
      n: s.slot,
      name: pad(s.name, NAME_COL),
      type: typeRef(s.classCode, TYPE_COL),
      level: { key: 'session.level', vars: { n: s.level }, cells: LEVEL_COL },
      district: { key: 'session.place', vars: { n: s.district } },
      last: s === newest && list.length > 1 ? { key: 'session.latest' } : '',
    })
  }
  io.println('session.new')
  io.println('session.prompt')
}

/**
 * Every start claims a slot to be autosaved into. With all of them taken the
 * oldest is painted over, which is worth saying out loud.
 */
function claimSession(): void {
  const replaced = beginSession()
  if (replaced) io.println('session.reused', { name: replaced.name })
}

async function newGame(): Promise<void> {
  W.district = 1
  W.knowVet = 1
  W.knowMarket = 1
  P.header = SAVE_HEADER
  P.expNext = 10

  io.println('intro.year')
  await io.readKey()
  io.println('intro.lastDay')
  io.println('intro.skipping')
  io.println('intro.couldPass')
  io.println('intro.butThen')
  await io.readKey()
  io.println('intro.rector1')
  await io.readKey()
  io.println('intro.you1')
  await io.readKey()
  io.println('intro.rector2')
  await io.readKey()
  io.println('intro.everyone')
  await io.readKey()
  io.blank(1)
  io.println('intro.cantStand')
  io.println('intro.decided')
  await io.readKey()

  io.println('intro.chooseWho')
  for (const key of ['intro.class0', 'intro.class1', 'intro.class2', 'intro.class3', 'intro.class4'] as const) {
    io.println(key)
  }
  P.classCode = val(await io.readLine())
  if (P.classCode === 4) {
    P.classCode = 0
    io.blank(1)
    for (const key of ['intro.desc0', 'intro.desc1', 'intro.desc2', 'intro.desc3'] as const) io.println(key)
    io.blank(1)
    io.println('intro.chooseNow')
    for (const key of ['intro.class0', 'intro.class1', 'intro.class2', 'intro.class3'] as const) io.println(key)
    P.classCode = val(await io.readLine())
  }
  if (P.classCode < 0 || P.classCode > 3) P.classCode = 0

  if (P.classCode === 1) { P.str = 5; P.agi = 2; P.vit = 4; P.luck = 1 }
  else if (P.classCode === 2) { P.str = 4; P.agi = 3; P.vit = 3; P.luck = 2 }
  else if (P.classCode === 3) { P.str = 3; P.agi = 3; P.vit = 2; P.luck = 4 }
  else { P.str = 3; P.agi = 3; P.vit = 3; P.luck = 3 }
  P.classCode += 3

  P.maxHp = P.vit * 5 + 10 + P.str
  P.hp = P.maxHp
  P.dmgMin = div(P.str, 2)
  P.dmgMax = P.str

  io.print('intro.askName')
  P.name = await io.readLine()
  if (P.name.length === 0) P.name = io.msg('intro.defaultName')
  P.name = '^7 ' + P.name
}

/** Turbo Pascal's Val: a bad string yields zero. */
function val(text: string): number {
  const n = Number.parseInt(text.trim(), 10)
  return Number.isNaN(n) ? 0 : n
}

/** The arrival text, plus the class bonuses that apply on every start. */
async function arrive(): Promise<void> {
  if (W.district === 1) {
    io.println('arrive.1a')
    io.println('arrive.1b')
  } else if (W.district === 2) {
    io.println('arrive.2a')
    io.println('arrive.2b')
  } else if (W.district === 3) {
    io.println('arrive.3a')
    io.println('arrive.3b')
  } else if (W.district === 4) {
    io.println('arrive.4a')
    io.println('arrive.4b')
  } else if (W.district === 5) {
    io.println('arrive.5')
    W.rectorMode = 1
  }

  if (W.district === 1) {
    io.println('intro.hint1')
    io.println('intro.hint2')
    io.println('intro.hint3')
  }

  if (P.classCode === 5) W.knowDen = 1
  else if (P.classCode === 3) { W.hasGirl = 1; W.knowClub = 1 }
  else if (P.classCode === 6) W.knowDealers = 1

  W.loans = 5
}

// ---- main loop ------------------------------------------------------------

async function mainLoop(): Promise<void> {
  for (;;) {
    if (W.district * 10 <= P.level && W.district < 5) await nextDistrict()

    if (W.rectorMode === 1) {
      W.knowDen = 1
      initRector(0)
      await fight(3)
      initRector(1)
      await fight(4)
    }

    // Where the player is when they close the tab, as far as the game knows.
    saveSession()

    io.print('common.prompt')
    const cmd = await io.readCmd()

    if (cmd === 'w' || cmd === 'run') await turn(cmd)

    if (cmd === 'mar') {
      if (W.knowMarket === 1) {
        if (W.marketBan === 0) await market()
        else io.println('market.banned')
      } else io.println('market.unknown')
    }

    if (cmd === 'bmar') {
      if (W.knowDealers === 1) await dealers()
      else io.println('dealers.unknown')
    }

    if (cmd === 'rep') {
      if (W.knowVet === 1) await vet()
      else io.println('vet.unknown')
    }

    if (cmd === 'girl') {
      if (W.hasGirl === 1) girlfriend()
      else io.println('girl.none')
    }

    if (cmd === 'fight') io.println('cmd.fight')

    if (cmd === 'pr') {
      if (W.knowDen === 1) await den()
      else io.println('den.unknown')
    }

    if (cmd === 'kl') {
      if (W.knowClub === 1) await club()
      else io.println('club.unknown')
    }

    if (cmd === 'trn') {
      if (W.knowGym === 1) await gym()
      else io.println('gym.unknown')
    }

    drinkBeer(cmd)
    if (cmd === 'kos') eatJoint(false)
    if (cmd === 'i') commandList()
    if (cmd === 's') showStats()
    if (cmd === 'f' && P.pistol !== 0) io.println('cmd.shootHere')
    if (cmd === 'k') io.println('cmd.kickHere')

    if (cmd === 'name') {
      io.println('cmd.wereCalled', { name: P.name })
      io.print('cmd.nowCalled')
      P.name = await io.readLine()
      if (P.name.length === 0) P.name = io.msg('intro.defaultName')
      P.name = '^7 ' + P.name
    }

    if (cmd === 'version') io.println('common.version')
    if (cmd === 'help') help()

    if (cmd === 'exit' || cmd === 'e') {
      io.println('cmd.quit')
      io.println('win.result')
      showStats()
      await io.readKey()
      io.halt()
    }
  }
}

async function nextDistrict(): Promise<void> {
  W.district++
  W.knowVet = 0
  W.knowMarket = 0
  if (P.classCode !== 3) W.knowClub = 0
  W.knowGym = 0
  if (P.classCode !== 3) W.hasGirl = 0
  W.knowDealers = 0
  if (P.classCode !== 5) W.knowDen = 0
  W.marketBan = 0
  W.clubBan = 0

  io.println('travel.proved')
  io.println('travel.saveAsk')
  io.print('common.prompt')
  if ((await io.readCmd()) === 'y') {
    writeSave(W.district)
    io.println('travel.saved', { n: W.district })
  }

  if (W.district === 2) {
    io.println('arrive.2a')
    io.println('arrive.2b')
  } else if (W.district === 3) {
    io.println('arrive.3a')
    io.println('arrive.3b')
  } else if (W.district === 4) {
    io.println('arrive.4a')
    io.println('arrive.4b')
  } else if (W.district === 5) {
    io.println('arrive.5')
    await io.readKey()
    io.println('rector.sneak')
    io.println('rector.thereHeIs')
    W.rectorMode = 1
  }
}

// ---- one turn on the street ----------------------------------------------

async function turn(cmd: string): Promise<void> {
  if (P.highTurns > 0) {
    P.highTurns--
    if (P.highTurns === 0) {
      P.str -= 2
      P.dmgMin--
      P.dmgMax -= 2
      io.println('turn.highGone')
    }
  }

  if (cmd === 'run') io.println('turn.ranAround')

  if (W.loans < W.district * 10) W.loans++

  if (W.knowDealers !== 0 && P.pistol !== 0 && W.silencerTimer < 25) {
    W.silencerTimer++
    if (W.silencerTimer === 25 && P.mobile === 1) io.println('phone.silencer')
  }

  if (W.denHelpQuest === 0 && random(20) === 0) {
    W.denHelpQuest = 1
    if (W.knowDen !== 0 && P.mobile === 1) io.println('phone.help', { name: P.name })
  }

  if (W.denJob === 0 && random(20) === 0) {
    W.denJob = 1
    if (W.knowDen !== 0 && P.cool >= 100 && P.mobile === 1) io.println('phone.job', { name: P.name })
  }

  if (P.mobile === 1 && random(200) === 0) {
    io.println('phone.vasya1')
    await io.readKey()
    io.println('phone.vasya2', { name: P.name })
    await io.readKey()
    io.println('phone.vasya3')
    await io.readKey()
    io.println('phone.vasya4')
  }

  if (P.mobile === 1) {
    if (random(100) === 0 && W.hasGirl !== 0) {
      io.println('phone.girl1')
      io.println('phone.girl2')
    }
    if (W.marketBan === 1 && W.knowDen !== 0) io.println('phone.marketClear')
    if (W.clubBan === 1 && W.knowDen !== 0) io.println('phone.clubClear')
  }

  if (W.marketBan > 0) W.marketBan--
  if (W.clubBan > 0) W.clubBan--

  if (random(10) === 0 && W.knowVet === 0) {
    W.knowVet = 1
    io.println('find.vet')
  }
  if (random(10) === 0 && W.knowMarket === 0) {
    W.knowMarket = 1
    io.println('find.market')
  }
  if (random(100) === 0 && W.knowClub === 0) {
    W.knowClub = 1
    io.println('find.club')
  }
  if (random(100) === 0 && W.knowGym === 0) {
    W.knowGym = 1
    io.println('find.gym')
  }

  if (P.ringHeal !== 0) {
    if (P.hp < P.maxHp) {
      P.hp += 3
      if (P.hp > P.maxHp) P.hp = P.maxHp
    }
    if (random(20) === 0) {
      if (P.jawBroken === 0 && P.legBroken !== 0) {
        P.legBroken = 0
        io.println('ring.legHealed')
      }
      if (P.jawBroken !== 0) {
        P.jawBroken = 0
        io.println('ring.jawHealed')
      }
    }
  }

  if (P.classCode === 4) {
    if (P.hp < P.maxHp) P.hp++
  } else if (P.classCode === 6) {
    if (P.luck >= random(W.district * 20)) {
      const found = random(W.district * 5) + 1
      P.money += found
      io.println('thief.found', found)
    }
  }

  const roll = random(25) + 1
  if (roll >= 10) W.evType = 4
  if (roll <= 9 && roll >= 5) W.evType = 3
  if (roll <= 4 && roll >= 2) W.evType = 2
  if (roll === 1) W.evType = 1

  if (random(200) === 0) await church()
  if (random(100) === 0) await mageSave()

  if (W.evType === 1) areaEvent()
  else if (W.evType === 2) await girlEvent()
  else if (W.evType === 3) await enemyEvent()
  else if (W.evType === 4) await highEvent()
  else io.println('event.nothing')
}

function areaEvent(): void {
  W.inArea = W.inArea === 0 ? 1 : 0
  if (W.inArea !== 0) {
    if (W.district === 1) io.println('area.enter1')
    if (W.district === 2) io.println('area.enter2')
    if (W.district === 3) io.println('area.enter3')
    if (W.district === 4) io.println('area.enter4')
  } else {
    if (W.district === 1) io.println('area.exit1')
    if (W.district === 2) io.println('area.exit2')
    if (W.district === 3) io.println('area.exit3')
    if (W.district === 4) io.println('area.exit4')
  }
}

async function girlEvent(): Promise<void> {
  if (W.hasGirl !== 0) {
    io.println('girl.nothing')
    return
  }
  io.println('girl.ask')
  if ((await io.readCmd()) === 'y') {
    if (random(2) === 0) {
      io.println('girl.yes')
      W.hasGirl = 1
    } else {
      io.println('girl.no')
    }
  }
}

async function enemyEvent(): Promise<void> {
  genEnemy(0)
  let joinFight = 0

  if (E.type === 8) {
    io.println('cop.coming', E.level)
    if (P.luck >= random(W.district * 7 + 15)) {
      io.println('cop.hid')
    } else if (P.sunglasses === 1) {
      io.println('cop.glasses1')
      io.println('cop.glasses2')
    } else {
      io.println('cop.spotted')
      joinFight = 1
    }
  } else {
    let chance = W.district * 7 + 15
    if (P.tattoo === 1) chance = div(chance, 2)
    const lucky = P.luck >= random(chance)
    const aggressive = lucky ? E.type >= 7 : E.type >= 3

    if (!aggressive) {
      io.println('event.enemy', E.level, { type: typeRef(E.type) })
      if ((await io.readCmd()) === 'y') joinFight = 1
    } else {
      io.println('event.enemyAggro', E.level, { type: typeRef(E.type) })
      if ((await io.readCmd()) === 'y') joinFight = 1
      else if (random(2) === 0) {
        io.println('event.noticedYou')
        joinFight = 1
      } else {
        io.println('event.slippedAway')
      }
    }
  }

  if (joinFight !== 0) await fight(0)
}

async function highEvent(): Promise<void> {
  if (P.highTurns > 0 && random(7) === 0) io.println('high.floating')
  if (P.highTurns > 0 && random(7) === 0) {
    io.println('event.enemy', random(W.district * 10 + 1), { type: typeRef(random(7)) })
    await io.readLine()
    io.println('high.nobody')
  } else {
    io.println('event.nothing')
  }
}

function commandList(): void {
  io.println('cmds.w')
  if (W.knowMarket === 1) io.println('cmds.mar')
  if (W.knowDealers === 1) io.println('cmds.bmar')
  if (W.knowVet === 1) io.println('cmds.rep')
  if (W.hasGirl === 1) io.println('cmds.girl')
  if (W.knowDen === 1) io.println('cmds.pr')
  if (W.knowClub === 1) io.println('cmds.kl')
  if (W.knowGym === 1) io.println('cmds.trn')
  for (const key of ['cmds.s', 'cmds.sv', 'cmds.k', 'cmds.v', 'cmds.kos',
                     'cmds.h', 'cmds.mh', 'cmds.name', 'cmds.e'] as const) {
    io.println(key as MsgKey)
  }
}
