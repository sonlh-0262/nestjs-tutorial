import { DeepPartial, Repository } from 'typeorm';

import { AuthService } from '../../../src/auth/auth.service';
import { User } from '../../../src/users/entities/user.entity';
import { PasswordService } from '../../../src/users/password.service';
import { SeededUser } from '../interfaces/seeded-user.interface';
import { SEEDED_USER_PASSWORD } from '../test.constants';
import { nextSequence } from './sequence';

export class UserFactory {
  constructor(
    private readonly users: Repository<User>,
    private readonly passwords: PasswordService,
    private readonly auth: AuthService,
  ) {}

  /**
   * Inserts directly rather than through `POST /users`, so a broken
   * `AuthController` reddens the registration tests and nothing else.
   */
  async create(overrides: DeepPartial<User> = {}): Promise<User> {
    const sequence = nextSequence();

    return this.users.save(
      this.users.create({
        username: `user-${sequence}`,
        email: `user-${sequence}@example.com`,
        passwordHash: await this.passwords.hash(SEEDED_USER_PASSWORD),
        bio: null,
        image: null,
        ...overrides,
      }),
    );
  }

  /**
   * The token comes from `AuthService` rather than a locally assembled JWT, so
   * the suite drives the endpoints with the tokens the app actually issues.
   */
  async createAuthenticated(
    overrides: DeepPartial<User> = {},
  ): Promise<SeededUser> {
    const user = await this.create(overrides);

    return {
      user,
      password: SEEDED_USER_PASSWORD,
      token: this.auth.issueToken(user),
    };
  }
}
