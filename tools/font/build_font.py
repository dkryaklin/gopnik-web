#!/usr/bin/env python3
"""
Builds a TrueType font from the CP866 8x16 VGA bitmap font that ships inside
KEYRUS.COM, the Russian DOS keyboard driver the game is started with.

The result is the typeface ГОПНИК.EXE actually shows on a DOS screen, in an
8x16 cell, so the web version keeps the original 80x25 geometry.

Most of it is IBM's: 184 of the 256 slots match the stock IBM VGA 8x16 ROM
font byte for byte. KEYRUS only replaced 0x80-0xAF and 0xE0-0xF1 with
Cyrillic, so 0xF2-0xF7 still draw CP437 maths, not the letters CP866 names.

    python3 tools/font/build_font.py

Writes src/assets/fonts/gopnik-cp866.ttf
"""

from __future__ import annotations
import struct
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
KEYRUS = HERE / 'KEYRUS.COM'
OUT = ROOT / 'src' / 'assets' / 'fonts' / 'gopnik-cp866.ttf'

FONT_OFFSET = 6837          # start of the 256 x 16-byte glyph table
CELL_W, CELL_H = 8, 16
UPEM = 1024
PIXEL = UPEM // CELL_H      # 64 units per pixel row
BASELINE_ROW = 12           # rows 12..15 sit below the baseline
ADVANCE = CELL_W * PIXEL    # 512 = half an em

# CP437 graphics in the control range, ASCII, then the CP866 upper half.
LOW = ' ☺☻♥♦♣♠•◘○◙♂' \
      '♀♪♫☼►◄↕‼¶§▬' \
      '↨↑↓→←∟↔▲▼'
HIGH = (
    'АБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмноп'
    '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀'
    'рстуфхцчшщъыьэюяЁёЄєЇїЎў°∙·√№¤■ '
)


# ---------------------------------------------------------------------------
# Latin diacritics
#
# CP437 keeps its accented Latin letters in 0x80-0xAF. KEYRUS.COM overwrites
# exactly that range with Cyrillic, so the ROM has not one of them left, and
# Spanish, Portuguese, French and German need about fifty. They are composed
# here from the letters the ROM does have.
#
# Placement follows the ROM's own accented Cyrillic: e puts its dots on row 3
# and leaves row 4 empty above the letter, E puts them on row 1, leaves row 2
# empty and squeezes the letter into rows 3-11. So a mark always clears its
# letter by a row, lowercase keeps its shape, and a capital pays for the mark
# with a row of its own.

CAP_TOP = 2                 # the row an unmarked capital starts on
MARK_BOTTOM_UPPER = 1       # bottom row of a mark over a capital
MARK_BOTTOM_LOWER = 3       # bottom row of a mark over a lowercase letter

MARKS = {
    # Two pixels thick, like every other stroke in this face.
    'grave':      ('..##....', '...##...'),
    'acute':      ('...##...', '..##....'),
    'circumflex': ('..####..', '.##..##.'),
    # The stroke the ROM already draws, twice over, to make the CP437 "almost
    # equal" sign it keeps at 0xF7.
    'tilde':      ('.###.##.', '##.###..'),
    # The dots the ROM already draws for Yo.
    'diaeresis':  ('.##.##..',),
}

# Hangs off the bottom instead, so it costs the capital nothing.
CEDILLA = ('...##...', '..###...')

