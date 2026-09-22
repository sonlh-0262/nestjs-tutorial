import { DataSource, EntityMetadata, ObjectLiteral, Repository } from 'typeorm';

import { DatabaseConfig } from '../../src/config/database.config';
import { TEST_DATABASE_SUFFIX } from './test.constants';

/**
 * One statement per data source, built from the entity metadata the first time
 * it is asked for. Rebuilding it for every test case would mean walking every
 * entity and sorting it a few hundred times a run, for a string that cannot
 * change while the app is up.
 */
const clearStatements = new WeakMap<DataSource, string>();

/**
 * Refuses to run against anything but a test database.
 *
 * Called before the app finishes booting, so a `.env` that points `NODE_ENV=test`
 * at the development database fails with this message instead of succeeding and
 * emptying it after the first test case.
 */
export function assertTestDatabase(config: DatabaseConfig): void {
  if (config.database.endsWith(TEST_DATABASE_SUFFIX)) {
    return;
  }

  throw new Error(
    `Refusing to run the e2e suite against "${config.database}": the suite ` +
      `empties every table between test cases, so DB_DATABASE must name a ` +
      `database ending in "${TEST_DATABASE_SUFFIX}". Check .env.test.`,
  );
}

/**
 * Empties every table the entities map to.
 *
 * `DELETE`, not `TRUNCATE`, and the difference is not stylistic. Measured on
 * this schema with a handful of rows per table, on a Docker Postgres
 * (`claude/pull-6/scripts/measure-reset.ts`):
 *
 * ```
 * TRUNCATE … RESTART IDENTITY CASCADE   mean 523 ms
 * DELETE FROM … (ordered)               mean 1.2 ms
 * ```
 *
 * `TRUNCATE` rewrites the file behind every relation and fsyncs each one, so
 * its cost follows the number of tables and indexes rather than the number of
 * rows. Across 254 test cases that is two and a half minutes of a run spent
 * removing almost nothing, and it was enough to push an `afterEach` hook past
 * Jest's 30-second timeout on a loaded machine.
 *
 * `DELETE` has no `CASCADE`, so the statements are ordered instead: every table
 * is emptied before the tables it references. The order comes from the foreign
 * keys TypeORM already knows about, so it cannot go stale the way a hand-kept
 * list would.
 *
 * What is given up: `RESTART IDENTITY`. Every table here has a uuid key, so
 * there is no sequence to restart; the day one has a serial column and a test
 * depends on it starting at 1, this is the line to revisit.
 *
 * The migrations table survives either way, because it is not an entity: the
 * schema is built once per run by `global-setup.ts` and reused by every case.
 */
export async function clearDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query(clearStatement(dataSource));
}

function clearStatement(dataSource: DataSource): string {
  const cached = clearStatements.get(dataSource);

  if (cached) {
    return cached;
  }

  const statement = deletionOrder(dataSource)
    .map((table) => `DELETE FROM ${table}`)
    .join('; ');

  clearStatements.set(dataSource, statement);

  return statement;
}

/**
 * Table paths ordered so that each one comes before every table it references.
 *
 * A depth-first walk of the reversed foreign-key graph: visit everything that
 * points *at* a table before emitting the table itself. Marking on entry rather
 * than on exit means a self-reference or a cycle breaks at an arbitrary edge
 * instead of recursing forever - there are none in this schema, and a loud
 * foreign-key error beats a stack overflow if one ever appears.
 */
function deletionOrder(dataSource: DataSource): string[] {
  const dependents = new Map<string, EntityMetadata[]>();

  for (const metadata of dataSource.entityMetadatas) {
    for (const foreignKey of metadata.foreignKeys) {
      const referenced = foreignKey.referencedEntityMetadata.tablePath;

      dependents.set(referenced, [
        ...(dependents.get(referenced) ?? []),
        metadata,
      ]);
    }
  }

  const visited = new Set<string>();
  const order: string[] = [];

  const visit = (metadata: EntityMetadata): void => {
    if (visited.has(metadata.tablePath)) {
      return;
    }

    visited.add(metadata.tablePath);
    (dependents.get(metadata.tablePath) ?? []).forEach(visit);
    order.push(metadata.tablePath);
  };

  dataSource.entityMetadatas.forEach(visit);

  return order;
}

/**
 * Moves a row's create and update timestamps to `at`.
 *
 * Seeded rows are inserted milliseconds apart, and `comments` are ordered by
 * `created_at` with `id` - a random uuid - as the tiebreak, so a thread seeded
 * at full speed comes back in an order no assertion can predict. Backdating
 * each row spreads them far enough apart that the tiebreak never runs.
 *
 * Raw SQL rather than `repository.update()` because TypeORM's update builder
 * sets `@UpdateDateColumn` to `now()` itself, which is precisely the column
 * being moved.
 */
export async function backdate<TEntity extends ObjectLiteral>(
  repository: Repository<TEntity>,
  id: string,
  at: Date,
): Promise<void> {
  const { metadata } = repository;

  const columns = [metadata.createDateColumn, metadata.updateDateColumn].filter(
    (column) => column !== undefined,
  );

  if (columns.length === 0) {
    throw new Error(
      `Cannot backdate ${metadata.tableName}: it has no @CreateDateColumn or ` +
        `@UpdateDateColumn. Without this check the generated SQL would be a ` +
        `syntax error instead of a sentence.`,
    );
  }

  const assignments = columns
    .map((column) => `"${column.databaseName}" = $1`)
    .join(', ');

  const [primaryColumn] = metadata.primaryColumns;

  await repository.query(
    `UPDATE ${metadata.tablePath} SET ${assignments} ` +
      `WHERE "${primaryColumn.databaseName}" = $2`,
    [at, id],
  );
}
