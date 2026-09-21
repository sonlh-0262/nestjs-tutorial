import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';

import { ArticlesService } from '../articles/articles.service';
import { Article } from '../articles/entities/article.entity';
import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
} from '../common/constants/pagination';
import { User } from '../users/entities/user.entity';
import { CommentViewService } from './comment-view.service';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

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

const buildArticle = (overrides: Partial<Article> = {}): Article =>
  ({
    id: 'article-1',
    slug: 'how-to-train-your-dragon',
    authorId: 'jake-id',
    ...overrides,
  }) as Article;

const buildComment = (overrides: Partial<Comment> = {}): Comment =>
  ({
    id: 'comment-1',
    body: 'His name was my name too.',
    articleId: 'article-1',
    authorId: 'jake-id',
    createdAt: new Date('2026-09-18T08:30:00.000Z'),
    updatedAt: new Date('2026-09-18T08:30:00.000Z'),
    ...overrides,
  }) as Comment;

describe('CommentsService', () => {
  let service: CommentsService;

  const author = buildUser();
  const stranger = buildUser({ id: 'stranger-id', username: 'stranger' });

  const repositoryMock = {
    create: jest.fn((input: Partial<Comment>) => buildComment(input)),
    save: jest.fn((comment: Comment) => Promise.resolve(comment)),
    findOne: jest.fn().mockResolvedValue(buildComment()),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };

  const articlesServiceMock = {
    findBySlugOrFail: jest.fn().mockResolvedValue(buildArticle()),
  };

  const viewMock = {
    one: jest.fn().mockResolvedValue({ comment: {} }),
    page: jest.fn().mockResolvedValue({ comments: [], commentsCount: 0 }),
  };

  const i18nMock = { t: jest.fn((key: string) => key) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: repositoryMock },
        { provide: ArticlesService, useValue: articlesServiceMock },
        { provide: CommentViewService, useValue: viewMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    repositoryMock.findOne.mockResolvedValue(buildComment());
    repositoryMock.findAndCount.mockResolvedValue([[], 0]);
    articlesServiceMock.findBySlugOrFail.mockResolvedValue(buildArticle());
  });

  describe('create', () => {
    it('stores the comment against the article and the caller', async () => {
      await service.create('how-to-train-your-dragon', author, {
        body: 'His name was my name too.',
      });

      expect(repositoryMock.create).toHaveBeenCalledWith({
        body: 'His name was my name too.',
        articleId: 'article-1',
        authorId: 'jake-id',
      });
      expect(repositoryMock.save).toHaveBeenCalledTimes(1);
    });

    it('renders with the author already attached, without re-reading it', async () => {
      await service.create('how-to-train-your-dragon', author, {
        body: 'His name was my name too.',
      });

      const [comment, viewer] = viewMock.one.mock.calls[0] as [Comment, User];

      expect(comment.author).toBe(author);
      expect(viewer).toBe(author);
    });

    it('rejects a slug nobody wrote before touching the table', async () => {
      articlesServiceMock.findBySlugOrFail.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.create('ghost', author, { body: 'hi' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repositoryMock.save).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('reads the article comments oldest first', async () => {
      await service.list('how-to-train-your-dragon', {});

      expect(repositoryMock.findAndCount).toHaveBeenCalledWith({
        where: { articleId: 'article-1' },
        relations: { author: true },
        order: { createdAt: 'ASC', id: 'ASC' },
        take: DEFAULT_PAGE_LIMIT,
        skip: DEFAULT_PAGE_OFFSET,
      });
    });

    it('honours the page bounds it is given', async () => {
      await service.list('how-to-train-your-dragon', { limit: 5, offset: 10 });

      expect(repositoryMock.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5, skip: 10 }),
      );
    });

    it('passes the total through separately from the page', async () => {
      const comments = [buildComment()];
      repositoryMock.findAndCount.mockResolvedValue([comments, 42]);

      await service.list('how-to-train-your-dragon', {}, author);

      expect(viewMock.page).toHaveBeenCalledWith(comments, 42, author);
    });

    it('renders anonymously when there is no viewer', async () => {
      await service.list('how-to-train-your-dragon', {});

      expect(viewMock.page).toHaveBeenCalledWith([], 0, undefined);
    });
  });

  describe('remove', () => {
    it('deletes a comment the caller wrote', async () => {
      await service.remove('how-to-train-your-dragon', 'comment-1', author);

      expect(repositoryMock.delete).toHaveBeenCalledWith({ id: 'comment-1' });
    });

    it('scopes the lookup to the article in the path', async () => {
      await service.remove('how-to-train-your-dragon', 'comment-1', author);

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 'comment-1', articleId: 'article-1' },
      });
    });

    it('404s when the comment is not on that article', async () => {
      repositoryMock.findOne.mockResolvedValue(null);

      await expect(
        service.remove('how-to-train-your-dragon', 'comment-1', author),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(repositoryMock.delete).not.toHaveBeenCalled();
    });

    it('403s for anyone but the comment author', async () => {
      await expect(
        service.remove('how-to-train-your-dragon', 'comment-1', stranger),
      ).rejects.toBeInstanceOf(ForbiddenException);

      expect(repositoryMock.delete).not.toHaveBeenCalled();
    });

    it('403s for the article author when someone else wrote the comment', async () => {
      repositoryMock.findOne.mockResolvedValue(
        buildComment({ authorId: 'stranger-id' }),
      );

      await expect(
        service.remove('how-to-train-your-dragon', 'comment-1', author),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
