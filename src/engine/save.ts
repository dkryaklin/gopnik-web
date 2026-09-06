/**
 * Saved games. The bytes are exactly the 694-byte record the original writes
 * with BlockWrite, and places.sav is the same 7 flag bytes; they just live in
 * localStorage instead of the current directory.
 *
 * Below them sits something the original never needed: a saved session per
 * playthrough, so that closing the tab is not the same as dying.
 */

import { P, W, assign, newPlayer, newWorld, type Player, type World } from './state'
import { getSeed, setSeed } from './rng'
import { encodeCp866, decodeCp866 } from './cp866'

export const SAVE_SIZE = 694
export const PLACES_SIZE = 7
const PREFIX = 'gopnik.'
const memory = new Map<string, string>()

export const SAVE_SLOTS = [0, 2, 3, 4, 5] as const

function read(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return memory.get(key) ?? null
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    memory.set(key, value)
  }
}

function drop(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    memory.delete(key)
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(text: string): Uint8Array | null {
  try {
    const raw = atob(text)
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}

function putString(view: DataView, at: number, s: string, max: number): void {
  const bytes = encodeCp866(s).slice(0, max)
  view.setUint8(at, bytes.length)
  for (let i = 0; i < bytes.length; i++) view.setUint8(at + 1 + i, bytes[i])
}

function getString(bytes: Uint8Array, at: number, max: number): string {
  const len = Math.min(bytes[at], max)
  return decodeCp866(bytes.subarray(at + 1, at + 1 + len))
}

const WORDS: [number, keyof Player][] = [
  [0x200, 'classCode'], [0x202, 'str'], [0x204, 'agi'], [0x206, 'vit'],
  [0x208, 'luck'], [0x20a, 'level'], [0x20c, 'dmgMin'], [0x20e, 'dmgMax'],
  [0x210, 'hp'], [0x212, 'maxHp'], [0x227, 'beer'], [0x229, 'joints'],
  [0x22b, 'money'], [0x22d, 'junk'], [0x22f, 'cool'], [0x232, 'exp'],
  [0x234, 'expNext'], [0x2b3, 'bullets'],
]

const BYTES: [number, keyof Player][] = [
  [0x214, 'jawBroken'], [0x215, 'legBroken'], [0x216, 'armor'],
  [0x217, 'sunglasses'], [0x218, 'suitAbibas'], [0x219, 'boots'],
  [0x21a, 'leather'], [0x21b, 'suitAdidas'], [0x21c, 'bootsCool'],
  [0x21d, 'leatherCool'], [0x21e, 'knuckles'], [0x21f, 'mobile'],
  [0x220, 'tattoo'], [0x221, 'cross'], [0x222, 'ringGs'], [0x223, 'ringPg'],
  [0x224, 'megaRing'], [0x225, 'ringHeal'], [0x226, 'knife'],
  [0x231, 'highTurns'], [0x2ae, 'toothGuard'], [0x2af, 'club'],
  [0x2b0, 'cleaver'], [0x2b1, 'pistol'], [0x2b2, 'silencer'],
  [0x2b5, 'churchVisits'],
]

export function encodePlayer(p: Player): Uint8Array {
  const bytes = new Uint8Array(SAVE_SIZE)
  const view = new DataView(bytes.buffer)
  putString(view, 0x000, p.header, 255)
  putString(view, 0x100, p.name, 255)
  for (const [at, key] of WORDS) view.setUint16(at, (p[key] as number) & 0xffff, true)
  for (const [at, key] of BYTES) view.setUint8(at, (p[key] as number) & 0xff)
  for (let level = 1; level <= 40; level++) {
    putString(view, 0x236 + (level - 1) * 3, p.levelHist[level] ?? '', 2)
  }
  return bytes
}

export function decodePlayer(bytes: Uint8Array): Player {
  const p = newPlayer()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  p.header = getString(bytes, 0x000, 255)
  p.name = getString(bytes, 0x100, 255)
  for (const [at, key] of WORDS) (p[key] as number) = view.getInt16(at, true)
  for (const [at, key] of BYTES) (p[key] as number) = view.getUint8(at)
  for (let level = 1; level <= 40; level++) {
    p.levelHist[level] = getString(bytes, 0x236 + (level - 1) * 3, 2)
  }
  return p
}

/** Which save_r<n>.sav files exist, in the order FindFirst would report them. */
export function listSaves(): number[] {
  return SAVE_SLOTS.filter((n) => read(`save_r${n}`) !== null)
}

export function writeSave(slot: number): void {
  store(`save_r${slot}`, toBase64(encodePlayer(P)))
}

/** Returns false when the file cannot be read, like a failed Reset(). */
export function readSave(slot: number): Player | null {
  const text = read(`save_r${slot}`)
  if (text === null) return null
  const bytes = fromBase64(text)
  if (!bytes || bytes.length < SAVE_SIZE) return null
  return decodePlayer(bytes)
}

export function writePlaces(): void {
  const bytes = Uint8Array.from([
    W.knowMarket, W.knowDealers, W.knowDen, W.hasGirl,
    W.knowVet, W.knowClub, W.knowGym,
  ])
  store('places', toBase64(bytes))
}

export function readPlaces(): boolean {
  const text = read('places')
  if (text === null) return false
  const bytes = fromBase64(text)
  if (!bytes || bytes.length < PLACES_SIZE) return false
  W.knowMarket = bytes[0]
  W.knowDealers = bytes[1]
  W.knowDen = bytes[2]
  W.hasGirl = bytes[3]
  W.knowVet = bytes[4]
  W.knowClub = bytes[5]
  W.knowGym = bytes[6]
  return true
}

export function clearSaves(): void {
  for (const n of SAVE_SLOTS) drop(`save_r${n}`)
  drop('places')
  for (const n of SESSION_SLOTS) drop(sessionKey(n))
  current = null
}

// ---- saved sessions (not in the original) ---------------------------------

/**
 * The original saves a character, not a game: SAVE_R<n>.SAV is written when you
 * move on to the next district or pay the mage, and it holds the 694-byte
 * record and nothing else - the district you are in, the places you have found
 * and the seed all live in memory until DOS is done with them.
 *
 * A browser tab is closed at any moment and reopened later, so the web build
 * also keeps one session per playthrough, written at every street prompt: the
 * same 694 bytes, base64'd, plus the globals the original kept outside them.
 * Reloading the page carries on at the prompt the player walked away from.
 */

export const SESSION_SLOTS = [1, 2, 3, 4, 5] as const

/** What the menu on the title screen needs to tell one session from another. */
export interface SessionInfo {
  slot: number
  name: string
  classCode: number
  level: number
  district: number
  at: number
}

interface SessionFile extends Omit<SessionInfo, 'slot'> {
  v: 1
  seed: number
  p: string          // the 694-byte record, base64
  w: World
}

/** The slot the run in progress is autosaved into. */
let current: number | null = null

function sessionKey(slot: number): string {
  return `session${slot}`
}

function readSession(slot: number): SessionFile | null {
  const text = read(sessionKey(slot))
  if (text === null) return null
  try {
    const data = JSON.parse(text) as SessionFile
    if (!data || data.v !== 1 || typeof data.p !== 'string') return null
    return data
  } catch {
    return null
  }
}

function writeSession(slot: number): void {
  const file: SessionFile = {
    v: 1,
    at: Date.now(),
    seed: getSeed(),
    name: P.name,
    classCode: P.classCode,
    level: P.level,
    district: W.district,
    p: toBase64(encodePlayer(P)),
    w: { ...W },
  }
  store(sessionKey(slot), JSON.stringify(file))
}

/** A world read back from storage, with anything missing left at its default. */
function toWorld(raw: unknown): World {
  const world = newWorld()
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(world) as (keyof World)[]) {
      const value = (raw as Record<string, unknown>)[key]
      if (typeof value === 'number' && Number.isFinite(value)) world[key] = value
    }
  }
  return world
}

