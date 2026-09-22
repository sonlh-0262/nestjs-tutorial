import { randomUUID } from 'crypto';

import { RegisterCredentials } from './interfaces/register-credentials.interface';
import { SEEDED_USER_PASSWORD } from './test.constants';

/**
 * A fresh set of registration credentials.
 *
 * Three spec files carried a byte-identical copy of this, each repeating the
 * password literal that `test.constants.ts` already owned. Registration is the
 * one arrangement the factories cannot stand in for - in those cases
 * `POST /users` *is* the code under test - so the builder stays, in one place.
 *
 * A random suffix rather than `nextSequence()`: these values are also asserted
 * against response bodies, and a uuid fragment cannot collide with a row some
 * earlier case left behind if truncation is ever switched off while debugging.
 */
export function buildCredentials(): RegisterCredentials {
  const suffix = randomUUID().slice(0, 8);

  return {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: SEEDED_USER_PASSWORD,
  };
}
