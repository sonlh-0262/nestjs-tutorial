import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { Factories } from '../factories/factories';

/** Everything a spec file gets back from `createTestApp()`. */
export interface TestContext {
  app: INestApplication<App>;
  dataSource: DataSource;
  factories: Factories;

  /** The HTTP server to hand to `supertest`. */
  server(): App;

  /**
   * Empties Postgres, Redis and the upload directory. Call it from `afterEach`
   * so each test case starts from nothing it did not arrange itself.
   */
  reset(): Promise<void>;

  close(): Promise<void>;
}
