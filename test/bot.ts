import type { DosConsole } from '../src/ui/console'
import { bindConsole } from '../src/engine/io'
import { HaltGame } from '../src/engine/state'

/**
 * A console that plays the game on its own: it reads the prompt it is being
 * asked at and answers something sensible, so a test can run thousands of
 * commands through the real code paths.
 */
export function bot(opening: string[], limit = 4000, keys: string[] = []) {
  const out: string[] = []
  let current = ''
  let asked = 0
  const queue = [...opening]

  const lastLines = (n: number) => out.slice(-n).join('\n')

  const answer = (): string => {
    if (queue.length) return queue.shift()!
    const prompt = current
    const recent = lastLines(3)
    if (prompt.includes('Битва')) return 'k'
    if (recent.includes('Хочешь наехать')) return 'y'
    if (recent.includes('Хочешь сохранить')) return 'y'
    if (recent.includes('Хочешь её зацепить')) return 'y'
    if (recent.includes('хочешь продать')) return 'y'
    if (recent.includes('Ты хочешь сохраниться')) return 'n'
    if (prompt.includes('Базар')) return asked % 3 === 0 ? '2' : 't'
    if (prompt.includes('Барыги')) return 'x'
    if (prompt.includes('Ветеренар')) return 'h'
    if (prompt.includes('Притон')) return 'p'
    if (prompt.includes('Клуб')) return 'p'
    if (prompt.includes('Качалка')) return '1'
    if (prompt.includes('Продать вещи')) return 'y'
    // The street prompt: wander, kick things, and use the places now and then.
    const cycle = ['w', 'w', 'w', 'w', 'mh', 'w', 'rep', 'w', 'w', 'mar',
                   'w', 'w', 'bmar', 'w', 'w', 'pr', 'w', 'w', 'trn', 'w',
                   'w', 'kl', 'w', 'w', 'girl', 'w', 'w', 's', 'w', 'w']
    return cycle[asked % cycle.length]
  }

  const con = {
    write(text: string) { current += text },
    writeLine(text: string) { out.push(current + text); current = '' },
    writeArtLine(text: string) { out.push(current + text); current = '' },
    clear() { current = '' },
    delay() { return Promise.resolve() },
    readKey() { return Promise.resolve(keys.shift() ?? ' ') },
    readLine() {
      if (++asked > limit) throw new HaltGame()
      const value = answer()
      out.push(current + value)
      current = ''
      return Promise.resolve(value)
    },
  }
  bindConsole(con as unknown as DosConsole)
  return { out, text: () => out.join('\n'), commands: () => asked }
}
