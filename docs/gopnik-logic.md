# ГОПНИК v1.02 — reverse-engineered game logic

Source: `g.exe` (88 656 bytes, Turbo Pascal 7 real-mode EXE, strings in CP866), the original
DOS release, kept in [xpl/gop](https://github.com/xpl/gop) under `src/gop/`.
Everything below was recovered from the disassembly; see `tools/re/` for the scripts and the
annotated listing (`g.exe.lifted.txt`), and `docs/strings.txt` for every in-game string with its
code address. Address references in this document (`0xNNNN`) are offsets in that listing.

Terminology: "coolness" = *понтовость*, "level" = *уровень крутизны*, "district" = *район*,
"exp" = *качки опыта*, "den" = *притон*, "dealers" = *барыги*, "vet" = *ветеринар* (the hospital).

---

## 1. Binary layout (for verification)

| Segment | Content |
|---|---|
| `0000` | main program (all game code, one 61 KB segment) |
| `EE50` | Dos unit fragment: FindFirst/FindNext (save-file discovery) |
| `EED0` | author's print unit: `Print`, `PrintLn`, `LowerCase` |
| `F160` | Crt |
| `F780` | System |
| `10AE0` | data segment (DS): tables at the start, globals from `DS:3692` |

`Print(s, a, b, c, d, e)` writes `s`; each `#` is replaced by the next integer argument, and
`^0`..`^7` switch the text colour to `TextColor(8 + digit)`: `^0` dark grey, `^1` light blue,
`^2` light green, `^3` light cyan, `^4` light red, `^5` light magenta, `^6` yellow, `^7` white.
Colour is reset to white (15) after every call. `PrintLn` is `Print` + newline. All user input is
`ReadLn` into a string, then lower-cased (ASCII letters only).

`Random(n)` is Turbo Pascal's `Random(n)` = uniform integer in `0..n-1`, from the TP7 generator
`RandSeed := RandSeed * 134775813 + 1`, result `(RandSeed * n) shr 32`.

Bare `WriteLn` calls carry a lot of the layout: the banner is preceded by 5 blank lines and
separated from its three footer lines by 1, 3 and 4 more; the end screen uses 2/3/5/4; the intro,
the church and the den each add one in the places noted below.

---

## 2. Data model

### 2.1 Player record (saved verbatim; 694 bytes, `DS:369C..3951`)

| Save offset | Type | Name | Meaning |
|---|---|---|---|
| 0x000 | string[255] | saveHeader | `"^4Gopnik: ^7version 1.02 june,sept 2003"` |
| 0x100 | string[255] | playerName | `"^7 " + name` (name defaults to `Раз^6дол^4бай`) |
| 0x200 | word | classCode | 3 Пацан, 4 Отморозок, 5 Гопник, 6 Вор (= menu choice + 3; same index as enemy-type table) |
| 0x202 | word | STR | Сила |
| 0x204 | word | AGI | Ловкость |
| 0x206 | word | VIT | Живучесть |
| 0x208 | word | LUCK | Удача |
| 0x20A | word | level | уровень крутизны (0..40, 41/42 after the rector) |
| 0x20C | word | dmgMin | minimum damage (урон) |
| 0x20E | word | dmgMax | maximum damage |
| 0x210 | word | HP | здоровье |
| 0x212 | word | maxHP | |
| 0x214 | byte | jawBroken | сломана челюсть |
| 0x215 | byte | legBroken | сломана нога |
| 0x216 | byte | armor | броня |
| 0x217 | byte | sunglasses | тёмные очки |
| 0x218 | byte | suitAbibas | костюм abibas |
| 0x219 | byte | boots | понтовые бутсы |
| 0x21A | byte | leather | кожанка |
| 0x21B | byte | suitAdidas | костюм adidas |
| 0x21C | byte | bootsCool | понтовейшие бутсы |
| 0x21D | byte | leatherCool | ваще крутая кожанка |
| 0x21E | byte | knuckles | кастет |
| 0x21F | byte | mobile | мобильник |
| 0x220 | byte | tattoo | зоновская наколка |
| 0x221 | byte | cross | крестик (Удача +2) |
| 0x222 | byte | ringGs | кольцо "Гс" (Удача +1) |
| 0x223 | byte | ringPg | кольцо "Пг" (всё +1) |
| 0x224 | byte | megaRing | Мега Кольцо (всё +4) |
| 0x225 | byte | ringHeal | кольцо "Гп" (самолечение) |
| 0x226 | byte | knife | нож |
| 0x227 | word | beer | beer count, each unit = 0.5 л |
| 0x229 | word | joints | косяки |
| 0x22B | word | money | бабки (рубли) |
| 0x22D | word | junk | хлам (sellable at dealers for its face value) |
| 0x22F | word | cool | понтовость |
| 0x231 | byte | highTurns | turns of drug high left (обдолбаный) |
| 0x232 | word | exp | current exp |
| 0x234 | word | expNext | exp needed for next level |
| 0x236 | array[1..40] of string[2] | levelHist | which stats were gained at each level (`'1'` STR, `'2'` AGI, `'3'` VIT, `'4'` LUCK); used to undo a level when you run from a fight |
| 0x2AE | byte | toothGuard | зубная защита |
| 0x2AF | byte | club | дубинка |
| 0x2B0 | byte | cleaver | тесак |
| 0x2B1 | byte | pistol | пистолет |
| 0x2B2 | byte | silencer | глушитель |
| 0x2B3 | word | bullets | патроны |
| 0x2B5 | byte | churchVisits | how many times God has been met (0, 1, 2+) |

Everything starts at 0 (uninitialised BSS) except what §4 sets.

### 2.2 Known places (7 bytes, saved only by the mage to `places.sav`)

`knowMarket, knowDealers, knowDen, hasGirl, knowVet, knowClub, knowGym` (in this file order).
`district` (byte, 1..5) and `inArea` (byte, toggled by random event 1) are not saved; `district`
is derived from the save-file name.

### 2.3 Enemy record (transient)

`eType` (0..10), `eLevel`, `eSTR, eAGI, eVIT, eLUCK`, `eDmgMin, eDmgMax`, `eHP, eMaxHP`,
`eJawBroken, eLegBroken`, `eArmor`, loot `eBeer, eMoney, eJunk`.

### 2.4 Other transient state

`fightFlag`, `marketBan` / `clubBan` (turn counters, 5 after being chased out), `denHelpQuest`,
`denJob`, `silencerTimer` (0..25), `loans` (den credit counter, starts at 5), `bet` (club, starts
at 5 each visit), `help` (reinforcement counter in a fight), `rectorMode`.

---

## 3. Tables

### 3.1 Stat weights (DS:0000, 4 bytes per row, index = enemy type / classCode)

| idx | Name | STR | AGI | VIT | LUCK | Notes |
|---|---|---|---|---|---|---|
| 0 | Дохляк | 1 | 2 | 1 | 2 | |
| 1 | Нефор | 2 | 2 | 2 | 3 | loot: cross / ring Гс / mobile |
| 2 | Нарк | 2 | 2 | 2 | 2 | may drop joints |
| 3 | Подтсан | 3 | 3 | 3 | 3 | = player class Пацан |
| 4 | Отморозок | 5 | 2 | 4 | 1 | = player class Отморозок |
| 5 | Гопник | 4 | 3 | 3 | 2 | = player class Гопник |
| 6 | Вор | 3 | 3 | 2 | 4 | = player class Вор |
| 7 | Беспредельщик | 5 | 3 | 4 | 2 | loot: sunglasses / mobile |
| 8 | Мент | 5 | 5 | 5 | 5 | the cop |
| 9 | Маньячок | 5 | 6 | 8 | 3 | loot: knife / cleaver |
| 10 | Ректор НГУ | – | – | – | – | stats hard-coded (§13) |

The row sum is 12 for the four player classes: on each level-up roll, stat *i* is chosen with
probability `weight_i / 12`.

### 3.2 Class starting stats (also equal to the table row)

| Class | STR | AGI | VIT | LUCK | Bonus |
|---|---|---|---|---|---|
| 0 Пацан | 3 | 3 | 3 | 3 | starts with girlfriend and club known; both survive district changes |
| 1 Отморозок | 5 | 2 | 4 | 1 | +1 HP every `w` turn |
| 2 Гопник | 4 | 3 | 3 | 2 | den known from the start; survives district changes |
| 3 Вор | 3 | 3 | 2 | 4 | dealers known at start; finds money on `w` turns (§6) |

### 3.3 Coolness titles (DS:0B42, one per level 0..42)

0 Опущеный · 1 Полное ЧМО · 2 ЧМО · 3 Частично не ЧМО · 4 Чё-то не понятное · 5 Чё-то отдалённо похожее на не ЧМО · 6 Вроде не ЧМО · 7 Не ЧМО · 8 Совсем не ЧМО · 9 Похожий на Чувака · 10 Чувак · 11 Нормальный Чувак · 12 Да нормальный такой Чувак · 13 Довольно понтовый Чувак · 14 Понтовый Чувак · 15 Вполне понтовый Чувак · 16 Очень понтовый Чувак · 17 Чувак отдалённо пожоий на Пацана · 18 Похожий на Пацана · 19 Сильно похожий на Пацана · 20 Вроде Пацан · 21 Пацан · 22 Пацан покруче · 23 Понтоватый Пацан · 24 Понтовый Пацан · 25 Очень понтовый Пацан · 26 Крутой Пацан · 27 Очень крутой Пацан · 28 Пацан метящий в реальные · 29 Почти реальный Пацан · 30 Довольно реальный Пацан · 31 Реальный Пацан · 32 Пацан немного более реальный · 33 Пацан ещё реальнее · 34 Очень реальный Пацан · 35 Офигенно реальный Пацан · 36 Да типа ваще реальный Пацан · 37 Смотри не лопни от реальности, Реальный Пацан · 38 Крутой Реальный Пацан · 39 Очень крутой Реальный Пацан · 40 Самый Крутой Реальный Пацан · 41 Пацан, который завалил Проректора СУНЦа · 42 Пацан, который всех опрокинул

Enemy titles use the same table by `eLevel`; above 40 the title is "Не в этой жизни.".

### 3.4 Prices (DS:0B2E)

Market: hotdog 2, beer 5, sunglasses 10, abibas 15, boots 15, leather 25, adidas 30, cool boots 30,
cool leather 50.
Dealers: joint 15, mobile 30, super joint 20, tattoo 10, knuckles 25, club 50, pistol 150,
ammo 70, silencer 60.

Fixed prices elsewhere: vet 3 / 7, girlfriend 12, club disco 15, club cheats 22, gym 20 / 20 / 10 / 30 / 20.

---

## 4. Game start

1. Banner screen (`Banner`), wait for a key, `Randomize`.
2. Directory scan for `save_r?.sav`. If any exist: list them ("Можно начать с N района", or
   "…с того места где ты сохранился" for `save_r0`), then read one key:
   - `0`, `2`, `3`, `4`, `5` → load `save_r<key>.sav` (694 bytes into the player record),
     `district := key`. If the file cannot be opened → default to a new game.
   - For `save_r0` (mage save) also read `places.sav` (7 flags). If that fails the flags are reset
     (class bonuses kept). Then `district := level div 10 + 1`.
   - For `save_r2..5` the known-place flags are **not** restored (they stay 0), only class
     bonuses are applied afterwards.
   - `1` or anything else → new game.
3. New game: `district := 1`, `knowVet := 1`, `knowMarket := 1`, `expNext := 10`, header string
   set, intro text, class menu `0..3` (`4` prints class descriptions and asks again; invalid → 0),
   `classCode := choice + 3`, stats from §3.2, then
   `maxHP := VIT*5 + 10 + STR`, `HP := maxHP`, `dmgMin := STR div 2`, `dmgMax := STR`.
   Name prompt; empty → `Раз^6дол^4бай`; stored as `"^7 " + name`.
4. District arrival text; district 5 sets `rectorMode := 1`. Class bonus flags: Гопник →
   `knowDen`; Пацан → `hasGirl, knowClub`; Вор → `knowDealers`. `loans := 5`.

---

## 5. Main loop

Each iteration:

1. **District advance check**: if `district*10 <= level` and `district < 5`:
   `district += 1`; reset `knowVet, knowMarket, knowGym, knowDealers, marketBan, clubBan` to 0;
   reset `knowClub` and `hasGirl` unless Пацан (code 3); reset `knowDen` unless Гопник (code 5).
   Ask "Хочешь сохранить свои достижения?" — `y` writes `save_r<district>.sav` (694 bytes).
   Print the travel text (2 Шлюз, 3 ОбьГЭС, 4 Ельцовка, 5 rector). District 5 → `rectorMode := 1`.
2. If `rectorMode = 1`: `knowDen := 1`, then `InitRector(0); Fight(3); InitRector(1); Fight(4)`
   (§13). Winning `Fight(4)` ends the program.
3. Prompt `\`, read command, lower-case it.
4. Dispatch (a command may match several branches in sequence; order as in the code):

| Command | Effect |
|---|---|
| `w`, `run` | a turn: §6 then a random event §7 (`run` additionally prints "Забегал мудак.") |
| `mar` | market (§10.1) if `knowMarket` and `marketBan = 0` |
| `bmar` | dealers (§10.2) if `knowDealers` |
| `rep` | vet (§10.3) if `knowVet` |
| `girl` | girlfriend (§10.4) if `hasGirl` |
| `fight` | message only ("Пережитки прошлого…") |
| `pr` | den (§10.5) if `knowDen` |
| `kl` | club (§10.6) if `knowClub` and `clubBan = 0` |
| `trn` | gym (§10.7) if `knowGym` |
| `h`, `mh` | drink beer (§9) — evaluated for every command |
| `kos` | eat a joint (§9) |
| `i` | command list (only known places are listed) |
| `s` | stats screen |
| `f` | if pistol: "Ты чё псих? мигом менты накроют!" |
| `k` | "Чё машешь копытами? Ищи мудака…" |
| `name` | rename (empty → Раздолбай) |
| `version` | version string |
| `help` | help text |
| `e`, `exit` | "Блин не быть тебе нормальным пацаном", stats, wait key, exit |

Unknown places print a "you don't know where X is yet" message; `mar` under a ban prints
"На базар пока нельзя там менты бродят".

---

## 6. A `w` turn — per-turn processing (in this order)

1. **Drug high**: if `highTurns > 0`: `highTurns -= 1`; when it reaches 0: `STR -= 2`,
   `dmgMin -= 1`, `dmgMax -= 2`, "Глюки прошли. Сила -2.".
2. **Loans regenerate**: if `loans < district*10` then `loans += 1`.
3. **Silencer timer**: if `knowDealers` and `pistol` and `silencerTimer < 25`: `silencerTimer += 1`;
   on reaching 25 and `mobile = 1`: phone message "Приходи, мы вещицу для тебя раздобыли".
4. **Den help quest**: if `denHelpQuest = 0` and `Random(20) = 0`: set it; if `knowDen` and
   `mobile`: phone message "Тут помощь нужна".
5. **Den job**: if `denJob = 0` and `Random(20) = 0`: set it; if `knowDen`, `cool >= 100`, `mobile`:
   phone message "Базар есть".
6. If `mobile` and `Random(200) = 0`: the "Алё Вася?" joke (three key presses).
7. If `mobile` and `Random(100) = 0` and `hasGirl`: girlfriend call.
8. If `marketBan = 1` and `knowDen`: phone "менты свалили"; if `clubBan = 1` and `knowDen`: phone
   "в клуб-та пойдёшь". Then `marketBan`, `clubBan` decrement toward 0.
9. **Discovering places**: `Random(10) = 0` → vet; `Random(10) = 0` → market;
   `Random(100) = 0` → club; `Random(100) = 0` → gym (each only if not yet known).
10. **Ring "Гп"**: if `ringHeal`: `HP := min(maxHP, HP + 3)` (only if below max); then if
    `Random(20) = 0`: heal the leg if only the leg is broken, else heal the jaw if broken.
11. **Class bonus**: Отморозок: `HP += 1` if below max. Вор: if `LUCK >= Random(district*20)`:
    `found := Random(district*5) + 1`, `money += found`, "Опа бабки!".
12. **Event roll**: `r := Random(25) + 1` → `evType`: `r = 1` → 1 (area), `2..4` → 2 (girl),
    `5..9` → 3 (enemy), `10..25` → 4 (nothing).
13. If `Random(200) = 0` → church (§12.1). If `Random(100) = 0` → mage (§12.2). (Both can
    happen; the church sets `evType := 0`, so no further event that turn.)
14. Process `evType` (§7).

---

## 7. Random events on `w`

**Event 1 — area toggle**: `inArea := not inArea`. Message by district on entering
(1 "тропинку где бродит искитимская гопота", 2 "дебри подваротен", 3 "планы",
4 "чёрте куда") or leaving. `inArea` makes enemies stronger (§8) and allows shooting.

**Event 2 — girl**: if `hasGirl`: "Совсем ничё не происходит." Otherwise prompt
"Идет типа клёвая цыпа. Хочешь её зацепить?"; on `y`: `Random(2) = 0` → `hasGirl := 1`
("Глянулся ты мне парниша"), else "Отдыхай урод".

**Event 3 — enemy**: `GenEnemy(0)`, `fightFlag := 0`.
- If `eType = 8` (cop): "Идет ментяра # уровня". If `LUCK >= Random(district*7 + 15)` →
  "затаился"; else if `sunglasses` → hidden by the glasses; else "Запалил!" → fight.
- Otherwise `chance := district*7 + 15`, halved if `tattoo`. Let `lucky := LUCK >= Random(chance)`.
  The enemy is *aggressive* if (`lucky` and `eType >= 7`) or (not `lucky` and `eType >= 3`).
  - Not aggressive: "Идет <name> # уровня. Хочешь наехать?" → `y` fights.
  - Aggressive: "…ищущий кого отпинать. Хочешь наехать?" → `y` fights; otherwise `Random(2) = 0`
    → "Он тебя заметил." forced fight, else "Ты смылся."
- Fight is `Fight(0)`.

**Event 4 — nothing**: if `highTurns > 0` and `Random(7) = 0`: "Все куда-то плывёт".
If `highTurns > 0` and `Random(7) = 0`: hallucinated prompt "Идет <random type 0..6>
<Random(district*10)+1> уровня. Хочешь наехать?", any answer → "глюки какие-то". Otherwise
"Ничё не происходит."

---

## 8. Enemy generation — `GenEnemy(mode)`

1. **Type**: `r := Random(51) + 1`, then for `k := 1..10`: if `r - k < 0` then `eType := 10 - k`
   and stop, else `r -= k`. Resulting base distribution (out of 51):
   type 0: 7, 1: 9, 2: 8, 3: 7, 4: 6, 5: 5, 6: 4, 7: 3, 8: 2 (never 9).
   Then `eType += Random(district)`; if `inArea`: `eType += Random(4)`; clamp to 9.
   `mode = 1` (den quest, club cheat, market theft caught): clamp to 7. `mode = 2`: `eType := 8`.
2. **Level**: `eLevel := 4*Random(district) + Round( level*(1+Random(2)) / (1+Random(2)) + Random(5) - 2 )`,
   floored at 0. If `inArea`: `eLevel := Round(eLevel * 1.5)`.
3. **Stats**: start at 0; distribute `(3*eLevel) mod 256` points (the count is kept in a byte, so it wraps for `eLevel >= 86`), each point going to
   STR/AGI/VIT/LUCK with the type's weights (§3.1) — same roll as the player's level-up.
4. `eDmgMin := eSTR div 2`, `eDmgMax := eSTR`, `eMaxHP := eVIT*5 + eSTR + 10`, `eHP := eMaxHP`,
   fractures cleared.
5. **Loot**, with `A := Round(eType*eLevel / 5) + eLevel div 2`:
   - `eJunk := Random(6) + 2*Random(A) - A`, floored at 0
   - `eMoney := Random(6) + Random(A) - A div 2`, floored at 0
   - `eBeer := Random(2) + eLevel div 10 + 1`
6. **Armour**: `B := 2*(district-1)^2`; `eArmor := B + Random(B)` (byte).

---

## 9. Consumables

**Beer** (`h` one unit, `mh` until full; also inside a fight): refused with a broken jaw.
If `HP >= maxHP`: "Блин только тупить не надо". If `beer = 0`: "Пива нету". Else `beer -= 1`
and `HP := min(maxHP, HP + 5)`. Remaining is shown as `beer div 2 . (beer mod 2)*5 л`.

**Joint** (`kos`): refused with a broken jaw or while `highTurns > 0`; needs `joints > 0`.
`joints -= 1`, `highTurns := 10` (3 when eaten during a fight), `STR += 2`, `dmgMin += 1`,
`dmgMax += 2`, `HP := min(maxHP, HP + 10)`. Wears off as in §6.1.

**Hot dog** (market): `HP := min(maxHP, HP + 3 + Random(2))`.

---

## 10. Locations

All location menus loop until `w`. The menu is printed once and only the prompt repeats. Prices are
shown in dark grey (`^0`) when you can afford them and light red (`^4`) when you cannot.

### 10.1 Market (`mar`) — needs `knowMarket`, `marketBan = 0`

| Key | Item | Rule |
|---|---|---|
| 1 | Хотдог, 2 | not with a broken jaw; not at full HP; +3..4 HP |
| 2 | Пиво, 5 | `beer += 1`, one of three flavour lines |
| 3 | Очки, 10 | once |
| 4 | Костюм abibas, 15 | once, refused if adidas owned; `armor += 1` |
| 5 | Бутсы, 15 | once, refused if cool boots owned; `dmgMin += 1, dmgMax += 1` |
| 6 | Кожанка, 25 | district ≥ 2; once, refused if cool leather; `armor += 2` |
| 7 | Костюм adidas, 30 | district ≥ 2; once; `armor += 1` if abibas owned else `+2` |
| 8 | Понтовейшие бутсы, 30 | district ≥ 3; once; damage `+1/+1` if boots owned else `+2/+2` |
| 9 | Ваще крутая кожанка, 50 | district ≥ 4; once; `armor += 2` if leather owned else `+4` |
| t | pickpocket | if `LUCK >= Random(district*5 + 5)` and `Random(10) < 9`: `money += Random(LUCK*2) + 1`, `exp += district*2`, level-up check. Otherwise caught: `GenEnemy(1)`, "Корявый! ты попался!", `Fight(1)`, then `marketBan := 5` and you are thrown out |

### 10.2 Dealers (`bmar`) — needs `knowDealers`

| Key | Item | Rule |
|---|---|---|
| 1 | Косяк, 15 | `joints += 1` |
| 2 | Мобильник, 30 | once |
| 3 | Офигенный косяк, 20 | `Random(4)`: 0 STR+1 (`dmgMax += 1`; `dmgMin += 1` if STR is now even; `maxHP += 1, HP += 1`), 1 AGI+1, 2 VIT+1 (`maxHP += 5, HP += 5`), 3 LUCK+1 |
| 4 | Наколка, 10 | once |
| 5 | Кастет, 25 | district ≥ 2; refused only if club **and** knife **and** cleaver are all owned; once; `dmg += 2/+2` |
| 6 | Дубинка, 50 | district ≥ 3; refused if knife and cleaver; once; damage `+2/+2` only if knuckles owned, otherwise no bonus (sic) |
| 7 | Пистолет, 150 | district ≥ 4; once; `bullets += 3` |
| 8 | Патроны, 70 | district ≥ 4; needs pistol; `bullets += 5` |
| 9 | Глушитель, 60 | district ≥ 4, pistol owned, `silencerTimer = 25`; once. (Menu shows the ammo price, 70; 60 is charged.) |
| x | sell junk | `money += junk; junk := 0` |
| wes | sell superseded items | each asked with `y`: suit (abibas when adidas owned) `8 + Random(5)`; boots (when cool boots) `8 + Random(5)`; leather (when cool leather) `13 + Random(8)`; knuckles (when club/knife/cleaver) `13 + Random(8)`; club (when knife/cleaver) `25 + Random(15)`; knife (when cleaver) `38 + Random(23)`. Selling clears the flag but does not reduce damage/armour. |

### 10.3 Vet (`rep`) — needs `knowVet`

If at full HP with no fractures: "Док: вали отсюда ты здоров." Otherwise: `h` for 3 roubles:
`HP := min(maxHP, HP + 5)` plus one of three random doctor lines; `r` for 7 roubles: clears both
fractures (only offered when one is broken). `w` or `e` leaves.

### 10.4 Girlfriend (`girl`) — needs `hasGirl`

Needs 12 roubles ("Ну непойдёшь же как придурок без ничего"). `money -= 12`, `HP := maxHP`,
`marketBan := 0`. If `Random(2) = 0` and the club is unknown: `knowClub := 1`.

### 10.5 Den (`pr`) — needs `knowDen`

Name by district: 1 "общагу №(3 + Random(6))", 2 "общагу ВКИ", 3 "гоповский притон",
4 "притон отморозков".

| Key | Rule |
|---|---|
| p | if `beer > 0`: `beer -= 1`, `cool += 5` |
| r | shown while `loans > 0`; if `cool > 0`: `money += 2`, `cool -= 2`, `loans -= 1` |
| hp | shown while `denHelpQuest`: `GenEnemy(1)`, `Fight(6)`, quest cleared |
| s | prints `cool`; if `district*10 + 10 <= cool`: "Да если чё мы за тебя впрягаемся." |
| a | learn gym + dealers. Shown when `5*(level - 10*(district-1) - 5) + cool >= 40`; actually works when `2*(level - 10*(district-1)) + cool >= 40` (and not both already known) |
| d | needs `cool >= 100` and `denJob`. If `LUCK >= Random(district*15)`: `money += district*10 + Random(district*10)`, `junk += district*10 + Random(district*10)`, `exp += district*12`, level-up check. Else "Шухер менты!": if `LUCK >= Random(district*15)` you escape, else `GenEnemy(2)` + `Fight(5)`. `denJob := 0` either way |

### 10.6 Club (`kl`) — needs `knowClub`, `clubBan = 0`

`bet := 5` on entry.

| Key | Rule |
|---|---|
| p | cards: needs `money >= bet`; `money -= bet`. If `LUCK >= Random(district*12)`: `money += 2*bet`, `bet += 2`, `exp += district`, level-up check. Else lose, `bet := 5`. When `bet >= 17`: "Козёл! Да ты мухлевал!" → `GenEnemy(1)`, `exp += district*5`, level-up check, `Fight(2)`, `clubBan := 5`, thrown out |
| 1 | 15 roubles: `AGI += 1` |
| 2 | district ≥ 2, 22 roubles: `LUCK += 1` |

### 10.7 Gym (`trn`) — needs `knowGym`

`absArmor := armor` minus clothing bonuses (abibas 1 unless adidas, adidas 2, leather 2 unless
cool leather, cool leather 4).

| Key | Rule |
|---|---|
| 1 | 20: `STR += 1`, `maxHP += 1`, `HP += 1`, `dmgMax += 1`, `dmgMin += 1` if STR is now even |
| 2 | 20: `VIT += 1`, `maxHP += 5`, `HP += 5` |
| 3 | district ≥ 2 and `district*10 - 3 > level`; 10: `exp += 10`, level-up check |
| 4 | district ≥ 2; 30: tooth guard (once) |
| 5 | listed only while district ≥ 3 **and** `absArmor < district*2`; 20: works while `absArmor < 10*(district-2)`, then `armor += 1`; otherwise "максимально прокачал пресс" (plus "качай дальше" below district 4). The listing test is stricter than the one that works, so the option can be usable while hidden |

---

## 11. Levels, experience, running away

**Level-up** (`LevelUp(force)`), called whenever exp may have crossed the threshold:
while `exp >= expNext`: `exp -= expNext; expNext += 10; n += 1`. Then `n` times (stopping at
`level = 40` unless `force`): `level += 1`, and two rolls of `r := Random(12) + 1` against the class
weights (§3.1): STR (`dmgMax += 1`, `dmgMin += 1` if STR is now even, `maxHP += 1`, `HP += 1`) /
AGI / VIT (`maxHP += 5`, `HP += 5`) / LUCK. The digit of each gained stat is appended to
`levelHist[level]` (levels ≤ 40). Total exp to reach level *n* from 0 is `10·n(n+1)/2`.

**Running away** (`run` in a fight): impossible against the rector or with a broken leg. If
`level > 0`: "Враг: Трусливый засранец!", each digit in `levelHist[level]` is reverted (STR: `-1`,
`dmgMax -= 1`, `dmgMin -= 1` if STR was odd, `maxHP -= 1`; AGI `-1`; VIT `-1`, `maxHP -= 5`;
LUCK `-1`; HP clamped), the history entry is cleared, `level -= 1`, `expNext -= 10`, and
`exp := expNext - 1` if it was not below. If not Гопник and `level - 10*(district-1) = 3` (before the
decrement) the game prints "Такого конявого непустят в местный притон!" but sets `knowDen := 1`
(original bug). If `level = 0`: just "Враг: Засранец!". The fight ends.

---

## 12. Encounters on the road

### 12.1 Church (`Random(200) = 0` on a `w` turn)

Dialogue depends on `churchVisits` (0: first prayer, 1: "упорный чудак", 2+: short), then
`churchVisits += 1` (capped at 2 in effect). Blessing `Random(5)`:
0 → +1 level (`exp := expNext; LevelUp(0)`, prints old and new title);
1 → `Random(4)`: STR+1 (with the usual HP/damage side effects), AGI+1, VIT+1 (+5 HP), LUCK+1;
2 → a ring: "Пг" (all four stats +1, `maxHP += 6`, `HP += 6`, `dmgMax += 1`, and `dmgMin += 1`
    when the new STR is even — the same rule as a level-up), else "Мега Кольцо" (all +4,
    `maxHP += 24`, `HP += 24`, `dmgMax += 4`, `dmgMin += 2`), else "Гп" (`ringHeal`);
3 → `armor += 1`;
4 → `cool += district*50 + 50`.
Ends with `evType := 0` ("Ты идещь дальше...").

### 12.2 Mage Рушель Блаво (`Random(100) = 0` on a `w` turn)

Offers a save "за `district*25` рублей"; on `y` the check and the charge are `district*50`
(original inconsistency). Writes `save_r0.sav` (694 bytes) and `places.sav` (7 bytes).

---

## 13. Combat — `Fight(mode)`

`mode`: 0 street, 1 caught pickpocketing, 2 club cheating, 3 fake rector (проректор), 4 real
rector, 5 cop after a failed job, 6 den help quest.

**Intro line** by mode/type: mode 0/6 → by `eType` (0–2 "Слышь Вась.. / А чё ваще?",
3–6 "Пацан ты из какого района? / А ты по пинкам суди!", 7 "Эй мудак?!", 8 "Блин! это же
<name> - известный <type>", 9 "Я МАНЬЯК!!!"); mode 1 "Отдай кошелёк урод!"; mode 3 four-line
exchange; mode 4 "Тут заходит настоящий ректор…".

**Kick counts** (computed once):
`pBase := AGI + 4`, `eBase := eAGI + 4`. Enemy's effective base `eEff := eBase`: if `eBase > 10`,
while `pBase' > 18` (starting from `pBase`): if `eEff >= 28` then `eEff -= 18; pBase' -= 18` else
`eEff := 10` and stop. If that reduced the number of kicks a message says so. The player's
effective base `pEff` is computed symmetrically from `pBase` and `eBase`.
Number of kicks per attack = `ceil(eff / 18)`; kick *i* uses `eff - 18*(i-1)`.

**Round loop** (one command per iteration, prompt `Битва\`): a round counter reaches 5 →
"Начинают собираться зрители"; from then on (not in rector mode) `Random(10) = 0` prints one of
18 spectator lines (`Random(18)`).

Commands: `k` attack, `run`, `h`/`mh` beer, `kos` joint (§9), `s` stats, `sv` enemy stats,
`e` quit program, `v` call reinforcements, `f` shoot. Anything else just repeats the prompt. The
enemy only attacks in response to `k`.

**`k` — player attack**, for each kick while `eHP > 0`:
- `roll := Random(100) + 1`; hit if `roll <= 5*cur` and `roll <= 90` (cur = current base).
- damage `d := dmgMin + Random(dmgMax - dmgMin) + 1`.
- critical if `LUCK*3 > Random(100) + 1`: `d += dmgMax` and one of "Точный удар!!!",
  "Не хило приложил!!!", "Двойной урон!!!".
- `d := max(0, d - eArmor)`; `eHP -= d`.
- fracture: if `LUCK*3 > Random(200 + eLUCK*3) + 1`: `Random(2) = 0` → enemy jaw (if intact),
  else enemy leg (if intact).
- after each kick `cur -= 18`; if `cur > 0` and the enemy lives: "можешь пнуть ещё раз".

Then, if `eHP > 0`, **enemy attack** with the same rules mirrored (`eLUCK`, `eDmg*`, player
`armor`), except the jaw: if `toothGuard`, the jaw breaks only when `Random(4) = 0`
("даже защита не помогла"), otherwise "Защита спасла твои кривые клыки".

**`v` — reinforcements** (`help` counter): needs `knowDen` and `district*10 + 10 <= cool`;
otherwise "Ни кто не хочет за тебя впрягаться" / "Сначала надо скорешиться". Sets `help := 1`
if it was 0; with a `mobile` it jumps to 3 immediately. While `1 <= help < 3` each `k` increments
it ("продержаться … # пинка"); at 3 "Подошли пацаны". Once `help >= 3`, after every command the
gang hits: `d := district*3 + Random(eHP*4) - eArmor div 3` (min 0), `eHP -= d`; then
`Random(2) = 0` → `help += 1`; at `help = 7` they are beaten ("Твою подмогу отпинали",
`help := 0`); then `cool -= district*5`, and if `cool <= 0` the gang leaves (`help := 0`).

**`f` — shoot**: needs `pistol`; not allowed unless `inArea` or `silencer`; needs `bullets > 0`.
`bullets -= 1`; if `AGI > Random(50)`: `eHP -= 20 + Random(10)`, else "хреновый выстрел".

**Player death** (`HP <= 0`): in rector mode → "Ты сдох. Ректор тебя замочил", end screen.
Else if `knowDen` and `cool >= 10`: rescued — `cool -= 10`, `money -= Round(maxHP * 3 / 5)`,
`HP := maxHP`; if a fracture: `money -= 7` and both healed; if `money < 0`: `cool += money`,
`money := 0`. Otherwise "Ты сдох." and the end screen (program exits).

**Victory** (`eHP <= 0`):
- mode 4: `exp := expNext; LevelUp(1)`, victory text, stats, win animation, end screen, exit.
- mode 3: `exp := expNext; LevelUp(1)`, "да это ж не ректор был… проректор СУНЦа!", then continue
  as below but without the exp award.
- otherwise "Враг сдох.", `exp += eSTR + eAGI + eVIT + eLUCK`; if `exp < expNext` prints "слишком
  слабого мудака", else `LevelUp(0)`.
- then: `beer += eBeer`, `money += eMoney`, `junk += eJunk`, "Пиво победителю!",
  `HP := min(maxHP, HP + 5)`, `cool += (eType + 1) + eLevel div 3`;
  if not `knowDen` and `level - 10*(district-1) >= 3`: `knowDen := 1` ("можно заходить в притон").
- `Random(30) = 0` → ring drop, in the same Пг → Мега → Гп order as §12.1 (first one not owned).
- if `LUCK >= Random(district*25)` and `eType = 2`: `joints += Random(3)`.
- if `LUCK >= Random(district*40)`: item drop by type — 1: `Random(3)` cross (LUCK+2) / ring Гс
  (LUCK+1) / mobile; 3–6: `Random(2)` knuckles (`dmg += 2` unless a better weapon) / club (`dmg += 4`,
  or `+2` over knuckles, nothing over knife/cleaver); 7: `Random(2)` sunglasses / mobile;
  9: `Random(2)` knife or cleaver. Items already owned give nothing.

  The knife and cleaver bonuses were compiled as comparisons of boolean values
  (`if (club = 0) = knuckles then …`), which double-counts for some combinations. What the code
  actually adds, by what you already carry:

  | already owned | knife drop | cleaver drop |
  |---|---|---|
  | nothing | +6 | +9 |
  | knuckles | +4 | +7 |
  | club | +6 | +12 |
  | knife | – | +10 |
  | knuckles + club | +2 | +5 |
  | knuckles + knife | – | +3 |
  | club + knife | – | +10 |
  | knuckles + club + knife | – | +3 |
- mode 6: `cool += district*20`, `exp += district*10`, `LevelUp(0)`.
- `help := 0`, fight ends.

**Rector stats** (`InitRector`): fake (mode 3) — level 125, STR 41, AGI 50, VIT 123, LUCK 36,
armour 60 → HP 666, damage 20–41. Real (mode 4) — level 160, STR 50, AGI 60, VIT 188, LUCK 32,
armour 80 → HP 1000, damage 25–50. No loot.

---

## 14. Stats screen (`s`) and enemy screen (`sv`)

`s` prints: "Ты <type name[classCode]> # уровня - <title[level]>", the name, exp/expNext (hidden
at level ≥ 40), `Сл/Лв/Жв/Уд` (light blue when boosted by rings or a high), trinkets, rings,
mobile/glasses/tattoo/pistol lines, damage with the weapon list (superseded items in red),
status flags (jaw, tooth guard, leg, obдолбаный), HP coloured red ≤ 25 %, yellow ≤ 50 %, green
above, accuracy `20 + AGI*5 %` (or "90%" plus extra kicks when `AGI > 14`), armour with clothing,
joints, beer in litres, money, junk. `sv` shows the same core block for the enemy.

---

## 15. Quirks of the original worth preserving "as is"

- Enemy only attacks after `k`; drinking/eating in a fight is free.
- Buying a club at the dealers gives +2 damage only if you already own knuckles, otherwise +0.
- Silencer menu line shows the ammo price (70) but charges 60.
- Pistol grants 3 bullets; "Патроны - 6" grants 5.
- Mage advertises `district*25` but charges `district*50`.
- Running away at the den threshold *enables* the den instead of disabling it.
- Selling gear never removes its damage/armour bonus.
- `save_r2..5` do not restore known places; only `save_r0` (mage) has `places.sav`.
- Level cap 40 for normal play; each rector win adds one level regardless of the cap (40 → 41 → 42).
- Weapon drops double-count: a knife found while carrying only a club gives +6 instead of +2, and a cleaver found while carrying only a club gives +12 (§13).
- Enemy stat points `3*eLevel` are counted in a byte: an enemy of level 86+ (possible in district 4 inside an area) gets far fewer points than intended.
