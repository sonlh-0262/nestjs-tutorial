import { rm } from 'fs/promises';
import * as path from 'path';

import { StorageConfig } from '../../src/config/storage.config';
import { TEST_UPLOAD_DIR_LEAF } from './test.constants';

/** `clearUploads()` deletes this directory outright, so it has to be the right one. */
export function assertTestUploadDir(config: StorageConfig): void {
  const root = path.resolve(config.uploadDir);

  if (path.basename(root) === TEST_UPLOAD_DIR_LEAF) {
    return;
  }

  throw new Error(
    `Refusing to run the e2e suite with UPLOAD_DIR "${config.uploadDir}": the ` +
      `suite deletes that directory between test cases, so it must end in ` +
      `"${TEST_UPLOAD_DIR_LEAF}". Check .env.test.`,
  );
}

/**
 * Uploads are the one thing the app writes outside Postgres, so emptying the
 * tables alone would leave files behind. `LocalFileStorage.save()` re-creates
 * the directory on demand.
 */
export async function clearUploads(config: StorageConfig): Promise<void> {
  await rm(path.resolve(config.uploadDir), { recursive: true, force: true });
}
