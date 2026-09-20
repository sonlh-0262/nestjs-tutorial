import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

import { StorageConfig } from '../../config/storage.config';

export function buildMulterOptions(config: StorageConfig): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: 1,
    },
  };
}
