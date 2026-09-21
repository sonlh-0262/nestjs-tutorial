import { randomBytes } from 'crypto';

import { SLUG_BASE_MAX_LENGTH, SLUG_SUFFIX_LENGTH } from './articles.constants';

const COMBINING_MARKS = /[̀-ͯ]/g;

const NOT_SLUG_SAFE = /[^a-z0-9]+/g;

const LEADING_OR_TRAILING_HYPHENS = /^-+|-+$/g;

const TRAILING_HYPHENS = /-+$/g;

export function slugify(title: string): string {
  return title
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(NOT_SLUG_SAFE, '-')
    .replace(LEADING_OR_TRAILING_HYPHENS, '')
    .slice(0, SLUG_BASE_MAX_LENGTH)
    .replace(TRAILING_HYPHENS, '');
}

export function randomSlugSuffix(): string {
  return randomBytes(SLUG_SUFFIX_LENGTH)
    .toString('base64url')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, SLUG_SUFFIX_LENGTH)
    .padEnd(SLUG_SUFFIX_LENGTH, '0');
}

export function slugCandidate(title: string, attempt: number): string {
  const base = slugify(title);

  if (!base) {
    return randomSlugSuffix();
  }

  return attempt === 0 ? base : `${base}-${randomSlugSuffix()}`;
}
