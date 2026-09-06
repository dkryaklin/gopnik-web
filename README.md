# ГОПНИК.EXE

A browser remaster of **ГОПНИК v1.02**, the 2003 MS-DOS text RPG by V.P.

No emulator. The game was disassembled and its rules rewritten in TypeScript, so the
port keeps the original's arithmetic, its random number generator, its 80x25 CP866
screen — and its bugs. The original DOS release lives in [xpl/gop](https://github.com/xpl/gop).

```
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static site in dist/
pnpm test       # engine tests, including an autoplaying bot
```

## As in the original

- **The same numbers.** Turbo Pascal 7's generator (`RandSeed * 134775813 + 1`, result
  `(RandSeed * n) shr 32`), so a seed replays a run exactly as the DOS build would.
- **The same bugs.** The club that only adds damage if you already own knuckles, the
  silencer priced at 70 and charged 60, the mage who advertises `district*25` and takes
  `district*50`. They are reproduced, not fixed.
- **The same font.** `pnpm font` extracts the CP866 8x16 VGA bitmap font from
  `tools/font/KEYRUS.COM` — the driver the game is started with in DOS — and builds a
  TrueType file from it.
- **The same saves.** `localStorage` holds the original's 694-byte record plus the
  7-byte `places` file, byte-identical to `SAVE_R?.SAV` on disk. The web build adds an
  autosave at every street prompt, so a closed tab resumes with the same rolls.

Two things give way to the browser: the screen scales to the window and falls back to
fewer columns on a phone, and lines wrap on words instead of mid-cell, since no
translation fits 80 columns the way the author hand-fitted his Russian.

## Languages

Russian, English, Chinese, Japanese, Spanish, Portuguese, French, German, Indonesian.
The Russian is the original CP866 text transcribed verbatim, typos included. The rest
were translated with `tools/i18n`, which checks every line back: the same `#` argument
slots, the same `^N` colour codes, and a width that still fits the screen.

```
GOOGLE_GENERATIVE_AI_API_KEY=... pnpm i18n all
```

## Layout

```
src/engine/   the game: rules, combat, places, saves, RNG
src/i18n/     the nine message catalogues
src/ui/       the DOS screen, the blocking console, browser chrome
test/         engine tests and the autoplaying bot
docs/         gopnik-logic.md, the rules spec recovered from the binary
tools/re/     the disassembler lift the spec was read off
tools/font/   KEYRUS.COM and the script that turns its bitmap font into a TTF
```

`src/engine` never touches the DOM — it talks to `io`, which talks to a console. That is
what lets the tests play thousands of commands headlessly.

`g.exe` is not vendored here. Point the lifter at a copy to regenerate the listing:

```
pip install capstone
python3 tools/re/lift.py path/to/g.exe
```

## Credits

Original game by V.P., 2003. Remaster by [dkryaklin.com](https://dkryaklin.com).
