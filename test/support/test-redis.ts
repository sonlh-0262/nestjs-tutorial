import Redis from 'ioredis';

import { RedisConfig } from '../../src/config/redis.config';
import { TEST_REDIS_KEY_PREFIX_MARKER } from './test.constants';

/**
 * Refuses to run against a Redis the suite has no claim on.
 *
 * The prefix is the thing checked because the prefix is the thing that bounds
 * what `clearRedis()` deletes - see below.
 */
export function assertTestRedis(config: RedisConfig): void {
  if (config.keyPrefix.includes(TEST_REDIS_KEY_PREFIX_MARKER)) {
    return;
  }

  throw new Error(
    `Refusing to run the e2e suite with the Redis key prefix ` +
      `"${config.keyPrefix}": the suite deletes every key under that prefix ` +
      `between test cases, so REDIS_KEY_PREFIX must contain ` +
      `"${TEST_REDIS_KEY_PREFIX_MARKER}". Check .env.test.`,
  );
}

/**
 * Drops the revoked-token denylist between test cases.
 *
 * Without it a token revoked by a logout case stays revoked for as long as
 * Redis keeps the key, and the next case to reuse that `jti` fails for a reason
 * that is not in its own body.
 *
 * `FLUSHDB` would be one round trip instead of two, but it empties the whole
 * logical database - which the key prefix does not describe. Deleting by prefix
 * keeps the blast radius equal to what `assertTestRedis()` actually checks.
 *
 * The two `keyPrefix` adjustments are not symmetrical, and ioredis is the
 * reason: it prefixes arguments a command declares as keys, and `KEYS` declares
 * none. So the pattern has to carry the prefix, the names come back carrying
 * it, and `DEL` - which does declare keys - has to be handed them without it.
 */
export async function clearRedis(
  redis: Redis,
  config: RedisConfig,
): Promise<void> {
  const keys = await redis.keys(`${config.keyPrefix}*`);

  if (keys.length === 0) {
    return;
  }

  await redis.del(...keys.map((key) => key.slice(config.keyPrefix.length)));
}
