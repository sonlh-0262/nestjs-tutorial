import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';

import { User } from '../users/entities/user.entity';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import { LoginUserBodyDto } from './dto/login.dto';
import { RegisterUserBodyDto } from './dto/register.dto';
import { JwtPayloadClaims } from './interfaces/jwt-payload.interface';
import { TokenBlacklistService } from './token-blacklist.service';

export const DUMMY_PASSWORD_HASH =
  '$2b$10$18jA5vncNymIApDQRXbrwOB7ht1TAxRfCgTJV.k06jUOU18IWZl5e';

const PG_UNIQUE_VIOLATION = '23505';

export interface AuthenticationResult {
  user: User;
  token: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly i18n: I18nService,
  ) {}

  async register(input: RegisterUserBodyDto): Promise<AuthenticationResult> {
    await this.usersService.assertCredentialsAvailable(
      input.email,
      input.username,
    );

    const passwordHash = await this.passwordService.hash(input.password);

    let user: User;
    try {
      user = await this.usersService.create({
        username: input.username,
        email: input.email,
        passwordHash,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        await this.usersService.assertCredentialsAvailable(
          input.email,
          input.username,
        );
      }
      throw error;
    }

    this.logger.log(`Registered user ${user.username} (${user.id})`);

    return { user, token: this.issueToken(user) };
  }

  async login(input: LoginUserBodyDto): Promise<AuthenticationResult> {
    const user = await this.usersService.findByEmailWithPassword(input.email);

    const passwordMatches = await this.passwordService.compare(
      input.password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      throw new UnauthorizedException(this.i18n.t('auth.INVALID_CREDENTIALS'));
    }

    delete (user as Partial<User>).passwordHash;

    return { user, token: this.issueToken(user) };
  }

  async logout(jti: string, expiresAt: number): Promise<boolean> {
    const revoked = await this.tokenBlacklist.revoke(jti, expiresAt);

    if (revoked) {
      this.logger.log(`Logged out token ${jti}`);
    }

    return revoked;
  }

  private issueToken(user: User): string {
    const claims: JwtPayloadClaims = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    return this.jwtService.sign(claims, { jwtid: randomUUID() });
  }
}

function isUniqueViolation(error: unknown): boolean {
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
