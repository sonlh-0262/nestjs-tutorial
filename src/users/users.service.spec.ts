import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, Not, Repository } from 'typeorm';

import { AttachmentsService } from '../attachments/attachments.service';
import { User } from './entities/user.entity';
import { PasswordService } from './password.service';
import { UsersService } from './users.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-id',
    email: 'jake@jake.jake',
    username: 'jake',
    bio: null,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('UsersService', () => {
  let service: UsersService;

  const queryBuilderMock = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const repositoryMock = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((input: Partial<User>) => input as User),
    save: jest.fn((user: User) => Promise.resolve({ ...user, id: 'user-id' })),
    createQueryBuilder: jest.fn(() => queryBuilderMock),
  };

  const transactionalRepositoryMock = {
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOneOrFail: jest.fn(() => Promise.resolve(buildUser())),
  };

  const dataSourceMock = {
    transaction: jest.fn(
      (
        runInTransaction: (manager: {
          getRepository: () => typeof transactionalRepositoryMock;
        }) => Promise<unknown>,
      ) =>
        runInTransaction({
          getRepository: () => transactionalRepositoryMock,
        }),
    ),
  };

  const attachmentsServiceMock = {
    replaceFor: jest.fn().mockResolvedValue({
      attachment: { url: '/attachments/new-id' },
      staleStoragePaths: ['user/old.png'],
    }),
    discardFiles: jest.fn().mockResolvedValue(undefined),
  };

  const passwordServiceMock = {
    hash: jest.fn().mockResolvedValue('new-hash'),
    compare: jest.fn().mockResolvedValue(true),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repositoryMock },
        { provide: AttachmentsService, useValue: attachmentsServiceMock },
        { provide: PasswordService, useValue: passwordServiceMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    repositoryMock.findOne.mockResolvedValue(null);
    transactionalRepositoryMock.findOneOrFail.mockImplementation(() =>
      Promise.resolve(buildUser()),
    );
  });

  describe('normaliseEmail', () => {
    it('lower-cases and trims', () => {
      expect(UsersService.normaliseEmail('  Jake@Jake.JAKE  ')).toBe(
        'jake@jake.jake',
      );
    });

    it('leaves an already normalised address alone', () => {
      expect(UsersService.normaliseEmail('jake@jake.jake')).toBe(
        'jake@jake.jake',
      );
    });
  });

  describe('findById / findByUsername', () => {
    it('queries by id', async () => {
      await service.findById('user-id');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });

    it('queries by username without altering its case', async () => {
      await service.findByUsername('Jake');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { username: 'Jake' },
      });
    });
  });

  describe('findByEmailWithPassword', () => {
    it('explicitly selects the hash the entity hides by default', async () => {
      await service.findByEmailWithPassword('JAKE@jake.jake');

      expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
        'user.passwordHash',
      );
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'user.email = :email',
        { email: 'jake@jake.jake' },
      );
    });
  });

  describe('create', () => {
    it('stores the normalised email and empty profile fields', async () => {
      const user = await service.create({
        username: 'jake',
        email: 'JAKE@Jake.jake',
        passwordHash: 'hashed',
      });

      expect(repositoryMock.create).toHaveBeenCalledWith({
        username: 'jake',
        email: 'jake@jake.jake',
        passwordHash: 'hashed',
        bio: null,
        image: null,
      });
      expect(user.id).toBe('user-id');
    });
  });

  describe('assertCredentialsAvailable', () => {
    it('passes when neither value is taken', async () => {
      await expect(
        service.assertCredentialsAvailable('new@example.com', 'new-name'),
      ).resolves.toBeUndefined();
    });

    it('rejects an email another account holds', async () => {
      repositoryMock.findOne.mockResolvedValue(buildUser({ id: 'other' }));

      await expect(
        service.assertCredentialsAvailable('taken@example.com'),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('queries nothing when neither value is supplied', async () => {
      await service.assertCredentialsAvailable();

      expect(repositoryMock.findOne).not.toHaveBeenCalled();
    });

    it('normalises the email before looking it up', async () => {
      await service.assertCredentialsAvailable(' TAKEN@Example.com ');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { email: 'taken@example.com' },
      });
    });

    it('excludes the caller so re-submitting your own values is not a conflict', async () => {
      await service.assertCredentialsAvailable(
        'jake@jake.jake',
        'jake',
        'user-id',
      );

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { email: 'jake@jake.jake', id: Not('user-id') },
      });
      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { username: 'jake', id: Not('user-id') },
      });
    });
  });

  describe('update', () => {
    const user = buildUser();

    it('writes only the fields that were sent', async () => {
      await service.update(user, { bio: 'new bio' });

      expect(transactionalRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { bio: 'new bio' },
      );
    });

    it('normalises a new email', async () => {
      await service.update(user, { email: '  NEW@Example.COM ' });

      expect(transactionalRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { email: 'new@example.com' },
      );
    });

    it('hashes a new password rather than storing it', async () => {
      await service.update(user, { password: 'Sup3rS3cret!' });

      expect(passwordServiceMock.hash).toHaveBeenCalledWith('Sup3rS3cret!');
      expect(transactionalRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { passwordHash: 'new-hash' },
      );
    });

    it('does not touch the password when none was sent', async () => {
      await service.update(user, { bio: 'new bio' });

      expect(passwordServiceMock.hash).not.toHaveBeenCalled();
    });

    it('clears a field that was sent as null', async () => {
      await service.update(user, { bio: null });

      expect(transactionalRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { bio: null },
      );
    });

    it('skips the write entirely for an empty update', async () => {
      await service.update(user, {});

      expect(transactionalRepositoryMock.update).not.toHaveBeenCalled();
    });

    it('still returns the current user for an empty update', async () => {
      await expect(service.update(user, {})).resolves.toEqual(buildUser());
    });

    it('rejects a username another account holds, before writing anything', async () => {
      repositoryMock.findOne.mockResolvedValue(buildUser({ id: 'other' }));

      await expect(
        service.update(user, { username: 'taken' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(dataSourceMock.transaction).not.toHaveBeenCalled();
    });

    it('stores an uploaded avatar and points the user at it', async () => {
      await service.update(user, {}, { originalname: 'me.png', buffer: PNG });

      expect(attachmentsServiceMock.replaceFor).toHaveBeenCalledWith(
        { type: 'User', id: 'user-id' },
        { originalname: 'me.png', buffer: PNG },
        expect.anything(),
      );
      expect(transactionalRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { image: '/attachments/new-id' },
      );
    });

    it('deletes the replaced file only after the transaction has committed', async () => {
      const order: string[] = [];

      dataSourceMock.transaction.mockImplementationOnce(async (run) => {
        const result = await run({
          getRepository: () => transactionalRepositoryMock,
        });
        order.push('commit');

        return result;
      });
      attachmentsServiceMock.discardFiles.mockImplementationOnce(() => {
        order.push('discard');

        return Promise.resolve();
      });

      await service.update(user, {}, { originalname: 'me.png', buffer: PNG });

      expect(order).toEqual(['commit', 'discard']);
      expect(attachmentsServiceMock.discardFiles).toHaveBeenCalledWith([
        'user/old.png',
      ]);
    });

    it('does not go near the attachment store without an upload', async () => {
      await service.update(user, { image: 'https://example.com/a.png' });

      expect(attachmentsServiceMock.replaceFor).not.toHaveBeenCalled();
      expect(transactionalRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'user-id' },
        { image: 'https://example.com/a.png' },
      );
    });

    it('runs the row update inside a transaction', async () => {
      await service.update(user, { bio: 'new bio' });

      expect(dataSourceMock.transaction).toHaveBeenCalled();
    });
  });

  it('is typed against the real repository', () => {
    const repository = repositoryMock as unknown as Repository<User>;
    expect(typeof repository.findOne).toBe('function');
  });
});
