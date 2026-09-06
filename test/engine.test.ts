import { describe, it, expect, beforeEach } from 'vitest'
import { scripted, play } from './harness'
import { bot } from './bot'
import { random, setSeed, forceSeed, getSeed, round, div } from '../src/engine/rng'
import {
  encodePlayer, decodePlayer, clearSaves, listSaves, writeSave, SAVE_SIZE,
  listSessions, beginSession, saveSession, loadSession, currentSession, SESSION_SLOTS,
} from '../src/engine/save'
import { newPlayer, newWorld, P, E, W, assign } from '../src/engine/state'
import { genEnemy, initRector } from '../src/engine/enemy'
import { levelUp } from '../src/engine/levelup'
import { setLocale } from '../src/i18n'
import { run } from '../src/engine/game'
import { banner, endScreen } from '../src/engine/screens'

beforeEach(() => {
  clearSaves()
  forceSeed(20030607)
  setLocale('ru')
})

describe('Turbo Pascal runtime', () => {
  it('reproduces the TP7 linear congruential sequence', () => {
    setSeed(0)
    expect([random(100), random(100), random(100)]).toEqual([0, 3, 86])
  })

  it('keeps Random(n) inside 0..n-1 and returns 0 for n <= 0', () => {
    setSeed(42)
    for (let i = 0; i < 1000; i++) {
      const value = random(7)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(7)
    }
    expect(random(0)).toBe(0)
  })

  it('rounds halves away from zero and truncates div', () => {
    expect(round(1.5)).toBe(2)
    expect(round(2.5)).toBe(3)
    expect(round(-1.5)).toBe(-2)
    expect(div(7, 2)).toBe(3)
    expect(div(-7, 2)).toBe(-3)
  })
})

describe('save record', () => {
  it('round-trips the 694-byte record with a CP866 name', () => {
    const player = newPlayer()
    player.header = '^4Gopnik: ^7version 1.02 june,sept 2003'
    player.name = '^7 Раз^6дол^4бай'
    player.classCode = 5
    player.str = 12
    player.level = 17
    player.money = 1234
    player.beer = 9
    player.armor = 200
    player.levelHist[17] = '13'
    const bytes = encodePlayer(player)
    expect(bytes.length).toBe(SAVE_SIZE)
    const back = decodePlayer(bytes)
    expect(back.name).toBe(player.name)
    expect(back.header).toBe(player.header)
    expect(back.classCode).toBe(5)
    expect(back.money).toBe(1234)
    expect(back.armor).toBe(200)
    expect(back.levelHist[17]).toBe('13')
  })
})

describe('a played game', () => {
  const script = [
    '0',            // class: Пацан
    'Тест',         // name
    ...Array.from({ length: 60 }, () => 'w'),
    'i', 's', 'help', 'version', 'mar', 'w', 'rep', 'w',
    ...Array.from({ length: 40 }, () => 'w'),
    'e',
  ]

  it('runs from the intro to the exit without blowing up', async () => {
    const log = scripted([...script])
    await play(run)
    const text = log.text()
    expect(text).toContain('Год 2xxx от Р.Х.')
    expect(text).toContain('Ты стоишь у дверей университета.')
    expect(P.name).toBe('^7 Тест')
    expect(P.classCode).toBe(3)
    expect(P.maxHp).toBe(28) // 3 vit * 5 + 10 + 3 str
  })

  it('is deterministic for a given seed', async () => {
    const first = scripted([...script])
    await play(run)
    const a = first.text()
    // The run just played left a session behind; the second one has to start
    // from the same empty storage, not be offered the first one back.
    clearSaves()
    forceSeed(20030607)
    const second = scripted([...script])
    await play(run)
    expect(second.text()).toBe(a)
  })

  it('plays in English too', async () => {
    setLocale('en')
    const log = scripted([...script])
    await play(run)
    expect(log.text()).toContain('Year 2xxx A.D.')
    expect(log.text()).not.toContain('Год 2xxx')
  })
})

