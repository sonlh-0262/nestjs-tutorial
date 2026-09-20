import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { I18nService } from 'nestjs-i18n';

import { JWT_STRATEGY_NAME } from '../auth.constants';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard(JWT_STRATEGY_NAME) {
  constructor(private readonly i18n: I18nService) {
    super();
  }

  handleRequest<TUser>(
    error: unknown,
    user: TUser | false,
    _info: unknown,
    context: ExecutionContext,
  ): TUser | undefined {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();

    if (!request.headers.authorization) {
      return undefined;
    }

    if (error) {
      throw error instanceof Error
        ? error
        : new UnauthorizedException(this.i18n.t('auth.UNAUTHORIZED'));
    }

    if (!user) {
      throw new UnauthorizedException(this.i18n.t('auth.UNAUTHORIZED'));
    }

    return user;
  }
}
