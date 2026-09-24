/**
 * Constants owned by the e2e harness.
 *
 * The three markers below are safety rails, not settings: `reset()` destroys
 * whatever each store holds, so each one has to prove it is a test store first.
 */

export const TEST_DATABASE_SUFFIX = '_test';

export const TEST_REDIS_KEY_PREFIX_MARKER = 'test';

export const TEST_UPLOAD_DIR_LEAF = 'test';

/**
 * Postgres has no `CREATE DATABASE IF NOT EXISTS` and will not create the
 * database you are connected to, so `global-setup.ts` borrows this one.
 */
export const MAINTENANCE_DATABASE = 'postgres';

/** `duplicate_database`, raised when two jest runs race to create it. */
export const PG_DUPLICATE_DATABASE = '42P04';

/** Long enough for `RegisterUserDto`'s rules, so seeded users can also log in. */
export const SEEDED_USER_PASSWORD = 'Sup3rS3cret!';

/** Gap between the rows `createThread()` backdates. */
export const SEEDED_ROW_INTERVAL_MS = 1_000;