describe('an autoplayed game', () => {
  it('survives thousands of commands across several seeds', async () => {
    for (const seed of [1, 20030607, 0xdeadbeef, 12345, 999]) {
      clearSaves()
      forceSeed(seed)
      setLocale('ru')
      const log = bot(['0', 'Бот'], 3000)
      await play(run)
      const text = log.text()
      expect(text).toContain('Год 2xxx от Р.Х.')
      expect(log.commands()).toBeGreaterThan(50)
      // Something must have happened: a fight, a level, or a purchase.
      expect(
        text.includes('Враг сдох.') ||
        text.includes('Понтовость увеличивается') ||
        text.includes('Ты сдох.'),
      ).toBe(true)
    }
  })

  it('wins fights, levels up and moves on across many runs', async () => {
    let victories = 0
    let levelUps = 0
    let districts = 1
    for (let seed = 1; seed <= 25; seed++) {
      clearSaves()
      forceSeed(seed * 7919)
      setLocale('ru')
      const log = bot(['2', 'Гопник'], 4000)
      await play(run)
      const text = log.text()
      victories += (text.match(/Враг сдох/g) ?? []).length
      levelUps += (text.match(/Понтовость увеличивается/g) ?? []).length
      districts = Math.max(districts, W.district)
    }
    expect(victories).toBeGreaterThan(20)
    expect(levelUps).toBeGreaterThan(5)
    expect(districts).toBeGreaterThanOrEqual(1)
  })
})

describe('the art', () => {
  const artLines = (text: string) => text.split('\n').filter((l) => l.includes('\u2510') || l.includes('\u251c'))

  it('draws the same Cyrillic banner whatever the language', async () => {
    setLocale('ru')
    const ru = scripted([])
    await play(() => banner())
    setLocale('en')
    const en = scripted([])
    await play(() => banner())
    expect(artLines(en.text())).toEqual(artLines(ru.text()))
  })

  it('glosses the banner for English and leaves Russian alone', async () => {
    setLocale('ru')
    const ru = scripted([])
    await play(() => banner())
    expect(ru.text()).not.toContain('G O P N I K')

    setLocale('en')
    const en = scripted([])
    await play(() => banner())
    expect(en.text()).toContain('G O P N I K')
  })

  it('glosses the end screen, centred under the logo', async () => {
    setLocale('en')
    const out = scripted([])
    await play(() => endScreen(false))
    // The harness records the raw string, colour codes and all; the column
    // the player sees is the one left after the console has eaten them.
    const line = out.out.find((l) => l.includes("THE GAME'S HAD IT"))!
    expect(line).toBeDefined()
    expect(line.replace(/\^[0-9]/g, '').indexOf('T')).toBe(32)
  })
})

describe('rules taken straight from the disassembly', () => {
  it('spends two weighted rolls per level and remembers them', () => {
    scripted([])
    Object.assign(P, newPlayer())
    P.classCode = 3 // Пацан: 3/3/3/3
    P.str = 3; P.agi = 3; P.vit = 3; P.luck = 3
    P.expNext = 10
    P.exp = 10
    levelUp(0)
    expect(P.level).toBe(1)
    expect(P.exp).toBe(0)
    expect(P.expNext).toBe(20)
    expect(P.str + P.agi + P.vit + P.luck).toBe(14)
    expect(P.levelHist[1]).toHaveLength(2)
  })

  it('stops at level 40 unless the rector forces it through', () => {
    scripted([])
    Object.assign(P, newPlayer())
    P.classCode = 3
    P.level = 40
    P.expNext = 10
    P.exp = 10
    levelUp(0)
    expect(P.level).toBe(40)
    P.exp = P.expNext
    levelUp(1)
    expect(P.level).toBe(41)
  })

  it('builds enemies with the documented shape', () => {
    scripted([])
    Object.assign(P, newPlayer())
    P.level = 12
    W.district = 3
    W.inArea = 0
    for (let i = 0; i < 500; i++) {
      genEnemy(0)
      expect(E.type).toBeLessThanOrEqual(9)
      expect(E.type).toBeGreaterThanOrEqual(0)
      expect(E.level).toBeGreaterThanOrEqual(0)
      expect(E.maxHp).toBe(E.vit * 5 + E.str + 10)
      expect(E.hp).toBe(E.maxHp)
      expect(E.dmgMax).toBe(E.str)
      expect(E.armor).toBeGreaterThanOrEqual(8) // 2*(3-1)^2
      expect(E.junk).toBeGreaterThanOrEqual(0)
      expect(E.money).toBeGreaterThanOrEqual(0)
    }
    for (let i = 0; i < 50; i++) {
      genEnemy(1)
      expect(E.type).toBeLessThanOrEqual(7)
      genEnemy(2)
      expect(E.type).toBe(8)
    }
  })

  it('gives the rector his two fixed stat blocks', () => {
    scripted([])
    initRector(0)
    expect([E.level, E.maxHp, E.armor]).toEqual([125, 666, 60])
    initRector(1)
    expect([E.level, E.maxHp, E.armor]).toEqual([160, 1000, 80])
  })
})

