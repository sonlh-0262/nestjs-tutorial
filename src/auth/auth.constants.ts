/**
 * Constants owned by the auth module.
 *
 * Kept in one file so the strategy, the guard, the module wiring and the DTOs
 * all share the same literals instead of each re-declaring their own copy.
 */

/**
 * Name the JWT Passport strategy registers itself under.
 *
 * `PassportModule.register`, `PassportStrategy(...)` and `AuthGuard(...)` have
 * to agree on this string or the guard resolves no strategy at runtime.
 */
export const JWT_STRATEGY_NAME = 'jwt';

/**
 * Non-standard `Authorization` scheme the RealWorld spec uses
 * (`Authorization: Token <jwt>`). Accepted alongside `Bearer`.
 */
export const JWT_AUTH_HEADER_SCHEME = 'Token';

/** Redis key prefix for the denylist of revoked token ids (`jti`). */
export const TOKEN_DENYLIST_KEY_PREFIX = 'auth:denylist:';

/** Redis value stored against a revoked `jti`; only the key's existence matters. */
export const TOKEN_DENYLIST_VALUE = '1';

/**
 * Hash compared against when login is given an unknown email, so a request for
 * a missing account costs the same bcrypt work as one for an existing account
 * and cannot be told apart by response time.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$10$18jA5vncNymIApDQRXbrwOB7ht1TAxRfCgTJV.k06jUOU18IWZl5e';

/** Minimum password length accepted on registration. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Maximum password length accepted on registration.
 *
 * bcrypt silently truncates anything past 72 bytes, so a longer password would
 * give the user a false sense of strength.
 */
export const PASSWORD_MAX_LENGTH = 72;
