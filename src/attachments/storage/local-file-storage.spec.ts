import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import * as path from 'path';

import { StorageConfig } from '../../config/storage.config';
import { LocalFileStorage } from './local-file-storage';

const SEPARATOR = String.fromCharCode(92);

describe('LocalFileStorage', () => {
  let root: string;
  let storage: LocalFileStorage;

  const build = (uploadDir: string): LocalFileStorage => {
    const config: StorageConfig = { uploadDir, maxFileSizeBytes: 1024 };

    return new LocalFileStorage({
      getOrThrow: () => config,
    } as unknown as ConfigService);
  };

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'uploads-'));
    storage = build(root);
  });

  describe('save', () => {
    it('writes the bytes, creating any missing directory', async () => {
      await storage.save('user/a/b.png', Buffer.from('contents'));

      const written = await readFile(path.join(root, 'user/a/b.png'));

      expect(written.toString()).toBe('contents');
    });

    it('overwrites a file that is already there', async () => {
      await storage.save('user/a.png', Buffer.from('first'));
      await storage.save('user/a.png', Buffer.from('second'));

      const written = await readFile(path.join(root, 'user/a.png'));

      expect(written.toString()).toBe('second');
    });
  });

  describe('resolve', () => {
    it('resolves a path inside the root', () => {
      expect(storage.resolve('user/a.png')).toBe(
        path.join(root, 'user', 'a.png'),
      );
    });

    it('refuses a path that climbs out of the root', () => {
      expect(() => storage.resolve('../../etc/passwd')).toThrow(
        /outside the upload root/,
      );
    });

    it('refuses an absolute path', () => {
      const absolute = path.join(path.parse(root).root, 'etc', 'passwd');

      expect(() => storage.resolve(absolute)).toThrow(
        /outside the upload root/,
      );
    });

    it('keeps a name full of backslashes inside the root on POSIX', () => {
      const name = ['..', '..', 'secrets.txt'].join(SEPARATOR);

      expect(storage.resolve(name).startsWith(root)).toBe(true);
    });

    it('refuses a sibling directory that merely shares the prefix', () => {
      const sibling = path.join('..', `${path.basename(root)}-evil`, 'a.png');

      expect(() => storage.resolve(sibling)).toThrow(/outside the upload root/);
    });
  });

  describe('exists', () => {
    it('is true for a file that was written', async () => {
      await storage.save('user/a.png', Buffer.from('x'));

      await expect(storage.exists('user/a.png')).resolves.toBe(true);
    });

    it('is false for a file that was never written', async () => {
      await expect(storage.exists('user/missing.png')).resolves.toBe(false);
    });

    it('is false for a directory', async () => {
      await storage.save('user/a.png', Buffer.from('x'));

      await expect(storage.exists('user')).resolves.toBe(false);
    });

    it('is false rather than throwing for a path outside the root', async () => {
      await expect(storage.exists('../../etc/passwd')).resolves.toBe(false);
    });
  });

  describe('createReadStream', () => {
    it('streams the stored bytes back', async () => {
      await storage.save('user/a.png', Buffer.from('streamed'));

      const chunks: Buffer[] = [];
      for await (const chunk of storage.createReadStream('user/a.png')) {
        chunks.push(chunk as Buffer);
      }

      expect(Buffer.concat(chunks).toString()).toBe('streamed');
    });
  });

  describe('remove', () => {
    it('deletes the file', async () => {
      await storage.save('user/a.png', Buffer.from('x'));
      await storage.remove('user/a.png');

      await expect(storage.exists('user/a.png')).resolves.toBe(false);
    });

    it('is silent about a file that is already gone', async () => {
      await expect(storage.remove('user/missing.png')).resolves.toBeUndefined();
    });

    it('swallows a rejected path rather than failing the caller', async () => {
      await expect(storage.remove('../../etc/passwd')).resolves.toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('resolves a relative upload dir against the working directory', () => {
      const relative = build('uploads');

      expect(relative.resolve('user/a.png')).toBe(
        path.join(process.cwd(), 'uploads', 'user', 'a.png'),
      );
    });
  });
});
