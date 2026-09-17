import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';

import { User } from '../users/entities/user.entity';
import { FollowsService } from '../users/follows.service';
import { UsersService } from '../users/users.service';
import { ProfilesService } from './profiles.service';

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'jake-id',
    email: 'jake@jake.jake',
    username: 'jake',
    bio: 'I work at statefarm',
    image: '/attachments/abc',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

describe('ProfilesService', () => {
  let service: ProfilesService;

  const usersServiceMock = {
    findByUsername: jest.fn().mockResolvedValue(null),
  };

  const followsServiceMock = {
    follow: jest.fn().mockResolvedValue(undefined),
    unfollow: jest.fn().mockResolvedValue(undefined),
    isFollowing: jest.fn().mockResolvedValue(false),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  const viewer = buildUser({ id: 'viewer-id', username: 'viewer' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: FollowsService, useValue: followsServiceMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(ProfilesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    usersServiceMock.findByUsername.mockResolvedValue(null);
    followsServiceMock.isFollowing.mockResolvedValue(false);
  });

  describe('getProfile', () => {
    it('returns the public fields only', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(buildUser());

      const { profile } = await service.getProfile('jake');

      expect(profile).toEqual({
        username: 'jake',
        bio: 'I work at statefarm',
        image: '/attachments/abc',
        following: false,
      });
      expect(profile).not.toHaveProperty('email');
      expect(profile).not.toHaveProperty('id');
    });

    it('reports following false for an anonymous caller', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(buildUser());
      followsServiceMock.isFollowing.mockResolvedValue(true);

      const { profile } = await service.getProfile('jake');

      expect(profile.following).toBe(false);
      expect(followsServiceMock.isFollowing).not.toHaveBeenCalled();
    });

    it('reflects the relationship for a signed-in caller', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(buildUser());
      followsServiceMock.isFollowing.mockResolvedValue(true);

      const { profile } = await service.getProfile('jake', viewer);

      expect(profile.following).toBe(true);
      expect(followsServiceMock.isFollowing).toHaveBeenCalledWith(
        'viewer-id',
        'jake-id',
      );
    });

    it('never reports you as following yourself', async () => {
      const self = buildUser({ id: 'viewer-id', username: 'viewer' });
      usersServiceMock.findByUsername.mockResolvedValue(self);

      const { profile } = await service.getProfile('viewer', viewer);

      expect(profile.following).toBe(false);
      expect(followsServiceMock.isFollowing).not.toHaveBeenCalled();
    });

    it('answers an unknown username with 404', async () => {
      await expect(service.getProfile('nobody')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('follow', () => {
    it('records the follow and returns the updated profile', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(buildUser());

      const { profile } = await service.follow('jake', viewer);

      expect(followsServiceMock.follow).toHaveBeenCalledWith(
        'viewer-id',
        'jake-id',
      );
      expect(profile.following).toBe(true);
    });

    it('answers an unknown username with 404', async () => {
      await expect(service.follow('nobody', viewer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not touch the follow table for an unknown username', async () => {
      await expect(service.follow('nobody', viewer)).rejects.toThrow();

      expect(followsServiceMock.follow).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it('removes the follow and returns the updated profile', async () => {
      usersServiceMock.findByUsername.mockResolvedValue(buildUser());

      const { profile } = await service.unfollow('jake', viewer);

      expect(followsServiceMock.unfollow).toHaveBeenCalledWith(
        'viewer-id',
        'jake-id',
      );
      expect(profile.following).toBe(false);
    });

    it('answers an unknown username with 404', async () => {
      await expect(service.unfollow('nobody', viewer)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
