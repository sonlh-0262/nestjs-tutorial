import { rm } from 'fs/promises';
import * as path from 'path';

import { StorageConfig } from '../../src/config/storage.config';
import { TEST_UPLOAD_DIR_LEAF } from './test.constants';

/**
 * The third rail, alongside the database and Redis ones.
 *
 * Avatar uploads are the one part of the application that writes outside
 * Postgres, and `clearUploads()` deletes the whole directory, so the suite has
 * to be sure which directory that is.
 */
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
 * Removes the files the attachment tests wrote.
 *
 * Truncating `attachments` alone would leave every uploaded file on disk, so
 * the directory would grow by a few kilobytes every run and a test could pass
 * by finding a file an earlier run had left behind. `LocalFileStorage.save()`
 * re-creates the directory on demand, so deleting it outright is safe.
 */
export async function clearUploads(config: StorageConfig): Promise<void> {
  await rm(path.resolve(config.uploadDir), { recursive: true, force: true });
}
