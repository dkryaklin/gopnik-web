/** The ASCII art, byte for byte from the code segment. Not translated. */

export const BANNER: readonly string[] = [
  '                  ^0┌──── ┌────┐ ┌────┐  │    │  │    │  │    /',
  '                  ^1│     │    │ │    │  │    │  │    │  │   / ',
  '                  ^2│     │    │ │    │  │    │  │    │  │  /  ',
  '                  ^3│     │    │ │    │  ├────┤  │   /│  │_/   ',
  '                  ^4│     │    │ │    │  │    │  │  / │  │ \\   ',
  '                  ^5│     │    │ │    │  │    │  │ /  │  │  \\  ',
  '                  ^6│     │    │ │    │  │    │  │/   │  │   \\ ',
  '                  ^7│     └────┘ │    │  │    │  │    │  │    \\',
]

/** The GOP logo on the end screen; the colour digit is filled in at runtime. */
export const END_LOGO: readonly string[] = [
  '│    │ ┌────┐ ┌────┐  ┌────┐     │    │ ┌────┐ │    │ ┌────┐',
  '│    │ │      │    │  │          │    │ │    │ │    │ │    │',
  '│    │ │      │    │  │           \\  /  │    │ │    │ │    │',
  '│   /│ │      │    │  │            \\/   │    │ │    │ │    │',
  '│  / │ │      ├────┘  ├────        /\\   │    │ ├────┤ │    │',
  '│ /  │ │      │       │           /  \\  ├────┤ │    │ ├────┤',
  '│/   │ │      │       │          │    │ │    │ │    │ │    │',
  '│    │ │      │       └────┘     │    │ │    │ │    │ │    │',
]

/** "ТЫ СУПЕР ГОП", one letter per colour slot, drawn from slot 10 down to 1. */
export const WIN_LETTERS: readonly string[] = ['Т', 'Ы ', 'С', 'У', 'П', 'Е', 'Р ', 'Г', 'О', 'П']
