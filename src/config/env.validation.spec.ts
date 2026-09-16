import { envValidationSchema } from './env.validation';

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
    // `vi` was dropped, so it must no longer be accepted.
    expect(validate({ FALLBACK_LANGUAGE: 'vi' }).error).toBeDefined();
  });

  it('rejects an empty FALLBACK_LANGUAGE', () => {
    expect(validate({ FALLBACK_LANGUAGE: '' }).error).toBeDefined();
  });
});
