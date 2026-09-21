import { PG_UNIQUE_VIOLATION } from './database.constants';

export function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    code?: unknown;
    driverError?: { code?: unknown };
  };

  return (
    candidate.code === PG_UNIQUE_VIOLATION ||
    candidate.driverError?.code === PG_UNIQUE_VIOLATION
  );
}
