import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource } from 'typeorm';

import { DEFAULT_PAGE_LIMIT } from '../common/constants/pagination';
import { PG_UNIQUE_VIOLATION } from '../database/database.constants';
import { UserFollow } from '../users/entities/user-follow.entity';
import { User } from '../users/entities/user.entity';
import { ArticleViewService } from './article-view.service';
import { SLUG_ATTEMPT_LIMIT } from './articles.constants';
import { ArticlesService } from './articles.service';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Article } from './entities/article.entity';
import { FavoritesService } from './favorites.service';
import { TagsService } from './tags.service';

const buildUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'jake-id',
    email: 'jake@jake.jake',
    username: 'jake',
    bio: null,
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

const uniqueViolation = () => ({ code: PG_UNIQUE_VIOLATION });

describe('ArticlesService', () => {
  let service: ArticlesService;

  const author = buildUser();
  const stranger = buildUser({ id: 'stranger-id', username: 'stranger' });

  const getManyAndCountMock = jest.fn().mockResolvedValue([[], 0]);

  type BuilderMock = Record<
    | 'innerJoinAndSelect'
    | 'leftJoinAndSelect'
    | 'innerJoin'
    | 'andWhere'
    | 'orderBy'
    | 'addOrderBy'
    | 'take'
    | 'skip'
    | 'getManyAndCount',
    jest.Mock
  >;

  const builderMock: BuilderMock = {
    innerJoinAndSelect: jest.fn(() => builderMock),
    leftJoinAndSelect: jest.fn(() => builderMock),
    innerJoin: jest.fn(() => builderMock),
    andWhere: jest.fn(() => builderMock),
    orderBy: jest.fn(() => builderMock),
    addOrderBy: jest.fn(() => builderMock),
    take: jest.fn(() => builderMock),
    skip: jest.fn(() => builderMock),
    getManyAndCount: getManyAndCountMock,
  };

  const articlesRepositoryMock = {
    createQueryBuilder: jest.fn(() => builderMock),
    findOne: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const transactionRepositoryMock = {
    create: jest.fn((input: Partial<Article>) => input as Article),
    save: jest.fn((input: Article) => Promise.resolve(input)),
  };

  const managerMock = {
    getRepository: jest.fn(() => transactionRepositoryMock),
  };

  const dataSourceMock = {
    transaction: jest.fn(
      (run: (manager: typeof managerMock) => Promise<Article>) =>
        run(managerMock),
    ),
  };

  const tagsServiceMock = { resolve: jest.fn().mockResolvedValue([]) };

  const favoritesServiceMock = {
    favorite: jest.fn().mockResolvedValue(undefined),
    unfavorite: jest.fn().mockResolvedValue(undefined),
  };

  const viewMock = {
    one: jest.fn((article: Article) => Promise.resolve({ article })),
    page: jest.fn((articles: Article[], articlesCount: number) =>
      Promise.resolve({ articles, articlesCount }),
    ),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        {
          provide: getRepositoryToken(Article),
          useValue: articlesRepositoryMock,
        },
        { provide: TagsService, useValue: tagsServiceMock },
        { provide: FavoritesService, useValue: favoritesServiceMock },
        { provide: ArticleViewService, useValue: viewMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(ArticlesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    getManyAndCountMock.mockResolvedValue([[], 0]);
    articlesRepositoryMock.findOne.mockResolvedValue(null);
    tagsServiceMock.resolve.mockResolvedValue([]);
    transactionRepositoryMock.save.mockImplementation((input: Article) =>
      Promise.resolve(input),
    );
  });

  describe('create', () => {
    it('derives the slug from the title', async () => {
      await service.create(author, {
        title: 'How to train your dragon',
        description: 'Ever wonder how?',
        body: 'It takes a Jacobian',
      });

      expect(transactionRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'how-to-train-your-dragon' }),
      );
    });

    it('stores the article against the caller', async () => {
      await service.create(author, {
        title: 'Dragons',
        description: 'd',
        body: 'b',
      });

      expect(transactionRepositoryMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ authorId: 'jake-id' }),
      );
    });

    it('resolves the tags inside the same transaction as the article', async () => {
      await service.create(author, {
        title: 'Dragons',
        description: 'd',
        body: 'b',
        tagList: ['Dragons', 'training'],
      });

      expect(tagsServiceMock.resolve).toHaveBeenCalledWith(
        ['Dragons', 'training'],
        managerMock,
      );
      expect(dataSourceMock.transaction).toHaveBeenCalledTimes(1);
    });

    it('treats a missing tagList as no tags', async () => {
      await service.create(author, {
        title: 'Dragons',
        description: 'd',
        body: 'b',
      });

      expect(tagsServiceMock.resolve).toHaveBeenCalledWith([], managerMock);
    });

    it('retries with a discriminator when the slug is taken', async () => {
      transactionRepositoryMock.save
        .mockRejectedValueOnce(uniqueViolation())
        .mockImplementation((input: Article) => Promise.resolve(input));

      await service.create(author, {
        title: 'Dragons',
        description: 'd',
        body: 'b',
      });

      const slugs = transactionRepositoryMock.create.mock.calls.map(
        ([input]) => (input as Article).slug,
      );

      expect(slugs[0]).toBe('dragons');
      expect(slugs[1]).toMatch(/^dragons-[a-z0-9]{6}$/);
    });

    it('gives up after the attempt budget', async () => {
      transactionRepositoryMock.save.mockRejectedValue(uniqueViolation());

      await expect(
        service.create(author, {
          title: 'Dragons',
          description: 'd',
          body: 'b',
        }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionRepositoryMock.save).toHaveBeenCalledTimes(
        SLUG_ATTEMPT_LIMIT,
      );
    });

    it('does not retry an error that is not a slug collision', async () => {
      transactionRepositoryMock.save.mockRejectedValue(new Error('boom'));

      await expect(
        service.create(author, {
          title: 'Dragons',
          description: 'd',
          body: 'b',
        }),
      ).rejects.toThrow('boom');

      expect(transactionRepositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('renders through the view with the author as viewer', async () => {
      await service.create(author, {
        title: 'Dragons',
        description: 'd',
        body: 'b',
      });

      expect(viewMock.one).toHaveBeenCalledWith(
        expect.objectContaining({ author }),
        author,
      );
    });
  });

  describe('list', () => {
    it('applies the default page bounds', async () => {
      await service.list({});

      expect(builderMock.take).toHaveBeenCalledWith(DEFAULT_PAGE_LIMIT);
      expect(builderMock.skip).toHaveBeenCalledWith(0);
    });

    it('passes the requested page bounds through', async () => {
      await service.list({ limit: 5, offset: 10 });

      expect(builderMock.take).toHaveBeenCalledWith(5);
      expect(builderMock.skip).toHaveBeenCalledWith(10);
    });

    it('orders newest first with a stable tiebreak', async () => {
      await service.list({});

      expect(builderMock.orderBy).toHaveBeenCalledWith(
        'article.createdAt',
        'DESC',
      );
      expect(builderMock.addOrderBy).toHaveBeenCalledWith('article.id', 'DESC');
    });

    it('joins the tag filter rather than filtering in memory', async () => {
      await service.list({ tag: 'dragons' });

      expect(builderMock.innerJoin).toHaveBeenCalledWith(
        'article.tags',
        'filterTag',
        'filterTag.name = :tag',
        { tag: 'dragons' },
      );
    });

    it('filters on the author alias already joined by the base query', async () => {
      await service.list({ author: 'jake' });

      expect(builderMock.andWhere).toHaveBeenCalledWith(
        'author.username = :author',
        { author: 'jake' },
      );
    });

    it('joins article_favorites and users for a favorited filter', async () => {
      await service.list({ favorited: 'jake' });

      expect(builderMock.innerJoin).toHaveBeenCalledWith(
        ArticleFavorite,
        'filterFavorite',
        'filterFavorite.articleId = article.id',
      );
      expect(builderMock.innerJoin).toHaveBeenCalledWith(
        User,
        'filterFavoriter',
        expect.stringContaining('filterFavoriter.username = :favorited'),
        { favorited: 'jake' },
      );
    });

    it('lets the join decide a username nobody has, with no extra query', async () => {
      const response = await service.list({ author: 'ghost' });

      expect(response).toEqual({ articles: [], articlesCount: 0 });
      expect(articlesRepositoryMock.createQueryBuilder).toHaveBeenCalledTimes(
        1,
      );
    });

    it('combines every filter on one builder', async () => {
      await service.list({ tag: 'dragons', author: 'jake', favorited: 'bob' });

      expect(articlesRepositoryMock.createQueryBuilder).toHaveBeenCalledTimes(
        1,
      );
      expect(builderMock.innerJoin).toHaveBeenCalledTimes(3);
      expect(builderMock.andWhere).toHaveBeenCalledTimes(1);
    });

    it('reports the unpaginated total', async () => {
      getManyAndCountMock.mockResolvedValue([[buildArticle()], 42]);

      const response = await service.list({ limit: 1 });

      expect(response.articlesCount).toBe(42);
      expect(response.articles).toHaveLength(1);
    });
  });

  describe('feed', () => {
    it('restricts the page to authors the viewer follows', async () => {
      await service.feed({}, stranger);

      expect(builderMock.innerJoin).toHaveBeenCalledWith(
        UserFollow,
        'feedFollow',
        expect.stringContaining('feedFollow.followerId = :viewerId'),
        { viewerId: 'stranger-id' },
      );
    });

    it('paginates like the list endpoint', async () => {
      await service.feed({ limit: 3, offset: 6 }, stranger);

      expect(builderMock.take).toHaveBeenCalledWith(3);
      expect(builderMock.skip).toHaveBeenCalledWith(6);
    });
  });

  describe('getBySlug', () => {
    it('loads the author and tags in one read', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.getBySlug('how-to-train-your-dragon');

      expect(articlesRepositoryMock.findOne).toHaveBeenCalledWith({
        where: { slug: 'how-to-train-your-dragon' },
        relations: { author: true, tags: true },
      });
    });

    it('rejects an unknown slug', async () => {
      await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('refuses a caller who is not the author', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await expect(
        service.update('how-to-train-your-dragon', stranger, { body: 'hi' }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(articlesRepositoryMock.update).not.toHaveBeenCalled();
    });

    it('rejects an unknown slug before checking authorship', async () => {
      await expect(
        service.update('nope', stranger, { body: 'hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('writes only the fields that were sent', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.update('how-to-train-your-dragon', author, {
        body: 'rewritten',
      });

      expect(articlesRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'article-1' },
        { body: 'rewritten' },
      );
    });

    it('writes nothing for an empty patch', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.update('how-to-train-your-dragon', author, {});

      expect(articlesRepositoryMock.update).not.toHaveBeenCalled();
    });

    it('renames the slug when the title changes', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.update('how-to-train-your-dragon', author, {
        title: 'How to feed your dragon',
      });

      expect(articlesRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'article-1' },
        {
          title: 'How to feed your dragon',
          slug: 'how-to-feed-your-dragon',
        },
      );
    });

    it('keeps the slug when the title is resent unchanged', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.update('how-to-train-your-dragon', author, {
        title: 'How to train your dragon',
      });

      expect(articlesRepositoryMock.update).toHaveBeenCalledWith(
        { id: 'article-1' },
        { title: 'How to train your dragon' },
      );
    });

    it('retries the rename when the new slug is taken', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());
      articlesRepositoryMock.update
        .mockRejectedValueOnce(uniqueViolation())
        .mockResolvedValue({ affected: 1 });

      await service.update('how-to-train-your-dragon', author, {
        title: 'Dragons',
      });

      const slugs = articlesRepositoryMock.update.mock.calls.map(
        ([, changes]) => (changes as Partial<Article>).slug,
      );

      expect(slugs[0]).toBe('dragons');
      expect(slugs[1]).toMatch(/^dragons-[a-z0-9]{6}$/);
    });

    it('re-reads the row so the response carries the new updated_at', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.update('how-to-train-your-dragon', author, {
        body: 'rewritten',
      });

      expect(articlesRepositoryMock.findOne).toHaveBeenCalledTimes(2);
    });
  });

  describe('remove', () => {
    it('refuses a caller who is not the author', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await expect(
        service.remove('how-to-train-your-dragon', stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(articlesRepositoryMock.delete).not.toHaveBeenCalled();
    });

    it('deletes by id, letting the foreign keys clear the links', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.remove('how-to-train-your-dragon', author);

      expect(articlesRepositoryMock.delete).toHaveBeenCalledWith({
        id: 'article-1',
      });
    });

    it('rejects an unknown slug', async () => {
      await expect(service.remove('nope', author)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('favorite', () => {
    it('records the favorite for the caller', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.favorite('how-to-train-your-dragon', stranger);

      expect(favoritesServiceMock.favorite).toHaveBeenCalledWith(
        'stranger-id',
        'article-1',
      );
    });

    it('lets an author favorite their own article', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await expect(
        service.favorite('how-to-train-your-dragon', author),
      ).resolves.toBeDefined();
    });

    it('rejects an unknown slug', async () => {
      await expect(service.favorite('nope', stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );

      expect(favoritesServiceMock.favorite).not.toHaveBeenCalled();
    });
  });

  describe('unfavorite', () => {
    it('removes the favorite for the caller', async () => {
      articlesRepositoryMock.findOne.mockResolvedValue(buildArticle());

      await service.unfavorite('how-to-train-your-dragon', stranger);

      expect(favoritesServiceMock.unfavorite).toHaveBeenCalledWith(
        'stranger-id',
        'article-1',
      );
    });

    it('rejects an unknown slug', async () => {
      await expect(service.unfavorite('nope', stranger)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
