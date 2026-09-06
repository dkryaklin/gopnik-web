/**
 * The game's global variables, laid out the way the data segment of g.exe is:
 * `P` is the 694-byte record that gets saved, `W` is everything the original
 * keeps outside it (district, known places, the current enemy, counters).
 */

export interface Player {
  header: string        // 0x000 string[255]
  name: string          // 0x100 string[255], already carries its colour prefix
  classCode: number     // 0x200  3 Пацан, 4 Отморозок, 5 Гопник, 6 Вор
  str: number           // 0x202
  agi: number           // 0x204
  vit: number           // 0x206
  luck: number          // 0x208
  level: number         // 0x20A
  dmgMin: number        // 0x20C
  dmgMax: number        // 0x20E
  hp: number            // 0x210
  maxHp: number         // 0x212
  jawBroken: number     // 0x214
  legBroken: number     // 0x215
  armor: number         // 0x216
  sunglasses: number    // 0x217
  suitAbibas: number    // 0x218
  boots: number         // 0x219
  leather: number       // 0x21A
  suitAdidas: number    // 0x21B
  bootsCool: number     // 0x21C
  leatherCool: number   // 0x21D
  knuckles: number      // 0x21E
  mobile: number        // 0x21F
  tattoo: number        // 0x220
  cross: number         // 0x221
  ringGs: number        // 0x222
  ringPg: number        // 0x223
  megaRing: number      // 0x224
  ringHeal: number      // 0x225
  knife: number         // 0x226
  beer: number          // 0x227  in halves of a litre
  joints: number        // 0x229
  money: number         // 0x22B
  junk: number          // 0x22D
  cool: number          // 0x22F
  highTurns: number     // 0x231
  exp: number           // 0x232
  expNext: number       // 0x234
  levelHist: string[]   // 0x236 array[1..40] of string[2]
  toothGuard: number    // 0x2AE
  club: number          // 0x2AF
  cleaver: number       // 0x2B0
  pistol: number        // 0x2B1
  silencer: number      // 0x2B2
  bullets: number       // 0x2B3
  churchVisits: number  // 0x2B5
}

export interface Enemy {
  type: number
  level: number
  str: number
  agi: number
  vit: number
  luck: number
  dmgMin: number
  dmgMax: number
  hp: number
  maxHp: number
  jawBroken: number
  legBroken: number
  armor: number
  beer: number
  money: number
  junk: number
}

export interface World {
  district: number
  inArea: number
  knowMarket: number
  knowDealers: number
  knowDen: number
  hasGirl: number
  knowVet: number
  knowClub: number
  knowGym: number
  marketBan: number
  clubBan: number
  denHelpQuest: number
  denJob: number
  silencerTimer: number
  loans: number
  bet: number
  help: number
  rectorMode: number
  evType: number
}

export const SAVE_HEADER = '^4Gopnik: ^7version 1.02 june,sept 2003'

export function newPlayer(): Player {
  return {
    header: '', name: '', classCode: 0,
    str: 0, agi: 0, vit: 0, luck: 0, level: 0,
    dmgMin: 0, dmgMax: 0, hp: 0, maxHp: 0,
    jawBroken: 0, legBroken: 0, armor: 0,
    sunglasses: 0, suitAbibas: 0, boots: 0, leather: 0, suitAdidas: 0,
    bootsCool: 0, leatherCool: 0, knuckles: 0, mobile: 0, tattoo: 0,
    cross: 0, ringGs: 0, ringPg: 0, megaRing: 0, ringHeal: 0, knife: 0,
    beer: 0, joints: 0, money: 0, junk: 0, cool: 0, highTurns: 0,
    exp: 0, expNext: 0,
    levelHist: Array.from({ length: 41 }, () => ''),
    toothGuard: 0, club: 0, cleaver: 0, pistol: 0, silencer: 0, bullets: 0,
    churchVisits: 0,
  }
}

export function newEnemy(): Enemy {
  return {
    type: 0, level: 0, str: 0, agi: 0, vit: 0, luck: 0,
    dmgMin: 0, dmgMax: 0, hp: 0, maxHp: 0,
    jawBroken: 0, legBroken: 0, armor: 0, beer: 0, money: 0, junk: 0,
  }
}

export function newWorld(): World {
  return {
    district: 1, inArea: 0,
    knowMarket: 0, knowDealers: 0, knowDen: 0, hasGirl: 0,
    knowVet: 0, knowClub: 0, knowGym: 0,
    marketBan: 0, clubBan: 0, denHelpQuest: 0, denJob: 0,
    silencerTimer: 0, loans: 0, bet: 0, help: 0, rectorMode: 0, evType: 0,
  }
}

/** The single set of globals the whole program works on, as in the original. */
export const P: Player = newPlayer()
export const E: Enemy = newEnemy()
export const W: World = newWorld()

export function assign<T extends object>(target: T, source: T): void {
  Object.assign(target, source)
}

/** Thrown by Halt() to unwind out of the game, like the DOS program exiting. */
export class HaltGame extends Error {
  constructor() {
    super('halt')
    this.name = 'HaltGame'
  }
}
