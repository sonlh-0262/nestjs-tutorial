import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';

import { REDIS_CLIENT } from '../redis/redis.constants';
import {
  TOKEN_DENYLIST_KEY_PREFIX,
  TOKEN_DENYLIST_VALUE,
} from './auth.constants';

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async revoke(jti: string, expiresAt: number): Promise<boolean> {
    const ttlSeconds = expiresAt - Math.floor(Date.now() / 1000);

    if (ttlSeconds <= 0) {
      return false;
    }

    await this.redis.set(this.key(jti), TOKEN_DENYLIST_VALUE, 'EX', ttlSeconds);
    this.logger.debug(`Revoked token ${jti} for ${ttlSeconds}s`);

    return true;
  }

  async isRevoked(jti: string): Promise<boolean> {
    return (await this.redis.exists(this.key(jti))) === 1;
  }

  private key(jti: string): string {
    return `${TOKEN_DENYLIST_KEY_PREFIX}${jti}`;
  }
}
