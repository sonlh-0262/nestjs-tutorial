import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import databaseConfig, {
  DatabaseConfig,
} from '../../src/config/database.config';
import { envFilePaths } from '../../src/config/env-files';
import { buildDataSourceOptions } from '../../src/database/data-source-options';
import { assertTestDatabase } from './test-database';
import { MAINTENANCE_DATABASE, PG_DUPLICATE_DATABASE } from './test.constants';

/**
 * Jest `globalSetup` for the e2e suite: brings the test database into the state
 * every spec file assumes, once per run.
 *
 * Without it, `npm run test:e2e` on a fresh checkout fails inside the first
 * `beforeAll` with a Postgres error about a missing relation, and the fix -
 * "create a second database, then run the migrations against it with NODE_ENV
 * set" - is three steps nobody should have to know. Migrations run here rather
 * than per spec file because the schema does not change between test cases;
 * only the rows do, and `clearDatabase()` handles those.
 *
 * Nothing here sets `NODE_ENV`: the Jest CLI sets it to `test` before anything
 * else runs, unless it is already set - which is exactly the rule wanted, and
 * also the reason `--env-file .env` must not be passed to the Docker commands
 * in `claude/pull-6/steps/LOCAL_STEPS.md`. A `NODE_ENV=development` inherited
 * from the environment wins, and the suite would then read `.env` and be
 * refused by `assertTestDatabase`.
 */
export default async function globalSetup(): Promise<void> {
  loadEnv({ path: envFilePaths(), quiet: true });

  const config = databaseConfig();
  assertTestDatabase(config);

  await createDatabaseIfMissing(config);
  await migrate(config);
}

/**
 * Postgres has no `CREATE DATABASE IF NOT EXISTS`, and cannot create the
 * database it is connected to, so this borrows the `postgres` maintenance
 * database to do it.
 */
async function createDatabaseIfMissing(config: DatabaseConfig): Promise<void> {
  const maintenance = new DataSource({
    type: 'postgres',
    host: config.host,
    port: config.port,
    username: config.username,
    password: config.password,
    database: MAINTENANCE_DATABASE,
    ssl: config.ssl,
  });

  await maintenance.initialize();

  try {
    const existing = await maintenance.query<unknown[]>(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [config.database],
    );

    if (existing.length > 0) {
      return;
    }

    // The name cannot be bound as a parameter in DDL. It comes from
    // `.env.test` and has already passed `assertTestDatabase`.
    await maintenance.query(`CREATE DATABASE "${config.database}"`);
  } catch (error) {
    // Two jest projects starting at once both see it missing and both create
    // it; the loser can carry on.
    if ((error as { code?: string }).code !== PG_DUPLICATE_DATABASE) {
      throw error;
    }
  } finally {
    await maintenance.destroy();
  }
}

async function migrate(config: DatabaseConfig): Promise<void> {
  const dataSource = new DataSource(buildDataSourceOptions(config));

  await dataSource.initialize();

  try {
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${config.schema}"`);
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
