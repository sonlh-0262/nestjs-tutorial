import Redis from 'ioredis';

import { RedisConfig } from '../../src/config/redis.config';
import { TEST_REDIS_KEY_PREFIX_MARKER } from './test.constants';

/** The prefix is what is checked because it is what bounds `clearRedis()`. */
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
 * Drops the revoked-token denylist, so a `jti` revoked by a logout case does
 * not outlive it.
 *
 * By prefix rather than `FLUSHDB`, which would empty the whole logical database
 * - wider than what `assertTestRedis()` checks.
 *
 * The prefix is added on the way in and stripped on the way out because ioredis
 * only prefixes arguments a command declares as keys: `KEYS` declares none,
 * `DEL` does.
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
