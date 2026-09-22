import { BASE_ENV_FILE_PATHS } from './config.constants';

/**
 * Env files to load, highest precedence first.
 *
 * Both `dotenv` and `@nestjs/config` let the *first* file that defines a key
 * win, so the files belonging to the current `NODE_ENV` come before the shared
 * ones: a run with `NODE_ENV=test` reads `.env.test` and falls back to `.env`
 * for every key `.env.test` does not mention. That is what points the e2e suite
 * at its own database without duplicating the other twenty settings.
 *
 * `.env.<env>.local` sits in front of `.env.<env>` as the per-developer escape
 * hatch, and is the only file that can override a committed per-environment
 * value.
 *
 * Shared by the Nest app and the standalone TypeORM CLI data source, which
 * bootstraps without Nest and so has to load the same files itself.
 */
export function envFilePaths(nodeEnv = process.env.NODE_ENV): string[] {
  if (!nodeEnv) {
    return [...BASE_ENV_FILE_PATHS];
  }

  return [`.env.${nodeEnv}.local`, `.env.${nodeEnv}`, ...BASE_ENV_FILE_PATHS];
}