DIACRITICS = {
    'A': {'grave': 'À', 'acute': 'Á', 'circumflex': 'Â', 'tilde': 'Ã', 'diaeresis': 'Ä'},
    'E': {'grave': 'È', 'acute': 'É', 'circumflex': 'Ê', 'diaeresis': 'Ë'},
    'I': {'grave': 'Ì', 'acute': 'Í', 'circumflex': 'Î', 'diaeresis': 'Ï'},
    'N': {'tilde': 'Ñ'},
    'O': {'grave': 'Ò', 'acute': 'Ó', 'circumflex': 'Ô', 'tilde': 'Õ', 'diaeresis': 'Ö'},
    'U': {'grave': 'Ù', 'acute': 'Ú', 'circumflex': 'Û', 'diaeresis': 'Ü'},
    'Y': {'acute': 'Ý', 'diaeresis': 'Ÿ'},
    'a': {'grave': 'à', 'acute': 'á', 'circumflex': 'â', 'tilde': 'ã', 'diaeresis': 'ä'},
    'e': {'grave': 'è', 'acute': 'é', 'circumflex': 'ê', 'diaeresis': 'ë'},
    'i': {'grave': 'ì', 'acute': 'í', 'circumflex': 'î', 'diaeresis': 'ï'},
    'n': {'tilde': 'ñ'},
    'o': {'grave': 'ò', 'acute': 'ó', 'circumflex': 'ô', 'tilde': 'õ', 'diaeresis': 'ö'},
    'u': {'grave': 'ù', 'acute': 'ú', 'circumflex': 'û', 'diaeresis': 'ü'},
    'y': {'acute': 'ý', 'diaeresis': 'ÿ'},
}

CEDILLAS = {'C': 'Ç', 'c': 'ç'}

# The mark takes the dot's place.
DOTLESS = 'ij'

# A capital loses the second of two identical neighbouring rows, the only cut
# a ten-row letter does not show. E is the one letter with no repeated pair,
# so it names the row itself: dropping the bare stem leaves it symmetrical.
SQUEEZE_ROW = {'E': 8}

# Shapes with nothing in the ROM to build them from, drawn to the same
# two-pixel stroke. There is deliberately no oe ligature: at four pixels a side
# it is unreadable, which is why CP850 has none either and DOS-era French
# spelled it "oe".
DRAWN = {
    'ß': ('..####..', '.##..##.', '.##..##.', '.#####..', '.##..##.',
          '.##...##', '.##...##', '.##...##', '.##..##.', '.##.##..'),
    '¡': ('...##...', '...##...', '........', '...##...', '...##...',
          '...##...', '..####..', '..####..', '..####..', '...##...'),
    '¿': ('...##...', '...##...', '........', '...##...', '...##...',
          '..##....', '.##.....', '##...##.', '##...##.', '.#####..'),
    # Sat low, so they straddle the x-height rather than the cap height.
    '«': ('........', '........', '........', '........', '..##..##',
          '.##..##.', '##..##..', '.##..##.', '..##..##', '........'),
    '»': ('........', '........', '........', '........', '##..##..',
          '.##..##.', '..##..##', '.##..##.', '##..##..', '........'),
}


def bits(pattern: str) -> int:
    """Turns an eight-character row of a drawing into its bitmap byte."""
    return sum(0x80 >> i for i, c in enumerate(pattern) if c != '.')


def squeeze(rows: list, drop: int) -> list:
    """Drops one row from a capital and lowers the rest, freeing rows 0-2."""
    kept = rows[CAP_TOP:drop] + rows[drop + 1:BASELINE_ROW]
    return [0] * (CAP_TOP + 1) + kept + rows[BASELINE_ROW:]


def repeated_row(rows: list) -> int:
    """The last row of a capital that simply repeats the one above it."""
    return max(r for r in range(CAP_TOP + 1, BASELINE_ROW)
               if rows[r] == rows[r - 1])


def compose(rows: list, base: str, mark: tuple) -> list:
    """Puts a mark over a letter, making room over a capital if it has to."""
    upper = base.isupper()
    if upper:
        out = squeeze(rows, SQUEEZE_ROW.get(base) or repeated_row(rows))
    else:
        out = list(rows)
        # A mark stands in for the dot on an i, so clear the whole band first.
        if base in DOTLESS:
            out[:MARK_BOTTOM_LOWER + 1] = [0] * (MARK_BOTTOM_LOWER + 1)
    bottom = MARK_BOTTOM_UPPER if upper else MARK_BOTTOM_LOWER
    for i, pattern in enumerate(reversed(mark)):
        out[bottom - i] = bits(pattern)
    return out


