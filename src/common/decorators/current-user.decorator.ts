import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { User } from '../../users/entities/user.entity';

function authenticated(context: ExecutionContext): AuthenticatedUser {
  return context.switchToHttp().getRequest<{ user: AuthenticatedUser }>().user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    authenticated(context).user,
);

export const CurrentToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): TokenIdentity => {
    const { jti, expiresAt } = authenticated(context);

    return { jti, expiresAt };
  },
);

export interface TokenIdentity {
  jti: string;
  expiresAt: number;
}