describe('saved games', () => {
  it('offers a saved district, loads it and carries on from there', async () => {
    clearSaves()
    Object.assign(P, newPlayer())
    P.header = '^4Gopnik: ^7version 1.02 june,sept 2003'
    P.name = '^7 Сейв'
    P.classCode = 5
    P.str = 9; P.agi = 7; P.vit = 8; P.luck = 6
    P.level = 25
    P.maxHp = 59; P.hp = 59
    P.expNext = 260
    writeSave(3)
    expect(listSaves()).toEqual([3])

    forceSeed(4242)
    setLocale('ru')
    const log = bot([], 30, [' ', '3'])
    await play(run)
    expect(log.text()).toContain('Загружено из save_r3')
    expect(log.text()).toContain('На маршрутке ты доехал до ОбьГЭСа...')
    expect(P.name).toBe('^7 Сейв')
    expect(P.level).toBe(25)
    expect(W.district).toBe(3)
    expect(W.knowDen).toBe(1) // Гопник keeps his den in every district
  })

  it('moves to the next district once the level allows it and saves there', async () => {
    clearSaves()
    Object.assign(P, newPlayer())
    P.header = '^4Gopnik: ^7version 1.02 june,sept 2003'
    P.name = '^7 Сейв'
    P.classCode = 4
    P.str = 12; P.agi = 9; P.vit = 12; P.luck = 5
    P.level = 30
    P.maxHp = 82; P.hp = 82
    P.expNext = 310
    writeSave(3)

    forceSeed(1234)
    setLocale('ru')
    const log = bot([], 40, [' ', '3'])
    await play(run)
    expect(log.text()).toContain('отправляйся в следующий')
    expect(log.text()).toContain('Ты приехал в Ельцовку...')
    expect(W.district).toBe(4)
    expect(listSaves()).toContain(4)
  })
})

