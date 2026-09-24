import { randomUUID } from 'crypto';

import { RegisterCredentials } from './interfaces/register-credentials.interface';
import { SEEDED_USER_PASSWORD } from './test.constants';

/**
 * Credentials for the cases where `POST /users` is the code under test, and a
 * factory therefore cannot stand in for it.
 */
export function buildCredentials(): RegisterCredentials {
  const suffix = randomUUID().slice(0, 8);

  return {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: SEEDED_USER_PASSWORD,
  };
}