def latin_glyphs(bitmaps: list, mapping_cp: dict) -> dict:
    """The accented Latin letters, keyed by character, in code point order."""
    rom = {chr(cp): bitmaps[byte] for byte, cp in mapping_cp.items()}
    out = {}
    for base, marks in DIACRITICS.items():
        for mark, char in marks.items():
            out[char] = compose(rom[base], base, MARKS[mark])
    for base, char in CEDILLAS.items():
        rows = list(rom[base])
        for i, pattern in enumerate(CEDILLA):
            rows[BASELINE_ROW + i] = bits(pattern)
        out[char] = rows
    for char, drawing in DRAWN.items():
        rows = [0] * CELL_H
        for i, pattern in enumerate(drawing):
            rows[CAP_TOP + i] = bits(pattern)
        out[char] = rows
    return {c: out[c] for c in sorted(out, key=ord)}


def cp866_map() -> dict:
    """CP866 byte -> Unicode code point."""
    table = {}
    for i, ch in enumerate(LOW):
        if i:
            table[i] = ord(ch)
    for i in range(0x20, 0x7f):
        table[i] = i
    table[0x7f] = 0x2302  # house
    for i, ch in enumerate(HIGH):
        table[0x80 + i] = ord(ch)
    return table


def read_glyphs() -> list:
    data = KEYRUS.read_bytes()
    block = data[FONT_OFFSET:FONT_OFFSET + 256 * CELL_H]
    if len(block) != 256 * CELL_H:
        sys.exit('KEYRUS.COM is not the expected size')
    return [list(block[i * CELL_H:(i + 1) * CELL_H]) for i in range(256)]


def rectangles(rows: list) -> list:
    """Turns an 8x16 bitmap into merged rectangles (x0, row0, x1, row1)."""
    runs = []
    for r, bits in enumerate(rows):
        x = 0
        while x < CELL_W:
            if bits & (0x80 >> x):
                start = x
                while x < CELL_W and bits & (0x80 >> x):
                    x += 1
                runs.append([r, start, x])
            else:
                x += 1
    merged = []
    used = [False] * len(runs)
    for i, (row, x0, x1) in enumerate(runs):
        if used[i]:
            continue
        used[i] = True
        bottom = row
        for j in range(i + 1, len(runs)):
            if used[j]:
                continue
            row2, a, b = runs[j]
            if row2 == bottom + 1 and a == x0 and b == x1:
                used[j] = True
                bottom = row2
            elif row2 > bottom + 1:
                break
        merged.append((x0, row, x1, bottom + 1))
    return merged


def glyph_data(rows: list) -> bytes:
    rects = rectangles(rows)
    if not rects:
        return b''
    contours = []
    for x0, r0, x1, r1 in rects:
        left = x0 * PIXEL
        right = x1 * PIXEL
        top = (BASELINE_ROW - r0) * PIXEL
        bottom = (BASELINE_ROW - r1) * PIXEL
        # clockwise with y pointing up
        contours.append([(left, bottom), (left, top), (right, top), (right, bottom)])

    xs = [p[0] for c in contours for p in c]
    ys = [p[1] for c in contours for p in c]
    out = bytearray()
    out += struct.pack('>hhhhh', len(contours), min(xs), min(ys), max(xs), max(ys))
    end = -1
    for c in contours:
        end += len(c)
        out += struct.pack('>H', end)
    out += struct.pack('>H', 0)  # no instructions
    points = [p for c in contours for p in c]
    out += bytes([0x01]) * len(points)  # on-curve, 16-bit deltas
    prev = 0
    for x, _ in points:
        out += struct.pack('>h', x - prev)
        prev = x
    prev = 0
    for _, y in points:
        out += struct.pack('>h', y - prev)
        prev = y
    while len(out) % 4:
        out += b'\x00'
    return bytes(out)


