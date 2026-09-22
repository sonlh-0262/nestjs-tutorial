/**
 * Constants owned by the e2e harness.
 *
 * The first two are safety rails rather than settings: the harness destroys
 * data between test cases, so it needs a way to be sure the data it is about to
 * destroy is test data.
 */

/**
 * Every e2e run must point at a database whose name ends in this. `DELETE FROM`
 * every table does not ask twice, so the suffix is the one thing standing
 * between a mis-set `DB_DATABASE` and someone's development rows.
 */
export const TEST_DATABASE_SUFFIX = '_test';

/**
 * Same idea for Redis. The harness `FLUSHDB`s the configured logical database
 * to drop revoked tokens, so the key prefix has to say it is a test one.
 */
export const TEST_REDIS_KEY_PREFIX_MARKER = 'test';

/**
 * The maintenance database `global-setup.ts` connects to in order to `CREATE`
 * the test database. Postgres has no "create if missing" for databases and
 * will not create the one you are connected to.
 */
export const MAINTENANCE_DATABASE = 'postgres';

/** `duplicate_database`, raised when two jest runs race to create it. */
export const PG_DUPLICATE_DATABASE = '42P04';

/**
 * The password every seeded user is given, so a test that needs to log one in
 * has something to send. Long enough for `RegisterUserDto`'s rules.
 */
export const SEEDED_USER_PASSWORD = 'Sup3rS3cret!';

/**
 * Gap between rows that `createThread()` backdates.
 *
 * `timestamptz` keeps microseconds, but a whole second makes the intent
 * obvious in a failure message and leaves room for a test to insert a row
 * "between" two seeded ones.
 */
export const SEEDED_ROW_INTERVAL_MS = 1_000;

/**
 * Final path segment `UPLOAD_DIR` must have. `reset()` deletes that directory
 * between test cases, so - like the database suffix above - it is a rail, not a
 * setting.
 */
export const TEST_UPLOAD_DIR_LEAF = 'test';
