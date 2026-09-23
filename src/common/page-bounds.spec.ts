import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
} from './constants/pagination';
import { pageBounds } from './page-bounds';

describe('pageBounds', () => {
  it('falls back to the shared defaults for an empty query', () => {
    expect(pageBounds({})).toEqual({
      take: DEFAULT_PAGE_LIMIT,
      skip: DEFAULT_PAGE_OFFSET,
    });
  });

  it('uses the bounds the caller asked for', () => {
    expect(pageBounds({ limit: 5, offset: 10 })).toEqual({
      take: 5,
      skip: 10,
    });
  });

  it('defaults each bound on its own', () => {
    expect(pageBounds({ offset: 10 })).toEqual({
      take: DEFAULT_PAGE_LIMIT,
      skip: 10,
    });
    expect(pageBounds({ limit: 5 })).toEqual({
      take: 5,
      skip: DEFAULT_PAGE_OFFSET,
    });
  });

  it('keeps an explicit zero offset rather than defaulting it', () => {
    expect(pageBounds({ offset: 0 }).skip).toBe(0);
  });
});
