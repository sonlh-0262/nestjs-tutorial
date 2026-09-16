const MAX_LENGTH = 255;

const FALLBACK = 'upload';

const FIRST_PRINTABLE = 0x20;
const DEL = 0x7f;

const SEPARATORS = new Set([0x2f, 0x5c]);

const FORBIDDEN = new Set([0x22, 0x27, 0x60]);

function isSafe(character: string): boolean {
  const code = character.charCodeAt(0);

  return code >= FIRST_PRINTABLE && code !== DEL && !FORBIDDEN.has(code);
}

function leafOf(original: string): string[] {
  const characters = [...original];

  for (let index = characters.length - 1; index >= 0; index -= 1) {
    if (SEPARATORS.has(characters[index].charCodeAt(0))) {
      return characters.slice(index + 1);
    }
  }

  return characters;
}

function collapseWhitespace(value: string): string {
  return value
    .split(' ')
    .filter((part) => part !== '')
    .join(' ');
}

function stripLeadingDots(value: string): string {
  let result = value;

  while (result.startsWith('.')) {
    result = result.slice(1);
  }

  return result;
}

export function sanitiseFileName(original: string, extension: string): string {
  const cleaned = leafOf(original)
    .map((character) => (isSafe(character) ? character : ' '))
    .join('');

  const base = stripLeadingDots(collapseWhitespace(cleaned).trim());

  const named = base === '' ? FALLBACK : base;

  const withExtension = named.toLowerCase().endsWith(`.${extension}`)
    ? named
    : `${named}.${extension}`;

  return withExtension.length > MAX_LENGTH
    ? `${withExtension.slice(0, MAX_LENGTH - extension.length - 1)}.${extension}`
    : withExtension;
}
