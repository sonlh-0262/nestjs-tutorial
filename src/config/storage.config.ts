import { registerAs } from '@nestjs/config';

export interface StorageConfig {
  uploadDir: string;
  maxFileSizeBytes: number;
}

export const STORAGE_CONFIG_KEY = 'storage';

const DEFAULT_UPLOAD_DIR = 'uploads';
const DEFAULT_MAX_FILE_SIZE_MB = 2;

const BYTES_PER_MB = 1024 * 1024;

export default registerAs(STORAGE_CONFIG_KEY, (): StorageConfig => ({
  uploadDir: process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR,
  maxFileSizeBytes:
    parseInt(
      process.env.UPLOAD_MAX_FILE_SIZE_MB ?? String(DEFAULT_MAX_FILE_SIZE_MB),
      10,
    ) * BYTES_PER_MB,
}));
