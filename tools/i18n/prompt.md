# Translating ГОПНИК.EXE

You are localising **ГОПНИК v1.02**, a Russian MS-DOS text RPG from 2003. The
player is a student expelled from his university in Novosibirsk who goes out to
prove himself by kicking in every gopnik in the city, district by district.

A *gopnik* is a Russian street thug of the late 90s: tracksuit, squatting on his
heels, sunflower seeds, cheap beer, "got a smoke?". The original text is written
the way those lads actually talked — crude, aggressive, teenage, full of slang,
with the author's own typos and missing punctuation left in. It is not polite and
it is not literary. Nothing about it is neutral.

The swearing is not incidental to this game, it is the game. The player is a
thug; every character he meets insults him and he insults them back, and the
comedy is in how far over the top it goes. A translation that tones the insults
down is a worse translation — it makes the characters sound like people they are
not, and it throws away the only thing the writing has. So render an insult as
an insult of the same weight in the target language: if the Russian calls
someone a "мудак" or a "гнида", reach for the word your readers would actually
use in a fight, not the polite one a subtitler would pick. This is a work of
fiction from 2003, the speech belongs to its characters, and it is being
preserved, not authored anew.

## What you are given

- **`## Russian original`** — the whole catalogue as the author wrote it. This is
  the source of truth for meaning and register.
- **`## English rendering`** — the same catalogue rendered as British street
  slang. It shows what a *good* localisation of this game looks like: it does not
  translate word for word, it finds the same kind of voice in another language.
- **`## Already translated`** — what you have produced for this language so far.
  Match it. Reuse its wording for anything recurring: enemy names, district
  names, item names, the words for beer, joints, cash, kicking someone in.
- **`## Batch`** — a JSON array of `{ key, ru, en }`. These are the ones to do.

## What to produce

For every key in the batch, the line as a native writer of the target language
would have written it for this game. Not a translation of the English, and not a
translation of the Russian: the same joke, the same insult, the same volume, in
the street register that language's own teenagers use.

- **Find the local equivalent of a gopnik.** Every language has these lads and a
  word for them: 小混混 / 不良 / ヤンキー / macarra / manguaça / racaille /
  Prolet / preman. Use the word your readers would use, and keep using the same
  one — it is the title of the game.
- **Keep the crudeness.** "Дебил", "урод", "чмо", "мудак" are insults, not
  descriptions. Render them as insults of the same weight. Do not soften, do not
  clean up, do not add politeness the original does not have.
- **Translate what an insult does, never what it means.** These words are shouted
  in a fight; what matters is the force, not the dictionary entry. "Урод" is
  literally a deformed person, but that is not what it does — it does what
  "arsehole" does, which is how the English renders it, and it wants the word
  your readers would actually shout, not their word for an eccentric or an
  oddity. The same goes for "гнида" (a nit), "козёл" (a goat) and "чмо": pick by
  the sting, never by the image.
- **Do not spend an enemy's name on an insult.** The words at `type.0` to
  `type.10` are printed constantly — "Идет {type} # уровня" — so a player reads
  them as names, not descriptions. If you also use one of them to swear with,
  "Сдохни урод!!" stops being an insult and starts looking like it is naming the
  thing you are fighting. Keep the eleven type words out of the shouting.
- **Keep the sloppiness.** The original does not put a space after a comma, ends
  sentences with "..", spells things wrong. Where that is natural in the target
  language, keep it. Never make the text tidier than the original.
- **Adapt the local colour.** Novosibirsk places (Шлюз, ОбьГЭС, Ельцовка,
  Искитим) are districts of a real city: never swap in one of your own, and see
  rule 11 for how to render each. Roubles stay roubles.
- **Short lines stay short.** This is an 80-column DOS screen from 2003.

## Rules that are not about style

These are mechanical and the game breaks if you get them wrong.

1. **`#` is an integer slot.** Each `#` is filled in with a number, in order.
   Your line must contain exactly as many `#` as the English one, and they must
   stand in positions where the same numbers make sense. Never add or drop one,
   never turn one into a digit.
2. **`^0`..`^7` are colour codes**, and `^{c}`, `^{c1}`.. are colour codes the
   game fills in. Keep every one of them, in the same order, attached to the
   same piece of text. They take up no space on screen.
3. **`{name}`, `{type}`, `{title}`, `{flags}`, `{n}` are placeholders.** Keep
   them spelled exactly as they are. `{type}` and `{title}` are substituted with
   text you are also translating in this catalogue, so leave grammar around them
   loose enough to work — the original does the same.
4. **Single letters and words at a `^` code are keystrokes, not words.** In
   "жми ^6w^7 чтобы искать" or "Напиши ^{c}p^7", the `w` and `p` are keys on the
   player's keyboard. So are `i`, `k`, `s`, `run`, `help`, `mar`, `kos`, `hp`.
   Never translate or capitalise them.
