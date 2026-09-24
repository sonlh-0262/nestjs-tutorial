import { BASE_ENV_FILE_PATHS } from './config.constants';
import { envFilePaths } from './env-files';

/**
 * The Jest CLI sets `NODE_ENV=test` before anything else runs, so "there is no
 * environment" cannot be expressed by passing `undefined` - that only
 * re-triggers the default parameter and reads the variable Jest just set. The
 * variable has to be removed for the duration of the assertion.
 */
const withoutNodeEnv = (assert: () => void): void => {
  const previous = process.env.NODE_ENV;
  delete process.env.NODE_ENV;

  try {
    assert();
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previous;
    }
  }
};

describe('envFilePaths', () => {
  it('falls back to the shared files when NODE_ENV is unset', () => {
    withoutNodeEnv(() => {
      expect(envFilePaths()).toEqual(BASE_ENV_FILE_PATHS);
    });
  });

  it('falls back to the shared files when NODE_ENV is empty', () => {
    expect(envFilePaths('')).toEqual(BASE_ENV_FILE_PATHS);
  });

  it('does not hand out the shared array itself', () => {
    expect(envFilePaths('')).not.toBe(BASE_ENV_FILE_PATHS);
  });

  it('puts the files for the environment ahead of the shared ones', () => {
    expect(envFilePaths('test')).toEqual([
      '.env.test.local',
      '.env.test',
      ...BASE_ENV_FILE_PATHS,
    ]);
  });

  it('ranks `.env.<env>.local` above `.env.<env>`', () => {
    const paths = envFilePaths('production');

    expect(paths.indexOf('.env.production.local')).toBeLessThan(
      paths.indexOf('.env.production'),
    );
  });

  it('reads NODE_ENV when no environment is passed', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'staging';

    try {
      expect(envFilePaths()).toContain('.env.staging');
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});
