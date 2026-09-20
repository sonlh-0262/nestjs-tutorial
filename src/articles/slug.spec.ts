import { SLUG_BASE_MAX_LENGTH, SLUG_SUFFIX_LENGTH } from './articles.constants';
import { randomSlugSuffix, slugCandidate, slugify } from './slug';

describe('slugify', () => {
  it('lower-cases and hyphenates a title', () => {
    expect(slugify('How To Train Your Dragon')).toBe(
      'how-to-train-your-dragon',
    );
  });

  it('collapses runs of punctuation into a single hyphen', () => {
    expect(slugify('Hello --- world!!!  again')).toBe('hello-world-again');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  ...Dragons...  ')).toBe('dragons');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Café Crème')).toBe('cafe-creme');
  });

  it('keeps digits', () => {
    expect(slugify('Top 10 dragons')).toBe('top-10-dragons');
  });

  it('returns an empty string for a title with no latin characters', () => {
    expect(slugify('こんにちは')).toBe('');
  });

  it('truncates to leave room for a suffix', () => {
    const slug = slugify('a'.repeat(SLUG_BASE_MAX_LENGTH + 50));

    expect(slug).toHaveLength(SLUG_BASE_MAX_LENGTH);
  });

  it('never ends on a hyphen after truncating', () => {
    const title = `${'a'.repeat(SLUG_BASE_MAX_LENGTH - 1)} tail`;

    expect(slugify(title).endsWith('-')).toBe(false);
  });
});

describe('randomSlugSuffix', () => {
  it('is url-safe and of the configured length', () => {
    const suffix = randomSlugSuffix();

    expect(suffix).toHaveLength(SLUG_SUFFIX_LENGTH);
    expect(suffix).toMatch(/^[a-z0-9]+$/);
  });

  it('differs between calls', () => {
    const suffixes = new Set(
      Array.from({ length: 50 }, () => randomSlugSuffix()),
    );

    expect(suffixes.size).toBeGreaterThan(1);
  });
});

describe('slugCandidate', () => {
  it('offers the clean slug first', () => {
    expect(slugCandidate('How to train your dragon', 0)).toBe(
      'how-to-train-your-dragon',
    );
  });

  it('appends a discriminator on later attempts', () => {
    const candidate = slugCandidate('How to train your dragon', 1);

    expect(candidate).toMatch(/^how-to-train-your-dragon-[a-z0-9]{6}$/);
  });

  it('gives a different discriminator each attempt', () => {
    const first = slugCandidate('Dragons', 1);
    const second = slugCandidate('Dragons', 1);

    expect(first).not.toBe(second);
  });

  it('falls back to a random slug when the title slugifies to nothing', () => {
    const candidate = slugCandidate('こんにちは', 0);

    expect(candidate).toMatch(/^[a-z0-9]{6}$/);
  });

  it('never exceeds the column width', () => {
    const candidate = slugCandidate('a'.repeat(1000), 1);

    expect(candidate.length).toBeLessThanOrEqual(
      SLUG_BASE_MAX_LENGTH + SLUG_SUFFIX_LENGTH + 1,
    );
  });
});