/** The sessions there are, by slot, which is the order the menu lists them in. */
export function listSessions(): SessionInfo[] {
  const out: SessionInfo[] = []
  for (const slot of SESSION_SLOTS) {
    const data = readSession(slot)
    if (data) {
      out.push({
        slot,
        name: data.name ?? '',
        classCode: data.classCode ?? 0,
        level: data.level ?? 0,
        district: data.district ?? 1,
        at: data.at ?? 0,
      })
    }
  }
  return out
}

/**
 * Claims a slot for a run that is starting. Returns the session it painted over
 * when every slot was taken - the oldest one - so the player can be told.
 */
export function beginSession(): SessionInfo | null {
  const taken = listSessions()
  const free = SESSION_SLOTS.find((slot) => !taken.some((s) => s.slot === slot))
  let replaced: SessionInfo | null = null
  if (free !== undefined) {
    current = free
  } else {
    replaced = taken.reduce((a, b) => (a.at <= b.at ? a : b))
    current = replaced.slot
  }
  writeSession(current)
  return replaced
}

/** Called at every street prompt; does nothing until a slot has been claimed. */
export function saveSession(): void {
  if (current !== null) writeSession(current)
}

/** Restores the player, the world and the seed, and autosaves there from now on. */
export function loadSession(slot: number): boolean {
  const data = readSession(slot)
  if (!data) return false
  const bytes = fromBase64(data.p)
  if (!bytes || bytes.length < SAVE_SIZE) return false
  assign(P, decodePlayer(bytes))
  assign(W, toWorld(data.w))
  setSeed(data.seed >>> 0)
  current = slot
  return true
}

export function eraseSession(slot: number): void {
  drop(sessionKey(slot))
  if (current === slot) current = null
}

/** The run is over: a character who died or won has nothing to come back to. */
export function endSession(): void {
  if (current !== null) eraseSession(current)
  current = null
}

export function currentSession(): number | null {
  return current
}