5. **Leading and trailing spaces are layout.** A line that starts with a run of
   spaces is centred on the screen by hand; keep it roughly centred, the padding
   will be corrected afterwards. A line that *ends* with a space is glued to the
   next thing printed — keep that space.
6. **Never exceed 80 columns.** Chinese and Japanese characters take two columns
   each; everything else takes one. Colour codes take none. Rewrite shorter
   rather than run over — German and Portuguese will need it.
7. **The class menu and the enemy types are the same four words.** `intro.class0`
   to `intro.class3` and `intro.desc0` to `intro.desc3` name what the player
   chooses to be; `type.3` to `type.6` name the same four kinds of person, in the
   same order, and the game prints the `type.` one back at him on his own stats
   screen. So `intro.class2` must use exactly the word `type.5` uses, `class1`
   the word of `type.4`, `class3` the word of `type.6`. Pick a word once and use
   it in both places, or the player chooses one thing and is called another.
   (`type.3` alone is spelled wrong in the original — a slip of the author's, and
   the English keeps it as "Ladd". Match `intro.class0` to the correct spelling.)
8. **`title.0` to `title.42` are one ladder.** They are the forty-three rungs of
   the player's reputation, climbed one level at a time from "Punked" to "The
   Lad Who Floored Them All", and each is printed next to his level. No two may
   read the same — a rung that repeats the one below it means levelling up
   changes nothing on screen. Check the ones already translated before you add
   another, and keep them getting better as the number goes up.

   The ladder climbs through **named ranks**, and each rank owns a stretch of
   rungs: scum (ЧМО) at the bottom, then the dude (Чувак, rungs 9-17), then the
   lad (Пацан, rungs 18-42, getting steadily more "real"). Inside a stretch the
   noun never changes and only the words around it do — Пацан, Пацан покруче,
   Понтовый Пацан — so the player watches one word he is climbing towards.

   Each rank needs **its own noun**, different from the other ranks': the dude of
   rung 10 cannot be the same word as the lad of rung 21, or the ladder repeats
   itself and stops meaning anything. The lad is the `intro.class0` word, the one
   at `type.3`; it is **not** the gopnik of `type.5`, which is a different person
   again.
9. **`art.banner`, `art.endLogo` and `art.win` are glosses under the artwork.**
   The logo itself is Cyrillic drawn out of box characters and stays that way in
   every language, so these lines sit underneath and say what it reads. Write
   them in your own language and your own script — never leave the Latin
   "G O P N I K" standing, and never transliterate the Russian. `art.banner` is
   the title of the game, which is your word for a gopnik, spaced out one
   character at a time the way the English spaces "G O P N I K". Russian leaves
   all three empty, because its artwork already reads as Russian.
10. **Punctuate the way the original does.** A speaker label is followed by a
    plain ASCII colon — "Враг:", "Зрители:", "Телефон:" — and so is every label
    in the stats screen. Chinese and Japanese: use the ASCII ":" there too, never
    the full-width "：". It costs two columns instead of one, the original never
    uses it, and mixing the two within one catalogue looks like a mistake. Full-
    width 、 and 。 inside a sentence are fine and correct.
11. **This is a translation, not a relocation.** The game happens in
    Novosibirsk in 2003 and it stays there. The money is **roubles**, always:
    write your language's word for a rouble, never your own currency and never a
    generic slang unit that implies one — not pavos, not balles, not contos, not
    元 or 円. Slang for money in general (бабки — cash, dosh, pasta, grana) is
    fine and right where the Russian is being slangy, but the moment a price or
    an amount is named, it is named in roubles.

    Place names are districts of a real city, not descriptions. Ельцовка and
    Искитим mean nothing even to a Russian, so transliterate them into your own
    script the way your language usually transliterates Russian. Шлюз and
    ОбьГЭС do mean something — the river lock and the Ob hydro station the two
    districts grew up around — so either transliterate them as well or render
    what they mean, the way the English says "the Locks" and "the Ob Dam".
    Choose one of the two and use it for both: translating one of the pair and
    transliterating the other reads like a mistake. Never leave the English
    word standing — write them in your own script. The same goes for СУНЦ and НГУ, the
    university and its prep school: keep them, they are the whole reason the
    player was expelled.
12. **Empty stays empty.** If the English is `''`, return `''`.

## Output

Raw JSON only, no markdown fence and no commentary: an array with one object per
key of the batch, `key` exactly as it was given and `text` your line.

```
[{"key": "common.died", "text": "..."}, {"key": "fight.miss", "text": "..."}]
```

Answer every key of the batch, and no key that was not in it. Do not echo the
`ru` and `en` fields back.
