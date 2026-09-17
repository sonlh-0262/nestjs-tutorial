import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { I18nService } from 'nestjs-i18n';

import { AuthConfig } from '../config/auth.config';
import { User } from '../users/entities/user.entity';
import { PasswordService } from '../users/password.service';
import { UsersService } from '../users/users.service';
import { DUMMY_PASSWORD_HASH } from './auth.constants';
import { AuthService } from './auth.service';
import { TokenBlacklistService } from './token-blacklist.service';

const AUTH_CONFIG: AuthConfig = {
  jwtSecret: 'test-secret-that-is-at-least-32-characters',
  jwtExpiresIn: '1d',
  jwtIssuer: 'nestjs-tutorial',
  bcryptSaltRounds: 4,
};

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-id',
  email: 'jake@jake.jake',
  username: 'jake',
  passwordHash: 'hashed',
  bio: null,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;

  const usersServiceMock = {
    assertCredentialsAvailable: jest.fn().mockResolvedValue(undefined),
    findByEmailWithPassword: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  };

  const passwordService = new PasswordService({
    getOrThrow: () => AUTH_CONFIG,
  } as unknown as ConfigService);

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue('signed.jwt.token'),
  };

  const tokenBlacklistMock = {
    revoke: jest.fn().mockResolvedValue(true),
    isRevoked: jest.fn().mockResolvedValue(false),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: PasswordService, useValue: passwordService },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: TokenBlacklistService, useValue: tokenBlacklistMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    usersServiceMock.assertCredentialsAvailable.mockResolvedValue(undefined);
    usersServiceMock.findByEmailWithPassword.mockResolvedValue(null);
  });

  describe('register', () => {
    const input = {
      username: 'jake',
      email: 'jake@jake.jake',
      password: 'Sup3rS3cret!',
    };

    it('creates the user and returns a token', async () => {
      usersServiceMock.create.mockResolvedValueOnce(buildUser());

      const result = await service.register(input);

      expect(result.token).toBe('signed.jwt.token');
      expect(result.user.username).toBe('jake');
    });

    it('stores a bcrypt hash rather than the password', async () => {
      usersServiceMock.create.mockResolvedValueOnce(buildUser());

      await service.register(input);

      const [{ passwordHash }] = usersServiceMock.create.mock.calls[0] as [
        { passwordHash: string },
      ];

      expect(passwordHash).not.toBe(input.password);
      expect(passwordHash).toMatch(/^\$2[aby]\$/);
      await expect(bcrypt.compare(input.password, passwordHash)).resolves.toBe(
        true,
      );
    });

    it('signs a token carrying a unique jti', async () => {
      usersServiceMock.create.mockResolvedValue(buildUser());

      await service.register(input);
      await service.register(input);

      const [firstCall, secondCall] = jwtServiceMock.sign.mock.calls as [
        [unknown, { jwtid: string }],
        [unknown, { jwtid: string }],
      ];

      expect(firstCall[1].jwtid).not.toBe(secondCall[1].jwtid);
    });

    it('signs the user id, email and username as claims', async () => {
      usersServiceMock.create.mockResolvedValueOnce(buildUser());

      await service.register(input);

      expect(jwtServiceMock.sign).toHaveBeenCalledWith(
        { sub: 'user-id', email: 'jake@jake.jake', username: 'jake' },
        expect.objectContaining({ jwtid: expect.any(String) as string }),
      );
    });

    it('checks the email and username before creating anything', async () => {
      usersServiceMock.create.mockResolvedValueOnce(buildUser());

      await service.register(input);

      expect(usersServiceMock.assertCredentialsAvailable).toHaveBeenCalledWith(
        input.email,
        input.username,
      );
    });

    it('rejects credentials that are already taken', async () => {
      usersServiceMock.assertCredentialsAvailable.mockRejectedValueOnce(
        new ConflictException('auth.EMAIL_TAKEN'),
      );

      await expect(service.register(input)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersServiceMock.create).not.toHaveBeenCalled();
    });

    it('turns a lost race into the same conflict as the up-front check', async () => {
      usersServiceMock.create.mockRejectedValueOnce({ code: '23505' });
      usersServiceMock.assertCredentialsAvailable
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new ConflictException('auth.EMAIL_TAKEN'));

      await expect(service.register(input)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows a database error that is not a unique violation', async () => {
      const failure = Object.assign(new Error('connection lost'), {
        code: '08006',
      });
      usersServiceMock.create.mockRejectedValueOnce(failure);

      await expect(service.register(input)).rejects.toBe(failure);
    });
  });

  describe('login', () => {
    it('returns a token for the right password', async () => {
      const password = 'Sup3rS3cret!';
      const user = buildUser({ passwordHash: await bcrypt.hash(password, 4) });
      usersServiceMock.findByEmailWithPassword.mockResolvedValueOnce(user);

      const result = await service.login({ email: 'jake@jake.jake', password });

      expect(result.token).toBe('signed.jwt.token');
    });

    it('strips the password hash from the user it returns', async () => {
      const password = 'Sup3rS3cret!';
      const user = buildUser({ passwordHash: await bcrypt.hash(password, 4) });
      usersServiceMock.findByEmailWithPassword.mockResolvedValueOnce(user);

      const result = await service.login({ email: 'jake@jake.jake', password });

      expect(result.user.passwordHash).toBeUndefined();
    });

    it('rejects a wrong password', async () => {
      const user = buildUser({
        passwordHash: await bcrypt.hash('Sup3rS3cret!', 4),
      });
      usersServiceMock.findByEmailWithPassword.mockResolvedValueOnce(user);

      await expect(
        service.login({ email: 'jake@jake.jake', password: 'wrong-password' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an unknown email with the same message as a wrong password', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(i18nMock.t).toHaveBeenCalledWith('auth.INVALID_CREDENTIALS');
    });

    it('falls back to a bcrypt hash no password can match', async () => {
      expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$\d{2}\$.{53}$/);
      await expect(
        bcrypt.compare('whatever', DUMMY_PASSWORD_HASH),
      ).resolves.toBe(false);
    });

    it('issues no token for a failed login', async () => {
      usersServiceMock.findByEmailWithPassword.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'whatever' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(jwtServiceMock.sign).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('revokes the token it was called with', async () => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600;

      await expect(service.logout('token-id', expiresAt)).resolves.toBe(true);
      expect(tokenBlacklistMock.revoke).toHaveBeenCalledWith(
        'token-id',
        expiresAt,
      );
    });

    it('reports that an already expired token needed no revoking', async () => {
      tokenBlacklistMock.revoke.mockResolvedValueOnce(false);

      await expect(service.logout('token-id', 1)).resolves.toBe(false);
    });
  });
});
