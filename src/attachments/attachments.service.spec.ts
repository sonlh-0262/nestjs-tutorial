import {
  ForbiddenException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Readable } from 'stream';

import { User } from '../users/entities/user.entity';
import { AttachmentsService } from './attachments.service';
import { Attachment } from './entities/attachment.entity';
import { LocalFileStorage } from './storage/local-file-storage';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(16, 0x00),
]);

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'viewer-id',
    email: 'jake@jake.jake',
    username: 'jake',
    bio: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const buildAttachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: 'attachment-id',
  attachableType: 'User',
  attachableId: 'owner-id',
  url: '/attachments/attachment-id',
  fileName: 'avatar.png',
  fileType: 'image/png',
  fileSize: PNG.length,
  storagePath: 'user/attachment-id.png',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AttachmentsService', () => {
  let service: AttachmentsService;

  const repositoryMock = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((row: Partial<Attachment>) => row as Attachment),
    save: jest.fn((row: Attachment) => Promise.resolve(row)),
  };

  const storageMock = {
    save: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
    exists: jest.fn().mockResolvedValue(true),
    createReadStream: jest.fn(() => Readable.from(PNG)),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  const owner = { type: 'User' as const, id: 'owner-id' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        { provide: getRepositoryToken(Attachment), useValue: repositoryMock },
        { provide: LocalFileStorage, useValue: storageMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(AttachmentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    repositoryMock.find.mockResolvedValue([]);
    repositoryMock.findOne.mockResolvedValue(null);
    storageMock.exists.mockResolvedValue(true);
  });

  describe('replaceFor', () => {
    it('stores the file and returns the row describing it', async () => {
      const { attachment } = await service.replaceFor(owner, {
        originalname: 'me.png',
        buffer: PNG,
      });

      expect(attachment.attachableType).toBe('User');
      expect(attachment.attachableId).toBe('owner-id');
      expect(attachment.fileType).toBe('image/png');
      expect(attachment.fileSize).toBe(PNG.length);
      expect(attachment.url).toBe(`/attachments/${attachment.id}`);
    });

    it('names the file on disk after the row id, never after the upload', async () => {
      const { attachment } = await service.replaceFor(owner, {
        originalname: '../../etc/passwd',
        buffer: PNG,
      });

      expect(attachment.storagePath).toBe(`user/${attachment.id}.png`);
      expect(storageMock.save).toHaveBeenCalledWith(
        attachment.storagePath,
        PNG,
      );
    });

    it('trusts the bytes over the claimed extension', async () => {
      const { attachment } = await service.replaceFor(owner, {
        originalname: 'avatar.gif',
        buffer: PNG,
      });

      expect(attachment.fileType).toBe('image/png');
      expect(attachment.storagePath.endsWith('.png')).toBe(true);
      expect(attachment.fileName).toBe('avatar.gif.png');
    });

    it('gives every upload a distinct id', async () => {
      const first = await service.replaceFor(owner, {
        originalname: 'me.png',
        buffer: PNG,
      });
      const second = await service.replaceFor(owner, {
        originalname: 'me.png',
        buffer: PNG,
      });

      expect(first.attachment.id).not.toBe(second.attachment.id);
    });

    it('rejects a file that is not a supported image', async () => {
      await expect(
        service.replaceFor(owner, {
          originalname: 'notes.txt',
          buffer: Buffer.from('just some text'),
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('writes nothing when the type is rejected', async () => {
      await expect(
        service.replaceFor(owner, {
          originalname: 'notes.txt',
          buffer: Buffer.from('just some text'),
        }),
      ).rejects.toThrow();

      expect(storageMock.save).not.toHaveBeenCalled();
      expect(repositoryMock.save).not.toHaveBeenCalled();
    });

    it('deletes the rows the owner already had', async () => {
      repositoryMock.find.mockResolvedValue([
        buildAttachment({ id: 'old', storagePath: 'user/old.png' }),
      ]);

      await service.replaceFor(owner, { originalname: 'me.png', buffer: PNG });

      expect(repositoryMock.delete).toHaveBeenCalledWith({
        attachableType: 'User',
        attachableId: 'owner-id',
      });
    });

    it('reports the replaced files instead of deleting them itself', async () => {
      repositoryMock.find.mockResolvedValue([
        buildAttachment({ id: 'old', storagePath: 'user/old.png' }),
      ]);

      const { staleStoragePaths } = await service.replaceFor(owner, {
        originalname: 'me.png',
        buffer: PNG,
      });

      expect(staleStoragePaths).toEqual(['user/old.png']);
      expect(storageMock.remove).not.toHaveBeenCalled();
    });

    it('does not delete anything when the owner had no attachment', async () => {
      await service.replaceFor(owner, { originalname: 'me.png', buffer: PNG });

      expect(repositoryMock.delete).not.toHaveBeenCalled();
    });

    it('uses the supplied transaction when there is one', async () => {
      const transactionalRepository = {
        find: jest.fn().mockResolvedValue([]),
        delete: jest.fn(),
        create: jest.fn((row: Partial<Attachment>) => row as Attachment),
        save: jest.fn((row: Attachment) => Promise.resolve(row)),
      };
      const manager = {
        getRepository: jest.fn(() => transactionalRepository),
      };

      await service.replaceFor(
        owner,
        { originalname: 'me.png', buffer: PNG },
        manager as never,
      );

      expect(manager.getRepository).toHaveBeenCalledWith(Attachment);
      expect(transactionalRepository.save).toHaveBeenCalled();
      expect(repositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('discardFiles', () => {
    it('removes every path it is given', async () => {
      await service.discardFiles(['user/a.png', 'user/b.png']);

      expect(storageMock.remove).toHaveBeenCalledWith('user/a.png');
      expect(storageMock.remove).toHaveBeenCalledWith('user/b.png');
    });

    it('does nothing for an empty list', async () => {
      await service.discardFiles([]);

      expect(storageMock.remove).not.toHaveBeenCalled();
    });
  });

  describe('openForDownload', () => {
    it('returns the row and a stream of its contents', async () => {
      const attachment = buildAttachment();
      repositoryMock.findOne.mockResolvedValue(attachment);

      const result = await service.openForDownload(
        'attachment-id',
        buildUser(),
      );

      expect(result.attachment).toBe(attachment);
      expect(storageMock.createReadStream).toHaveBeenCalledWith(
        'user/attachment-id.png',
      );
    });

    it('lets any signed-in user read an avatar, not just its owner', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());

      await expect(
        service.openForDownload(
          'attachment-id',
          buildUser({ id: 'somebody-else' }),
        ),
      ).resolves.toBeDefined();
    });

    it('answers an unknown id with 404', async () => {
      await expect(
        service.openForDownload('missing', buildUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('answers with 404 when the row outlived its file', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());
      storageMock.exists.mockResolvedValue(false);

      await expect(
        service.openForDownload('attachment-id', buildUser()),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('does not open a stream for a file that is missing', async () => {
      repositoryMock.findOne.mockResolvedValue(buildAttachment());
      storageMock.exists.mockResolvedValue(false);

      await expect(
        service.openForDownload('attachment-id', buildUser()),
      ).rejects.toThrow();

      expect(storageMock.createReadStream).not.toHaveBeenCalled();
    });

    it('denies a type that has no read policy yet', async () => {
      repositoryMock.findOne.mockResolvedValue(
        buildAttachment({ attachableType: 'Article' as never }),
      );

      await expect(
        service.openForDownload('attachment-id', buildUser()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
