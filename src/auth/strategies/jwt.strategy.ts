import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthConfig, AUTH_CONFIG_KEY } from '../../config/auth.config';
import { UsersService } from '../../users/users.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { TokenBlacklistService } from '../token-blacklist.service';

export const JWT_STRATEGY_NAME = 'jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY_NAME) {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokenBlacklist: TokenBlacklistService,
    private readonly i18n: I18nService,
    configService: ConfigService,
  ) {
    const config = configService.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY);

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderWithScheme('Token'),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
      issuer: config.jwtIssuer,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (await this.tokenBlacklist.isRevoked(payload.jti)) {
      throw new UnauthorizedException(this.i18n.t('auth.TOKEN_REVOKED'));
    }

    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.USER_NOT_FOUND'));
    }

    return { user, jti: payload.jti, expiresAt: payload.exp };
  }
}
