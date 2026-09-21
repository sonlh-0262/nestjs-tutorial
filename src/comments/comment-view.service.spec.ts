import { Test, TestingModule } from '@nestjs/testing';

import { User } from '../users/entities/user.entity';
import { FollowsService } from '../users/follows.service';
import { CommentViewService } from './comment-view.service';
import { Comment } from './entities/comment.entity';

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

const buildComment = (overrides: Partial<Comment> = {}): Comment =>
  ({
    id: 'comment-1',
    body: 'His name was my name too.',
    articleId: 'article-1',
    authorId: 'jake-id',
    author: buildUser(),
    createdAt: new Date('2026-09-18T08:30:00.000Z'),
    updatedAt: new Date('2026-09-18T08:30:00.000Z'),
    ...overrides,
  }) as Comment;

describe('CommentViewService', () => {
  let service: CommentViewService;

  const followsServiceMock = {
    followingAmong: jest.fn().mockResolvedValue(new Set()),
  };

  const viewer = buildUser({ id: 'viewer-id', username: 'viewer' });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentViewService,
        { provide: FollowsService, useValue: followsServiceMock },
      ],
    }).compile();

    service = module.get(CommentViewService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    followsServiceMock.followingAmong.mockResolvedValue(new Set());
  });

  describe('one', () => {
    it('renders the full comment shape', async () => {
      const { comment } = await service.one(buildComment());

      expect(comment).toEqual({
        id: 'comment-1',
        body: 'His name was my name too.',
        createdAt: '2026-09-18T08:30:00.000Z',
        updatedAt: '2026-09-18T08:30:00.000Z',
        author: {
          username: 'jake',
          bio: 'I work at statefarm',
          image: null,
          following: false,
        },
      });
    });

    it('never leaks the article id, author id or author email', async () => {
      const { comment } = await service.one(buildComment());

      expect(comment).not.toHaveProperty('articleId');
      expect(comment).not.toHaveProperty('authorId');
      expect(comment.author).not.toHaveProperty('id');
      expect(comment.author).not.toHaveProperty('email');
    });

    it('reflects the viewer following the comment author', async () => {
      followsServiceMock.followingAmong.mockResolvedValue(new Set(['jake-id']));

      const { comment } = await service.one(buildComment(), viewer);

      expect(comment.author.following).toBe(true);
    });

    it('asks for no viewer when anonymous', async () => {
      await service.one(buildComment());

      expect(followsServiceMock.followingAmong).toHaveBeenCalledWith(
        undefined,
        ['jake-id'],
      );
    });
  });

  describe('page', () => {
    it('returns an empty page without querying', async () => {
      const response = await service.page([], 0, viewer);

      expect(response).toEqual({ comments: [], commentsCount: 0 });
      expect(followsServiceMock.followingAmong).not.toHaveBeenCalled();
    });

    it('carries the total separately from the page size', async () => {
      const response = await service.page([buildComment()], 42);

      expect(response.comments).toHaveLength(1);
      expect(response.commentsCount).toBe(42);
    });

    it('resolves the whole page in one query, not one per comment', async () => {
      const comments = Array.from({ length: 20 }, (_, index) =>
        buildComment({ id: `comment-${index}` }),
      );

      await service.page(comments, comments.length, viewer);

      expect(followsServiceMock.followingAmong).toHaveBeenCalledTimes(1);
    });

    it('asks about each author once even when they wrote several comments', async () => {
      await service.page(
        [
          buildComment({ id: 'comment-1' }),
          buildComment({ id: 'comment-2' }),
          buildComment({ id: 'comment-3', authorId: 'jill-id' }),
        ],
        3,
        viewer,
      );

      expect(followsServiceMock.followingAmong).toHaveBeenCalledWith(
        'viewer-id',
        ['jake-id', 'jill-id'],
      );
    });

    it('applies the flag per comment, not per page', async () => {
      followsServiceMock.followingAmong.mockResolvedValue(new Set(['jill-id']));

      const { comments } = await service.page(
        [
          buildComment({ id: 'comment-1' }),
          buildComment({
            id: 'comment-2',
            authorId: 'jill-id',
            author: buildUser({ id: 'jill-id', username: 'jill' }),
          }),
        ],
        2,
        viewer,
      );

      expect(comments[0].author.following).toBe(false);
      expect(comments[1].author.following).toBe(true);
    });
  });
});
