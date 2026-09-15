import { Test, TestingModule } from '@nestjs/testing';

import { REDIS_CLIENT } from '../redis/redis.constants';
import { TokenBlacklistService } from './token-blacklist.service';

describe('TokenBlacklistService', () => {
  let service: TokenBlacklistService;

  const redisMock = {
    set: jest.fn().mockResolvedValue('OK'),
    exists: jest.fn().mockResolvedValue(0),
  };

  const NOW_SECONDS = 1_700_000_000;

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(NOW_SECONDS * 1000);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenBlacklistService,
        { provide: REDIS_CLIENT, useValue: redisMock },
      ],
    }).compile();

    service = module.get(TokenBlacklistService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('revoke', () => {
    it('stores the jti with a TTL matching the token lifetime', async () => {
      const expiresAt = NOW_SECONDS + 3600;

      await expect(service.revoke('token-id', expiresAt)).resolves.toBe(true);

      expect(redisMock.set).toHaveBeenCalledWith(
        'auth:denylist:token-id',
        '1',
        'EX',
        3600,
      );
    });

    it('does not store an already expired token', async () => {
      await expect(service.revoke('token-id', NOW_SECONDS - 1)).resolves.toBe(
        false,
      );

      expect(redisMock.set).not.toHaveBeenCalled();
    });

    it('does not store a token expiring exactly now', async () => {
      await expect(service.revoke('token-id', NOW_SECONDS)).resolves.toBe(
        false,
      );

      expect(redisMock.set).not.toHaveBeenCalled();
    });
  });

  describe('isRevoked', () => {
    it('is false for a jti Redis does not hold', async () => {
      redisMock.exists.mockResolvedValueOnce(0);

      await expect(service.isRevoked('token-id')).resolves.toBe(false);
      expect(redisMock.exists).toHaveBeenCalledWith('auth:denylist:token-id');
    });

    it('is true for a jti Redis holds', async () => {
      redisMock.exists.mockResolvedValueOnce(1);

      await expect(service.isRevoked('token-id')).resolves.toBe(true);
    });
  });
});
