import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';

const contextWith = (authorization?: string): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  }) as unknown as ExecutionContext;

describe('OptionalJwtAuthGuard', () => {
  const i18n = { t: jest.fn((key: string) => key) } as unknown as I18nService;
  const guard = new OptionalJwtAuthGuard(i18n);

  const user = {
    user: { id: 'user-id' },
    jti: 'jti',
    expiresAt: 1,
  } as AuthenticatedUser;

  it('passes the user through when the token is valid', () => {
    expect(
      guard.handleRequest(null, user, undefined, contextWith('Token good')),
    ).toBe(user);
  });

  it('returns undefined when no Authorization header was sent', () => {
    expect(
      guard.handleRequest(null, false, undefined, contextWith()),
    ).toBeUndefined();
  });

  it('stays anonymous even if passport reported an error, when no header was sent', () => {
    expect(
      guard.handleRequest(
        new Error('no auth token'),
        false,
        undefined,
        contextWith(),
      ),
    ).toBeUndefined();
  });

  it('rejects a header carrying a token that did not validate', () => {
    expect(() =>
      guard.handleRequest(null, false, undefined, contextWith('Token stale')),
    ).toThrow(UnauthorizedException);
  });

  it('propagates the error passport raised for a bad token', () => {
    const revoked = new UnauthorizedException('auth.TOKEN_REVOKED');

    expect(() =>
      guard.handleRequest(revoked, false, undefined, contextWith('Token bad')),
    ).toThrow(revoked);
  });

  it('wraps a non-Error rejection in a 401', () => {
    expect(() =>
      guard.handleRequest('nope', false, undefined, contextWith('Token bad')),
    ).toThrow(UnauthorizedException);
  });

  it('reads the header from the context rather than remembering it', () => {
    expect(
      guard.handleRequest(null, false, undefined, contextWith()),
    ).toBeUndefined();
    expect(() =>
      guard.handleRequest(null, false, undefined, contextWith('Token stale')),
    ).toThrow(UnauthorizedException);
    expect(
      guard.handleRequest(null, user, undefined, contextWith('Token good')),
    ).toBe(user);
  });
});