def x_min(glyph: bytes) -> int:
    """The xMin an assembled glyph reports, 0 for a blank one."""
    return struct.unpack('>h', glyph[2:4])[0] if glyph else 0


def cmap_format4(mapping: dict) -> bytes:
    codes = sorted(mapping)
    segments = []
    start = prev = codes[0]
    for code in codes[1:]:
        contiguous = code == prev + 1 and mapping[code] == mapping[prev] + 1
        if not contiguous:
            segments.append((start, prev))
            start = code
        prev = code
    segments.append((start, prev))
    segments.append((0xffff, 0xffff))

    seg_count = len(segments)
    ends = b''.join(struct.pack('>H', e) for _, e in segments)
    starts = b''.join(struct.pack('>H', s) for s, _ in segments)
    deltas = b''
    for s, _ in segments:
        delta = 1 if s == 0xffff else (mapping[s] - s) & 0xffff
        deltas += struct.pack('>H', delta)
    ranges = b''.join(struct.pack('>H', 0) for _ in segments)

    search = 2 ** (seg_count.bit_length() - 1) * 2
    body = struct.pack('>HHHH', seg_count * 2, search, seg_count.bit_length() - 1,
                       seg_count * 2 - search)
    subtable = struct.pack('>HHH', 4, 16 + 8 * seg_count, 0) + body
    subtable += ends + struct.pack('>H', 0) + starts + deltas + ranges
    header = struct.pack('>HH', 0, 1) + struct.pack('>HHI', 3, 1, 12)
    return header + subtable


def name_table(records: list) -> bytes:
    entries = b''
    strings = b''
    for name_id, value in records:
        encoded = value.encode('utf-16-be')
        entries += struct.pack('>HHHHHH', 3, 1, 0x409, name_id, len(encoded), len(strings))
        strings += encoded
    return struct.pack('>HHH', 0, len(records), 6 + 12 * len(records)) + entries + strings


