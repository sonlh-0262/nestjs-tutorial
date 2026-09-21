import { PG_UNIQUE_VIOLATION } from './database.constants';
import { isUniqueViolation } from './is-unique-violation';

describe('isUniqueViolation', () => {
  it('recognises the code on the error itself', () => {
    expect(isUniqueViolation({ code: PG_UNIQUE_VIOLATION })).toBe(true);
  });

  it('recognises the code nested under driverError', () => {
    expect(
      isUniqueViolation({ driverError: { code: PG_UNIQUE_VIOLATION } }),
    ).toBe(true);
  });

  it('rejects a different postgres error', () => {
    expect(isUniqueViolation({ code: '23503' })).toBe(false);
  });

  it('rejects an ordinary error', () => {
    expect(isUniqueViolation(new Error('boom'))).toBe(false);
  });

  it('rejects non-objects', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(PG_UNIQUE_VIOLATION)).toBe(false);
  });
});
