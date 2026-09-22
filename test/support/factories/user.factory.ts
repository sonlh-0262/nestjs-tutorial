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
   * Inserts a user directly, bypassing `POST /users`.
   *
   * Going through the endpoint would make every test that needs an author
   * depend on registration still working, and would turn a broken
   * `AuthController` into a hundred red tests pointing nowhere.
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
   * The same user, plus credentials. The token comes from `AuthService` rather
   * than from a locally assembled JWT so the suite exercises the tokens the
   * application actually issues - claims, `jti` and expiry included.
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