def checksum(data: bytes) -> int:
    padded = data + b'\x00' * ((4 - len(data) % 4) % 4)
    return sum(struct.unpack('>%dI' % (len(padded) // 4), padded)) & 0xffffffff


def build() -> bytes:
    bitmaps = read_glyphs()
    mapping_cp = cp866_map()

    # Glyph 0 is .notdef (blank); the 256 code page glyphs follow.
    glyphs = [b''] + [glyph_data(bitmaps[i]) for i in range(256)]
    unicode_to_gid = {cp: byte + 1 for byte, cp in mapping_cp.items()}

    # ...then the Latin letters the code page left no room for.
    for char, rows in latin_glyphs(bitmaps, mapping_cp).items():
        unicode_to_gid[ord(char)] = len(glyphs)
        glyphs.append(glyph_data(rows))

    loca = []
    glyf = bytearray()
    for g in glyphs:
        loca.append(len(glyf))
        glyf += g
    loca.append(len(glyf))

    num_glyphs = len(glyphs)
    xs, ys = [0], [0]
    for g in glyphs:
        if g:
            _, x0, y0, x1, y1 = struct.unpack('>hhhhh', g[:10])
            xs += [x0, x1]
            ys += [y0, y1]

    tables = {}
    tables['glyf'] = bytes(glyf)
    tables['loca'] = b''.join(struct.pack('>I', o) for o in loca)
    tables['cmap'] = cmap_format4(unicode_to_gid)
    # The left side bearing must equal the glyph's own xMin: a rasterizer
    # shifts the outline by (lsb - xMin), so a flat 0 would slide every glyph
    # whose ink starts away from the cell's left edge. That is what pulled the
    # stem of "|" three pixels left and tore the box-drawing lines apart.
    tables['hmtx'] = b''.join(struct.pack('>Hh', ADVANCE, x_min(g)) for g in glyphs)
    # A composed letter carries its mark's rectangles on top of its own, so the
    # counts are measured rather than guessed at.
    max_points = max_contours = 0
    for g in glyphs:
        if not g:
            continue
        contours = struct.unpack('>h', g[:2])[0]
        ends = struct.unpack('>%dH' % contours, g[10:10 + 2 * contours])
        max_contours = max(max_contours, contours)
        max_points = max(max_points, ends[-1] + 1)
    tables['maxp'] = struct.pack('>IHHHHHHHHHHHHHH', 0x00010000, num_glyphs,
                                 max_points, max_contours, 0, 0, 2,
                                 0, 0, 0, 0, 0, 0, 0, 0)
    tables['hhea'] = struct.pack('>IhhhHhhhhhhhhhhhH', 0x00010000, 768, -256, 0,
                                 ADVANCE, 0, 0, ADVANCE, 1, 0, 0, 0, 0, 0, 0, 0,
                                 num_glyphs)
    tables['head'] = struct.pack('>IIIIHHqqhhhhHHhhh', 0x00010000, 0x00010000, 0,
                                 0x5F0F3CF5, 0x000B, UPEM, 0, 0,
                                 min(xs), min(ys), max(xs), max(ys),
                                 0, 16, 2, 1, 0)
    tables['post'] = struct.pack('>IIhhIIIII', 0x00030000, 0, -128, 64, 1, 0, 0, 0, 0)
    tables['OS/2'] = (
        struct.pack('>HhHHHhhhhhhhhhh', 4, ADVANCE, 400, 5, 0,
                    ADVANCE // 2, PIXEL * 4, 0, -PIXEL * 3,
                    ADVANCE // 2, PIXEL * 8, 0, PIXEL * 5,
                    PIXEL, 320)
        + struct.pack('>h', 0)
        + bytes([2, 0, 5, 9, 0, 0, 0, 0, 0, 0])
        + struct.pack('>IIII', 0, 0, 0, 0)
        + b'NONE'
        + struct.pack('>HHHhhhHH', 0x40, 0x20, 0xfffd, 768, -256, 0, 768, 256)
        + struct.pack('>IIhhHHH', 0, 0, PIXEL * 7, PIXEL * 10, 0, 0x20, 1)
    )
    tables['name'] = name_table([
        (0, 'CP866 VGA 8x16 bitmap font extracted from KEYRUS.COM, with '
            'accented Latin letters composed from it'),
        (1, 'Gopnik CP866'),
        (2, 'Regular'),
        (3, 'GopnikCP866-Regular-1.0'),
        (4, 'Gopnik CP866 Regular'),
        (5, 'Version 1.000'),
        (6, 'GopnikCP866-Regular'),
    ])

    order = ['OS/2', 'cmap', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'post']
    count = len(order)
    search = 2 ** (count.bit_length() - 1) * 16
    header = struct.pack('>IHHHH', 0x00010000, count, search,
                         count.bit_length() - 1, count * 16 - search)

    offset = len(header) + 16 * count
    directory = b''
    body = b''
    for tag in order:
        data = tables[tag]
        directory += struct.pack('>4sIII', tag.encode(), checksum(data), offset, len(data))
        padded = data + b'\x00' * ((4 - len(data) % 4) % 4)
        body += padded
        offset += len(padded)

    font = bytearray(header + directory + body)
    adjustment = (0xB1B0AFBA - checksum(bytes(font))) & 0xffffffff
    entry = len(header) + 16 * order.index('head')
    head_start = struct.unpack('>I', bytes(font[entry + 8:entry + 12]))[0]
    font[head_start + 8:head_start + 12] = struct.pack('>I', adjustment)
    return bytes(font)


if __name__ == '__main__':
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(build())
    print('wrote %s (%d bytes)' % (OUT.relative_to(ROOT), OUT.stat().st_size))
