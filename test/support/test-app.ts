import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/config/app-setup';
import { APP_CONFIG_KEY, AppConfig } from '../../src/config/configuration';
import {
  DATABASE_CONFIG_KEY,
  DatabaseConfig,
} from '../../src/config/database.config';
import { REDIS_CONFIG_KEY, RedisConfig } from '../../src/config/redis.config';
import {
  STORAGE_CONFIG_KEY,
  StorageConfig,
} from '../../src/config/storage.config';
import { setupSwagger } from '../../src/config/swagger';
import { REDIS_CLIENT } from '../../src/redis/redis.constants';
import { Factories } from './factories/factories';
import { TestAppOptions } from './interfaces/test-app-options.interface';
import { TestContext } from './interfaces/test-context.interface';
import { assertTestDatabase, clearDatabase } from './test-database';
import { assertTestRedis, clearRedis } from './test-redis';
import { assertTestUploadDir, clearUploads } from './test-storage';

/**
 * Boots the application exactly as `main.ts` does - one shared bootstrap, so a
 * spec can never drive an app configured differently from the real one.
 *
 * One app per spec file, not per case: booting costs seconds and a connection
 * pool, while `reset()` costs three round trips.
 */
export async function createTestApp(
  options: TestAppOptions = {},
): Promise<TestContext> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  const config = app.get(ConfigService);

  const redisConfig = config.getOrThrow<RedisConfig>(REDIS_CONFIG_KEY);
  const storageConfig = config.getOrThrow<StorageConfig>(STORAGE_CONFIG_KEY);

  // Before `init()`: one rail per store `reset()` wipes.
  assertTestDatabase(config.getOrThrow<DatabaseConfig>(DATABASE_CONFIG_KEY));
  assertTestRedis(redisConfig);
  assertTestUploadDir(storageConfig);

  const appConfig = config.getOrThrow<AppConfig>(APP_CONFIG_KEY);
  configureApp(app, appConfig);

  if (options.swagger) {
    setupSwagger(app, {
      ...appConfig,
      swagger: { ...appConfig.swagger, enabled: true },
    });
  }

  app.enableShutdownHooks();
  await app.init();

  const dataSource = app.get(DataSource);
  const redis = app.get<Redis>(REDIS_CLIENT);

  return {
    app,
    dataSource,
    factories: new Factories(app),
    server: () => app.getHttpServer(),
    reset: async () => {
      await clearDatabase(dataSource);
      await clearRedis(redis, redisConfig);
      await clearUploads(storageConfig);
    },
    close: () => app.close(),
  };
}
