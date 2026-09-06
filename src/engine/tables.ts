/** Tables lifted straight out of the data segment of g.exe. */

/** DS:0002 — stat weights per enemy type / player class: STR, AGI, VIT, LUCK. */
export const WEIGHTS: readonly (readonly [number, number, number, number])[] = [
  [1, 2, 1, 2], // 0 Дохляк
  [2, 2, 2, 3], // 1 Нефор
  [2, 2, 2, 2], // 2 Нарк
  [3, 3, 3, 3], // 3 Подтсан    = class Пацан
  [5, 2, 4, 1], // 4 Отморозок  = class Отморозок
  [4, 3, 3, 2], // 5 Гопник     = class Гопник
  [3, 3, 2, 4], // 6 Вор        = class Вор
  [5, 3, 4, 2], // 7 Беспредельщик
  [5, 5, 5, 5], // 8 Мент
  [5, 6, 8, 3], // 9 Маньячок
  [0, 0, 0, 0], // 10 Ректор НГУ — stats are hard-coded in InitRector
]

export const MAX_LEVEL = 40
export const LAST_TITLE = 42

/** DS:0B2E — market prices. */
export const PRICE = {
  hotdog: 2,
  beer: 5,
  glasses: 10,
  abibas: 15,
  boots: 15,
  leather: 25,
  adidas: 30,
  bootsCool: 30,
  leatherCool: 50,
  // DS:0B38 — dealer prices
  joint: 15,
  mobile: 30,
  superJoint: 20,
  tattoo: 10,
  knuckles: 25,
  club: 50,
  pistol: 150,
  ammo: 70,
  silencer: 60,
} as const

/** How much health one 0.5 l of beer restores (printed in the market menu). */
export const BEER_HEAL = 5
