import { UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';

import { UserFollow } from './entities/user-follow.entity';
import { FollowsService } from './follows.service';

describe('FollowsService', () => {
  let service: FollowsService;

  const executeMock = jest.fn().mockResolvedValue({ identifiers: [] });
  const orIgnoreMock = jest.fn(() => ({ execute: executeMock }));
  const valuesMock = jest.fn(() => ({ orIgnore: orIgnoreMock }));
  const intoMock = jest.fn(() => ({ values: valuesMock }));
  const insertMock = jest.fn(() => ({ into: intoMock }));

  const repositoryMock = {
    createQueryBuilder: jest.fn(() => ({ insert: insertMock })),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    existsBy: jest.fn().mockResolvedValue(false),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FollowsService,
        { provide: getRepositoryToken(UserFollow), useValue: repositoryMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(FollowsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    repositoryMock.existsBy.mockResolvedValue(false);
  });

  describe('follow', () => {
    it('inserts the edge', async () => {
      await service.follow('follower', 'followed');

      expect(valuesMock).toHaveBeenCalledWith({
        followerId: 'follower',
        followingId: 'followed',
      });
      expect(executeMock).toHaveBeenCalled();
    });

    it('lets the database absorb a duplicate rather than checking first', async () => {
      await service.follow('follower', 'followed');

      expect(orIgnoreMock).toHaveBeenCalled();
    });

    it('refuses to follow yourself', async () => {
      await expect(service.follow('same', 'same')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('writes nothing when following yourself', async () => {
      await expect(service.follow('same', 'same')).rejects.toThrow();

      expect(repositoryMock.createQueryBuilder).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('deletes the edge', async () => {
      await service.unfollow('follower', 'followed');

      expect(repositoryMock.delete).toHaveBeenCalledWith({
        followerId: 'follower',
        followingId: 'followed',
      });
    });

    it('succeeds when there was nothing to delete', async () => {
      repositoryMock.delete.mockResolvedValue({ affected: 0 });

      await expect(
        service.unfollow('follower', 'followed'),
      ).resolves.toBeUndefined();
    });

    it('refuses to unfollow yourself', async () => {
      await expect(service.unfollow('same', 'same')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  describe('isFollowing', () => {
    it('is true when the edge exists', async () => {
      repositoryMock.existsBy.mockResolvedValue(true);

      await expect(service.isFollowing('a', 'b')).resolves.toBe(true);
    });

    it('is false when it does not', async () => {
      await expect(service.isFollowing('a', 'b')).resolves.toBe(false);
    });

    it('asks about exactly the pair it was given', async () => {
      await service.isFollowing('a', 'b');

      expect(repositoryMock.existsBy).toHaveBeenCalledWith({
        followerId: 'a',
        followingId: 'b',
      });
    });
  });
});
