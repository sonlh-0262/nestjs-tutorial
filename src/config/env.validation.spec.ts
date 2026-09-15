import { validateEnv } from './env.validation';

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
});
