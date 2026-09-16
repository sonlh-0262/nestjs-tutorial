import { MIN_JWT_SECRET_LENGTH, envValidationSchema } from './env.validation';

const VALID_SECRET = 'x'.repeat(MIN_JWT_SECRET_LENGTH);

const validate = (env: Record<string, unknown>) =>
  envValidationSchema.validate(env, { abortEarly: false });

describe('envValidationSchema', () => {
  it('accepts an empty environment (every variable has a default)', () => {
    expect(validate({}).error).toBeUndefined();
  });

  it('coerces PORT to a number', () => {
    const result = validate({ PORT: '3000' });
    if (result.error) {
      throw result.error;
    }
    expect(result.value.PORT).toBe(3000);
  });

  it('accepts a full, valid environment', () => {
    expect(
      validate({
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
      }).error,
    ).toBeUndefined();
  });

  it('ignores variables it does not know about', () => {
    expect(validate({ SOME_OTHER_TOOL: 'whatever' }).error).toBeUndefined();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(validate({ NODE_ENV: 'staging' }).error).toBeDefined();
  });

  it('rejects a non-numeric PORT', () => {
    expect(validate({ PORT: 'not-a-port' }).error).toBeDefined();
  });

  it('rejects an out-of-range PORT', () => {
    expect(validate({ PORT: '70000' }).error).toBeDefined();
  });

  it('rejects a non-boolean SWAGGER_ENABLED', () => {
    expect(validate({ SWAGGER_ENABLED: 'yes' }).error).toBeDefined();
  });

  it('accepts each supported FALLBACK_LANGUAGE', () => {
    expect(validate({ FALLBACK_LANGUAGE: 'en' }).error).toBeUndefined();
    expect(validate({ FALLBACK_LANGUAGE: 'jp' }).error).toBeUndefined();
  });

  it('rejects a FALLBACK_LANGUAGE the app has no translations for', () => {
    expect(validate({ FALLBACK_LANGUAGE: 'vi' }).error).toBeDefined();
  });

  it('rejects an empty FALLBACK_LANGUAGE', () => {
    expect(validate({ FALLBACK_LANGUAGE: '' }).error).toBeDefined();
  });

  describe('database', () => {
    it('accepts an empty DB_PASSWORD (trust authentication)', () => {
      expect(validate({ DB_PASSWORD: '' }).error).toBeUndefined();
    });

    it('coerces DB_PORT to a number', () => {
      const result = validate({ DB_PORT: '5432' });
      if (result.error) {
        throw result.error;
      }
      expect(result.value.DB_PORT).toBe(5432);
    });

    it('rejects an out-of-range DB_PORT', () => {
      expect(validate({ DB_PORT: '70000' }).error).toBeDefined();
    });

    it('rejects an empty DB_HOST', () => {
      expect(validate({ DB_HOST: '' }).error).toBeDefined();
    });

    it('rejects a non-boolean DB_LOGGING', () => {
      expect(validate({ DB_LOGGING: '1' }).error).toBeDefined();
    });
  });

  describe('redis', () => {
    it('coerces REDIS_DB to a number', () => {
      const result = validate({ REDIS_DB: '3' });
      if (result.error) {
        throw result.error;
      }
      expect(result.value.REDIS_DB).toBe(3);
    });

    it('rejects a REDIS_DB outside the 0-15 range Redis provides', () => {
      expect(validate({ REDIS_DB: '16' }).error).toBeDefined();
    });

    it('accepts an empty REDIS_PASSWORD (no auth configured)', () => {
      expect(validate({ REDIS_PASSWORD: '' }).error).toBeUndefined();
    });
  });

  describe('JWT_SECRET', () => {
    it('is optional outside production, where a dev fallback applies', () => {
      expect(validate({ NODE_ENV: 'development' }).error).toBeUndefined();
      expect(validate({ NODE_ENV: 'test' }).error).toBeUndefined();
    });

    it('is mandatory in production', () => {
      expect(validate({ NODE_ENV: 'production' }).error).toBeDefined();
    });

    it('accepts a long enough secret in production', () => {
      expect(
        validate({ NODE_ENV: 'production', JWT_SECRET: VALID_SECRET }).error,
      ).toBeUndefined();
    });

    it('rejects a secret shorter than the minimum, even in production', () => {
      expect(
        validate({ NODE_ENV: 'production', JWT_SECRET: 'too-short' }).error,
      ).toBeDefined();
    });

    it('still validates a secret that is supplied outside production', () => {
      expect(validate({ JWT_SECRET: 'too-short' }).error).toBeDefined();
      expect(validate({ JWT_SECRET: VALID_SECRET }).error).toBeUndefined();
    });
  });

  describe('JWT_EXPIRES_IN', () => {
    it('accepts a bare number of seconds', () => {
      expect(validate({ JWT_EXPIRES_IN: '60' }).error).toBeUndefined();
    });

    it('accepts a number with a unit', () => {
      expect(validate({ JWT_EXPIRES_IN: '15m' }).error).toBeUndefined();
      expect(validate({ JWT_EXPIRES_IN: '1d' }).error).toBeUndefined();
    });

    it('rejects a malformed duration', () => {
      expect(validate({ JWT_EXPIRES_IN: 'soon' }).error).toBeDefined();
    });
  });

  describe('BCRYPT_SALT_ROUNDS', () => {
    it('coerces to a number', () => {
      const result = validate({ BCRYPT_SALT_ROUNDS: '12' });
      if (result.error) {
        throw result.error;
      }
      expect(result.value.BCRYPT_SALT_ROUNDS).toBe(12);
    });

    it("rejects a cost below bcrypt's own minimum", () => {
      expect(validate({ BCRYPT_SALT_ROUNDS: '3' }).error).toBeDefined();
    });

    it("rejects a cost above bcrypt's own maximum", () => {
      expect(validate({ BCRYPT_SALT_ROUNDS: '32' }).error).toBeDefined();
    });
  });
});
