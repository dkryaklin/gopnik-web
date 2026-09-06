/**
 * Turbo Pascal 7 pseudo-random numbers, bit for bit.
 *
 *   RandSeed := RandSeed * 134775813 + 1        (32-bit, wrapping)
 *   Random(n) = (RandSeed * n) shr 32           (RandSeed unsigned)
 *
 * Same seed, same game: a run can be replayed exactly like the DOS original.
 */
let randSeed = 0
let forced: number | null = null

/** Pins the seed so a run can be replayed; pass null to go back to random. */
export function forceSeed(seed: number | null): void {
  forced = seed
}

export function randomize(): void {
  // The original seeds from the BIOS timer; any 32-bit value will do.
  setSeed(forced ?? ((Date.now() ^ (Math.random() * 0x100000000)) >>> 0))
}

export function setSeed(seed: number): void {
  randSeed = seed >>> 0
}

export function getSeed(): number {
  return randSeed
}

/** Random(n): a uniform integer in 0..n-1 (0 when n <= 0, as in Pascal). */
export function random(n: number): number {
  randSeed = (Math.imul(randSeed, 134775813) + 1) >>> 0
  if (n <= 0) return 0
  return Math.floor((randSeed * n) / 4294967296)
}

/** Pascal's Round for the software Real type: halves go away from zero. */
export function round(x: number): number {
  return x < 0 ? -Math.floor(-x + 0.5) : Math.floor(x + 0.5)
}

/** Pascal's div: truncating integer division. */
export function div(a: number, b: number): number {
  return Math.trunc(a / b)
}

/** 8-bit truncation, for the places where the original stores into a byte. */
export function byte(x: number): number {
  return x & 0xff
}

/** 16-bit signed truncation, for the places where it stores into an integer. */
export function word(x: number): number {
  return (x << 16) >> 16
}
