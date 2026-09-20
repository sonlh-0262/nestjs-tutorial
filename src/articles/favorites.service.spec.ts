import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ArticleFavorite } from './entities/article-favorite.entity';
import { FavoritesService } from './favorites.service';

describe('FavoritesService', () => {
  let service: FavoritesService;

  const executeMock = jest.fn().mockResolvedValue({ identifiers: [] });
  const orIgnoreMock = jest.fn(() => ({ execute: executeMock }));
  const valuesMock = jest.fn(() => ({ orIgnore: orIgnoreMock }));
  const intoMock = jest.fn(() => ({ values: valuesMock }));
  const insertMock = jest.fn(() => ({ into: intoMock }));

  const getRawManyMock = jest.fn().mockResolvedValue([]);

  type CountBuilderMock = Record<
    'select' | 'addSelect' | 'where' | 'groupBy' | 'getRawMany',
    jest.Mock
  >;

  const countBuilder: CountBuilderMock = {
    select: jest.fn(() => countBuilder),
    addSelect: jest.fn(() => countBuilder),
    where: jest.fn(() => countBuilder),
    groupBy: jest.fn(() => countBuilder),
    getRawMany: getRawManyMock,
  };

  const repositoryMock = {
    createQueryBuilder: jest.fn((alias?: string) =>
      alias ? countBuilder : { insert: insertMock },
    ),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoritesService,
        {
          provide: getRepositoryToken(ArticleFavorite),
          useValue: repositoryMock,
        },
      ],
    }).compile();

    service = module.get(FavoritesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    getRawManyMock.mockResolvedValue([]);
    repositoryMock.find.mockResolvedValue([]);
  });

  describe('favorite', () => {
    it('inserts the edge', async () => {
      await service.favorite('user-1', 'article-1');

      expect(valuesMock).toHaveBeenCalledWith({
        userId: 'user-1',
        articleId: 'article-1',
      });
      expect(executeMock).toHaveBeenCalled();
    });

    it('is idempotent through the unique index rather than a read first', async () => {
      await service.favorite('user-1', 'article-1');

      expect(orIgnoreMock).toHaveBeenCalled();
      expect(repositoryMock.find).not.toHaveBeenCalled();
    });
  });

  describe('unfavorite', () => {
    it('deletes the edge', async () => {
      await service.unfavorite('user-1', 'article-1');

      expect(repositoryMock.delete).toHaveBeenCalledWith({
        userId: 'user-1',
        articleId: 'article-1',
      });
    });
  });

  describe('countsFor', () => {
    it('does not query for an empty page', async () => {
      await expect(service.countsFor([])).resolves.toEqual(new Map());

      expect(repositoryMock.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('counts a whole page in one query', async () => {
      getRawManyMock.mockResolvedValue([
        { articleId: 'article-1', count: '3' },
        { articleId: 'article-2', count: '1' },
      ]);

      const counts = await service.countsFor(['article-1', 'article-2']);

      expect(repositoryMock.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(counts.get('article-1')).toBe(3);
      expect(counts.get('article-2')).toBe(1);
    });

    it('leaves articles with no favorites out of the map', async () => {
      getRawManyMock.mockResolvedValue([
        { articleId: 'article-1', count: '2' },
      ]);

      const counts = await service.countsFor(['article-1', 'article-2']);

      expect(counts.has('article-2')).toBe(false);
    });
  });

  describe('favoritedBy', () => {
    it('does not query for an empty page', async () => {
      await expect(service.favoritedBy('user-1', [])).resolves.toEqual(
        new Set(),
      );

      expect(repositoryMock.find).not.toHaveBeenCalled();
    });

    it('returns the subset this user favorited, in one query', async () => {
      repositoryMock.find.mockResolvedValue([{ articleId: 'article-2' }]);

      const favorited = await service.favoritedBy('user-1', [
        'article-1',
        'article-2',
      ]);

      expect(repositoryMock.find).toHaveBeenCalledTimes(1);
      expect(favorited.has('article-2')).toBe(true);
      expect(favorited.has('article-1')).toBe(false);
    });
  });
});
