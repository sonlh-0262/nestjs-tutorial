import { MIN_JWT_SECRET_LENGTH, validateEnv } from './env.validation';

/** Shortest value that satisfies the production secret rule. */
const VALID_SECRET = 'x'.repeat(MIN_JWT_SECRET_LENGTH);

describe('validateEnv', () => {
  it('accepts an empty environment (every variable has a default)', () => {
    expect(() => validateEnv({})).not.toThrow();
  });

  it('coerces PORT to a number', () => {
    expect(validateEnv({ PORT: '3000' }).PORT).toBe(3000);
  });

  it('accepts a full, valid environment', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        PORT: '8080',
        APP_NAME: 'API',
        API_PREFIX: 'api/v1',
        FALLBACK_LANGUAGE: 'jp',
        SWAGGER_PATH: 'docs',
        SWAGGER_ENABLED: 'false',
        DB_HOST: 'db.internal',
        DB_PORT: '5432',
        DB_USERNAME: 'app',
        DB_PASSWORD: 'secret',
        DB_DATABASE: 'app_production',
        DB_SCHEMA: 'public',
        DB_SSL: 'true',
        DB_LOGGING: 'false',
        REDIS_HOST: 'redis.internal',
        REDIS_PORT: '6379',
        REDIS_PASSWORD: 'redis-secret',
        REDIS_DB: '1',
        REDIS_KEY_PREFIX: 'app:',
        JWT_SECRET: VALID_SECRET,
        JWT_EXPIRES_IN: '15m',
        JWT_ISSUER: 'api',
        BCRYPT_SALT_ROUNDS: '12',
      }),
    ).not.toThrow();
  });

  it('ignores variables it does not know about', () => {
    expect(() => validateEnv({ SOME_OTHER_TOOL: 'whatever' })).not.toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ NODE_ENV: 'staging' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a non-numeric PORT', () => {
    expect(() => validateEnv({ PORT: 'not-a-port' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects an out-of-range PORT', () => {
    expect(() => validateEnv({ PORT: '70000' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects a non-boolean SWAGGER_ENABLED', () => {
    expect(() => validateEnv({ SWAGGER_ENABLED: 'yes' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('accepts each supported FALLBACK_LANGUAGE', () => {
    expect(() => validateEnv({ FALLBACK_LANGUAGE: 'en' })).not.toThrow();
    expect(() => validateEnv({ FALLBACK_LANGUAGE: 'jp' })).not.toThrow();
  });

  it('rejects a FALLBACK_LANGUAGE the app has no translations for', () => {
    // `vi` was dropped, so it must no longer be accepted.
    expect(() => validateEnv({ FALLBACK_LANGUAGE: 'vi' })).toThrow(
      /Invalid environment variables/,
    );
  });

  it('rejects an empty FALLBACK_LANGUAGE', () => {
    expect(() => validateEnv({ FALLBACK_LANGUAGE: '' })).toThrow(
      /Invalid environment variables/,
    );
  });

  describe('database', () => {
    it('accepts an empty DB_PASSWORD (trust authentication)', () => {
      expect(() => validateEnv({ DB_PASSWORD: '' })).not.toThrow();
    });

    it('coerces DB_PORT to a number', () => {
      expect(validateEnv({ DB_PORT: '5432' }).DB_PORT).toBe(5432);
    });

    it('rejects an out-of-range DB_PORT', () => {
      expect(() => validateEnv({ DB_PORT: '70000' })).toThrow(
        /Invalid environment variables/,
      );
    });

    it('rejects an empty DB_HOST', () => {
      expect(() => validateEnv({ DB_HOST: '' })).toThrow(
        /Invalid environment variables/,
      );
    });

    it('rejects a non-boolean DB_LOGGING', () => {
      expect(() => validateEnv({ DB_LOGGING: '1' })).toThrow(
        /Invalid environment variables/,
      );
    });
  });

  describe('redis', () => {
    it('coerces REDIS_DB to a number', () => {
      expect(validateEnv({ REDIS_DB: '3' }).REDIS_DB).toBe(3);
    });

    it('rejects a REDIS_DB outside the 0-15 range Redis provides', () => {
      expect(() => validateEnv({ REDIS_DB: '16' })).toThrow(
        /Invalid environment variables/,
      );
    });

    it('accepts an empty REDIS_PASSWORD (no auth configured)', () => {
      expect(() => validateEnv({ REDIS_PASSWORD: '' })).not.toThrow();
    });
  });

  describe('JWT_SECRET', () => {
    it('is optional outside production, where a dev fallback applies', () => {
      expect(() => validateEnv({ NODE_ENV: 'development' })).not.toThrow();
      expect(() => validateEnv({ NODE_ENV: 'test' })).not.toThrow();
    });

    it('is mandatory in production', () => {
      expect(() => validateEnv({ NODE_ENV: 'production' })).toThrow(
        /Invalid environment variables/,
      );
    });

    it('accepts a long enough secret in production', () => {
      expect(() =>
        validateEnv({ NODE_ENV: 'production', JWT_SECRET: VALID_SECRET }),
      ).not.toThrow();
    });

    it('rejects a secret shorter than the minimum, even in production', () => {
      expect(() =>
        validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }),
      ).toThrow(/Invalid environment variables/);
    });

    it('still validates a secret that is supplied outside production', () => {
      expect(() => validateEnv({ JWT_SECRET: 'too-short' })).toThrow(
        /Invalid environment variables/,
      );
      expect(() => validateEnv({ JWT_SECRET: VALID_SECRET })).not.toThrow();
    });
  });

  describe('BCRYPT_SALT_ROUNDS', () => {
    it('coerces to a number', () => {
      expect(validateEnv({ BCRYPT_SALT_ROUNDS: '12' }).BCRYPT_SALT_ROUNDS).toBe(
        12,
      );
    });

    it("rejects a cost below bcrypt's own minimum", () => {
      expect(() => validateEnv({ BCRYPT_SALT_ROUNDS: '3' })).toThrow(
        /Invalid environment variables/,
      );
    });

    it("rejects a cost above bcrypt's own maximum", () => {
      expect(() => validateEnv({ BCRYPT_SALT_ROUNDS: '32' })).toThrow(
        /Invalid environment variables/,
      );
    });
  });
});
