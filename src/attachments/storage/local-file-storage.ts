import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, ReadStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import * as path from 'path';

import { StorageConfig, STORAGE_CONFIG_KEY } from '../../config/storage.config';

@Injectable()
export class LocalFileStorage {
  private readonly logger = new Logger(LocalFileStorage.name);
  private readonly root: string;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<StorageConfig>(STORAGE_CONFIG_KEY);

    this.root = path.resolve(config.uploadDir);
  }

  resolve(storagePath: string): string {
    const absolute = path.resolve(this.root, storagePath);

    if (absolute !== this.root && !absolute.startsWith(this.root + path.sep)) {
      throw new Error(
        `Refusing to access "${storagePath}" outside the upload root`,
      );
    }

    return absolute;
  }

  async save(storagePath: string, contents: Buffer): Promise<void> {
    const absolute = this.resolve(storagePath);

    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, contents);
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      const stats = await stat(this.resolve(storagePath));

      return stats.isFile();
    } catch {
      return false;
    }
  }

  createReadStream(storagePath: string): ReadStream {
    return createReadStream(this.resolve(storagePath));
  }

  async remove(storagePath: string): Promise<void> {
    try {
      await rm(this.resolve(storagePath), { force: true });
    } catch (error) {
      this.logger.warn(
        `Could not delete "${storagePath}": ${(error as Error).message}`,
      );
    }
  }
}
