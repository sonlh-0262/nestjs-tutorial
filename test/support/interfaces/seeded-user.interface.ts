import { User } from '../../../src/users/entities/user.entity';

/**
 * A seeded user together with the two things a test needs to act as them: the
 * plaintext password (the column stores only a hash) and a signed token.
 */
export interface SeededUser {
  user: User;
  password: string;
  token: string;
}
