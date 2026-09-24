import { Test, TestingModule } from '@nestjs/testing';

import { User } from '../users/entities/user.entity';
import { FollowsService } from '../users/follows.service';
import { ArticleViewService } from './article-view.service';
import { Article } from './entities/article.entity';
import { FavoritesService } from './favorites.service';

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'jake-id',
    email: 'jake@jake.jake',
    username: 'jake',
    bio: 'I work at statefarm',
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as User;

const buildArticle = (overrides: Partial<Article> = {}): Article => ({
  id: 'article-1',
  slug: 'how-to-train-your-dragon',
  title: 'How to train your dragon',
  description: 'Ever wonder how?',
  body: 'It takes a Jacobian',
  authorId: 'jake-id',
  author: buildUser(),
  tags: [],
  createdAt: new Date('2026-09-18T08:30:00.000Z'),
  updatedAt: new Date('2026-09-18T08:30:00.000Z'),
  ...overrides,
});

describe('ArticleViewService', () => {
  let service: ArticleViewService;

  const favoritesServiceMock = {
    countsFor: jest.fn().mockResolvedValue(new Map()),
    favoritedBy: jest.fn().mockResolvedValue(new Set()),
  };

  const followsServiceMock = {
    followingAmong: jest.fn().mockResolvedValue(new Set()),
  };

  const viewer = buildUser({ id: 'viewer-id', username: 'viewer' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticleViewService,
        { provide: FavoritesService, useValue: favoritesServiceMock },
        { provide: FollowsService, useValue: followsServiceMock },
      ],
    }).compile();

    service = module.get(ArticleViewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    favoritesServiceMock.countsFor.mockResolvedValue(new Map());
    favoritesServiceMock.favoritedBy.mockResolvedValue(new Set());
    followsServiceMock.followingAmong.mockResolvedValue(new Set());
  });

  describe('one', () => {
    it('renders the full article shape', async () => {
      const { article } = await service.toArticleResponse(buildArticle());

      expect(article).toEqual({
        slug: 'how-to-train-your-dragon',
        title: 'How to train your dragon',
        description: 'Ever wonder how?',
        body: 'It takes a Jacobian',
        tagList: [],
        createdAt: '2026-09-18T08:30:00.000Z',
        updatedAt: '2026-09-18T08:30:00.000Z',
        favorited: false,
        favoritesCount: 0,
        author: {
          username: 'jake',
          bio: 'I work at statefarm',
          image: null,
          following: false,
        },
      });
    });

    it('never leaks the author email or ids', async () => {
      const { article } = await service.toArticleResponse(buildArticle());

      expect(article).not.toHaveProperty('id');
      expect(article).not.toHaveProperty('authorId');
      expect(article.author).not.toHaveProperty('email');
      expect(article.author).not.toHaveProperty('id');
    });

    it('sorts the tag list', async () => {
      const tags = [{ name: 'training' }, { name: 'dragons' }];

      const { article } = await service.toArticleResponse(
        buildArticle({ tags: tags as Article['tags'] }),
      );

      expect(article.tagList).toEqual(['dragons', 'training']);
    });

    it('reports the favorite count from the batch query', async () => {
      favoritesServiceMock.countsFor.mockResolvedValue(
        new Map([['article-1', 4]]),
      );

      const { article } = await service.toArticleResponse(buildArticle());

      expect(article.favoritesCount).toBe(4);
    });

    it('reflects the viewer relationships', async () => {
      favoritesServiceMock.favoritedBy.mockResolvedValue(
        new Set(['article-1']),
      );
      followsServiceMock.followingAmong.mockResolvedValue(new Set(['jake-id']));

      const { article } = await service.toArticleResponse(
        buildArticle(),
        viewer,
      );

      expect(article.favorited).toBe(true);
      expect(article.author.following).toBe(true);
    });

    it('asks the batch lookups for no viewer when anonymous', async () => {
      await service.toArticleResponse(buildArticle());

      expect(favoritesServiceMock.favoritedBy).toHaveBeenCalledWith(undefined, [
        'article-1',
      ]);
      expect(followsServiceMock.followingAmong).toHaveBeenCalledWith(
        undefined,
        ['jake-id'],
      );
    });
  });

  describe('page', () => {
    it('returns an empty page without querying', async () => {
      const response = await service.toArticlesResponse([], 0, viewer);

      expect(response).toEqual({ articles: [], articlesCount: 0 });
      expect(favoritesServiceMock.countsFor).not.toHaveBeenCalled();
    });

    it('carries the total separately from the page size', async () => {
      const response = await service.toArticlesResponse([buildArticle()], 42);

      expect(response.articles).toHaveLength(1);
      expect(response.articlesCount).toBe(42);
    });

    it('resolves the whole page in three queries, not three per article', async () => {
      const articles = Array.from({ length: 20 }, (_, index) =>
        buildArticle({ id: `article-${index}` }),
      );

      await service.toArticlesResponse(articles, articles.length, viewer);

      expect(favoritesServiceMock.countsFor).toHaveBeenCalledTimes(1);
      expect(favoritesServiceMock.favoritedBy).toHaveBeenCalledTimes(1);
      expect(followsServiceMock.followingAmong).toHaveBeenCalledTimes(1);
    });

    it('asks about each author once even when they wrote several articles', async () => {
      const articles = [
        buildArticle({ id: 'article-1' }),
        buildArticle({ id: 'article-2' }),
      ];

      await service.toArticlesResponse(articles, 2, viewer);

      expect(followsServiceMock.followingAmong).toHaveBeenCalledWith(
        'viewer-id',
        ['jake-id'],
      );
    });

    it('applies the flags per article, not per page', async () => {
      favoritesServiceMock.favoritedBy.mockResolvedValue(
        new Set(['article-2']),
      );
      favoritesServiceMock.countsFor.mockResolvedValue(
        new Map([['article-2', 1]]),
      );

      const { articles } = await service.toArticlesResponse(
        [
          buildArticle({ id: 'article-1', slug: 'first' }),
          buildArticle({ id: 'article-2', slug: 'second' }),
        ],
        2,
        viewer,
      );

      expect(articles[0]).toMatchObject({
        favorited: false,
        favoritesCount: 0,
      });
      expect(articles[1]).toMatchObject({ favorited: true, favoritesCount: 1 });
    });
  });
});
