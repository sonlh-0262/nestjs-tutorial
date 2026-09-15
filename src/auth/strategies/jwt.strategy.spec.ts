import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';

import { AuthConfig } from '../../config/auth.config';
import { User } from '../../users/entities/user.entity';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenBlacklistService } from '../token-blacklist.service';
import { JwtStrategy } from './jwt.strategy';

const AUTH_CONFIG: AuthConfig = {
  jwtSecret: 'test-secret-that-is-at-least-32-characters',
  jwtExpiresIn: '1d',
  jwtIssuer: 'nestjs-tutorial',
  bcryptSaltRounds: 4,
};

const PAYLOAD: JwtPayload = {
  sub: 'user-id',
  email: 'jake@jake.jake',
  username: 'jake',
  jti: 'token-id',
  iat: 1_700_000_000,
  exp: 1_700_086_400,
};

const USER = {
  id: 'user-id',
  email: 'jake@jake.jake',
  username: 'jake',
  bio: null,
  image: null,
} as User;

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const usersServiceMock = { findById: jest.fn().mockResolvedValue(USER) };
  const tokenBlacklistMock = { isRevoked: jest.fn().mockResolvedValue(false) };
  const i18nMock = { t: jest.fn((key: string) => key) };
  const configServiceMock = { getOrThrow: jest.fn(() => AUTH_CONFIG) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: TokenBlacklistService, useValue: tokenBlacklistMock },
        { provide: I18nService, useValue: i18nMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  afterEach(() => {
    jest.clearAllMocks();
    usersServiceMock.findById.mockResolvedValue(USER);
    tokenBlacklistMock.isRevoked.mockResolvedValue(false);
  });

  it('returns the user together with the token identity', async () => {
    await expect(strategy.validate(PAYLOAD)).resolves.toEqual({
      user: USER,
      jti: 'token-id',
      expiresAt: PAYLOAD.exp,
    });
  });

  it('looks the user up by the `sub` claim', async () => {
    await strategy.validate(PAYLOAD);

    expect(usersServiceMock.findById).toHaveBeenCalledWith('user-id');
  });

  it('rejects a token that logout has revoked', async () => {
    tokenBlacklistMock.isRevoked.mockResolvedValueOnce(true);

    await expect(strategy.validate(PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(i18nMock.t).toHaveBeenCalledWith('auth.TOKEN_REVOKED');
  });

  it('does not touch the database for a revoked token', async () => {
    tokenBlacklistMock.isRevoked.mockResolvedValueOnce(true);

    await expect(strategy.validate(PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(usersServiceMock.findById).not.toHaveBeenCalled();
  });

  it('rejects a valid token whose user has since been deleted', async () => {
    usersServiceMock.findById.mockResolvedValueOnce(null);

    await expect(strategy.validate(PAYLOAD)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(i18nMock.t).toHaveBeenCalledWith('auth.USER_NOT_FOUND');
  });
});