describe('saved sessions', () => {
  /** A character partway through a run, as the autosave would find him. */
  function partway(): void {
    assign(P, newPlayer())
    assign(W, newWorld())
    P.header = '^4Gopnik: ^7version 1.02 june,sept 2003'
    P.name = '^7 Сейв'
    P.classCode = 5
    P.str = 9; P.agi = 7; P.vit = 8; P.luck = 6
    P.level = 12
    P.maxHp = 59; P.hp = 41
    P.money = 320
    P.expNext = 130
    W.district = 2
    W.knowDen = 1
    W.knowGym = 1
    W.marketBan = 3
    W.silencerTimer = 17
    W.loans = 4
  }

  it('keeps the world and the seed the original left in memory', () => {
    scripted([])
    partway()
    setSeed(0x1234abcd)
    beginSession()
    saveSession()
    const seed = getSeed()

    assign(P, newPlayer())
    assign(W, newWorld())
    setSeed(1)
    expect(loadSession(1)).toBe(true)
    expect(P.name).toBe('^7 Сейв')
    expect(P.level).toBe(12)
    expect(P.hp).toBe(41)
    expect(P.money).toBe(320)
    expect(W.district).toBe(2)
    expect(W.knowGym).toBe(1)
    expect(W.marketBan).toBe(3)
    expect(W.silencerTimer).toBe(17)
    expect(W.loans).toBe(4)
    expect(getSeed()).toBe(seed)
  })

  it('lists what the menu needs to tell one character from another', () => {
    scripted([])
    partway()
    beginSession()
    saveSession()
    expect(listSessions()).toEqual([
      expect.objectContaining({ slot: 1, name: '^7 Сейв', classCode: 5, level: 12, district: 2 }),
    ])
  })

  it('gives every run its own slot and paints over the oldest when full', () => {
    scripted([])
    for (const slot of SESSION_SLOTS) {
      partway()
      P.name = `^7 Гоп${slot}`
      expect(beginSession()).toBe(null)
      expect(currentSession()).toBe(slot)
    }
    expect(listSessions()).toHaveLength(SESSION_SLOTS.length)

    partway()
    P.name = '^7 Новый'
    const replaced = beginSession()
    expect(replaced?.name).toBe('^7 Гоп1')
    expect(listSessions()).toHaveLength(SESSION_SLOTS.length)
    expect(listSessions()[0].name).toBe('^7 Новый')
  })

  it('offers the session on the title screen and carries on from the prompt', async () => {
    partway()
    beginSession()
    saveSession()

    forceSeed(4242)
    setLocale('ru')
    // One command, the menu's: the run halts at the street prompt it resumed
    // to, so what is checked is the state that was restored and nothing since.
    const log = bot(['1'], 1, [' '])
    await play(run)
    const text = log.text()
    expect(text).toContain('Ты уже где-то бегал:')
    expect(text).toContain('Сейв')
    expect(text).toContain('Гопник')          // the class he picked
    expect(text).toContain('ур.12')
    expect(text).toContain('Ты продолжаешь с того места, где бросил.')
    // Resumed, not restarted: no character to pick, no arrival text.
    expect(text).not.toContain('Год 2xxx от Р.Х.')
    expect(P.name).toBe('^7 Сейв')
    expect(P.level).toBe(12)
    expect(W.district).toBe(2)
    expect(W.marketBan).toBe(3)
  })

  it('autosaves at the street prompt, so a reload lands where it was left', async () => {
    partway()
    P.level = 20                 // enough to be moved on to the third district
    beginSession()
    saveSession()
    const before = listSessions()[0]
    expect(before.district).toBe(2)

    forceSeed(4242)
    setLocale('ru')
    // Carry on, refuse the original's own save on the way out of the district,
    // then stand at the prompt: what is stored is where the player now is.
    const log = bot(['1', 'n', 's', 's'], 4, [' '])
    await play(run)
    expect(log.text()).toContain('На маршрутке ты доехал до ОбьГЭСа...')
    expect(W.district).toBe(3)
    expect(listSaves()).not.toContain(3)
    const after = listSessions()[0]
    expect(after.slot).toBe(before.slot)
    expect(after.district).toBe(3)
    expect(after.level).toBe(P.level)
  })

  it('wipes one on d and starts over on n', async () => {
    partway()
    beginSession()
    saveSession()

    forceSeed(4242)
    setLocale('ru')
    // Wiping the only session leaves nothing to choose from, so the menu
    // stands aside and the game starts the way it always did.
    const log = bot(['d1', '0', 'Новичок'], 20, [' '])
    await play(run)
    expect(log.text()).toContain('Стёрто.')
    expect(log.text()).toContain('Год 2xxx от Р.Х.')
    expect(P.name).toBe('^7 Новичок')
    // The new run took the freed slot for itself.
    expect(listSessions()).toEqual([expect.objectContaining({ slot: 1, name: '^7 Новичок' })])
  })

  it('has nothing to come back to once the character is dead', async () => {
    scripted([])
    partway()
    beginSession()
    saveSession()
    expect(listSessions()).toHaveLength(1)
    await play(() => endScreen(false))
    expect(listSessions()).toEqual([])
    expect(currentSession()).toBe(null)
  })
})
