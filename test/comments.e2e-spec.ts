import { randomUUID } from 'crypto';
import request, { Test } from 'supertest';

import { Article } from '../src/articles/entities/article.entity';
import { COMMENT_BODY_MAX_LENGTH } from '../src/comments/comments.constants';
import { Comment } from '../src/comments/entities/comment.entity';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from '../src/common/constants/pagination';
import { User } from '../src/users/entities/user.entity';
import { SeededUser } from './support/interfaces/seeded-user.interface';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';

/**
 * `CommentsController` at C2 - condition coverage.
 *
 * C0 asks that every statement run, C1 that every decision go both ways, C2
 * that every *condition inside* a decision go both ways. The three handlers
 * here reach a decision through four layers, and C1 would be satisfied by one
 * 401 and one 201 per handler while leaving most of those layers untested:
 *
 *   guard      header absent / present-but-invalid / revoked / subject gone
 *   pipe       `:id` parses as a uuid or does not
 *   DTO        each `@Is…` on `body`, plus the whitelist
 *   service    article found, comment found, comment on *this* article, author
 *
 * So the cases below are grouped by decision, and each group walks its
 * conditions one at a time with everything else held valid - the failing case
 * then names the condition that produced it. `expected 404, got 403` is worth
 * more than a red line in a test called "deletes a comment".
 *
 * The ordering and paging cases lean on `factories.comments.createThread()`,
 * which backdates rows a second apart. Comments come back ordered by
 * `created_at` with the random `id` as the tiebreak, so rows written at full
 * speed through the endpoint would come back in an unpredictable order and
 * every assertion here would be flaky for reasons that have nothing to do with
 * the code under test.
 */

interface CommentBody {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
}

interface CommentEnvelope {
  comment: CommentBody;
}

interface CommentsEnvelope {
  comments: CommentBody[];
  commentsCount: number;
}

const VALID_BODY = 'His name was my name too.';

describe('CommentsController (e2e)', () => {
  let ctx: TestContext;

  let author: SeededUser;
  let article: Article;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  // Fake data for every test case: an author who can sign in, and an article
  // of theirs to hang comments off.
  beforeEach(async () => {
    author = await ctx.factories.users.createAuthenticated();
    article = await ctx.factories.articles.create(author.user);
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const commentsUrl = (slug = article.slug) => `/articles/${slug}/comments`;

  const commentUrl = (id: string, slug = article.slug) =>
    `${commentsUrl(slug)}/${id}`;

  /** `Authorization: Token <jwt>`, the scheme the RealWorld spec uses. */
  const as = (test: Test, token?: string): Test =>
    token === undefined ? test : test.set('Authorization', `Token ${token}`);

  const postComment = (token?: string, body: unknown = VALID_BODY) =>
    as(request(ctx.server()).post(commentsUrl()), token).send({
      comment: { body },
    });

  const listComments = (token?: string, query = '') =>
    as(request(ctx.server()).get(`${commentsUrl()}${query}`), token);

  const deleteComment = (id: string, token?: string, slug = article.slug) =>
    as(request(ctx.server()).delete(commentUrl(id, slug)), token);

  const revoke = async (token: string): Promise<string> => {
    await request(ctx.server())
      .post('/users/logout')
      .set('Authorization', `Token ${token}`)
      .expect(200);

    return token;
  };

  /** A syntactically valid JWT whose signature no longer matches its payload. */
  const tamper = (token: string): string =>
    token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');

  const commentRows = () => ctx.dataSource.getRepository(Comment);

  describe('POST /articles/:slug/comments', () => {
    describe('authentication', () => {
      it('rejects a request with no Authorization header', async () => {
        await postComment().expect(401);
      });

      it('rejects a token whose signature does not match', async () => {
        await postComment(tamper(author.token)).expect(401);
      });

      it('rejects a token that has been revoked by logging out', async () => {
        await postComment(await revoke(author.token)).expect(401);
      });

      it('rejects a token whose user no longer exists', async () => {
        await ctx.dataSource.getRepository(User).delete({ id: author.user.id });

        await postComment(author.token).expect(401);
      });

      it('accepts the Bearer scheme as well as Token', async () => {
        await request(ctx.server())
          .post(commentsUrl())
          .set('Authorization', `Bearer ${author.token}`)
          .send({ comment: { body: VALID_BODY } })
          .expect(201);
      });
    });

    describe('payload validation', () => {
      const postRaw = (payload: object) =>
        request(ctx.server())
          .post(commentsUrl())
          .set('Authorization', `Token ${author.token}`)
          .send(payload);

      it('rejects a payload with no comment envelope', async () => {
        await postRaw({}).expect(400);
      });

      it('rejects a comment envelope that is not an object', async () => {
        await postRaw({ comment: VALID_BODY }).expect(400);
      });

      /**
       * Pinned, not endorsed. This case was written expecting a 400 and got a
       * 201, which is the finding rather than the bug in the test.
       *
       * `configureApp` turns on `transformOptions: { enableImplicitConversion:
       * true }`. The query DTOs need it - `?limit=5` arrives as a string and
       * `@IsInt` has to see a number - but class-transformer applies the same
       * rule to body fields, where JSON already carries the type. So `42` is
       * converted to `'42'` before `@IsString()` on `CreateCommentBodyDto.body`
       * ever runs, and that decorator cannot reject anything.
       *
       * Not fixed here: switching implicit conversion off changes how every
       * endpoint in the application validates, and that is not a change to make
       * inside a testing pull. The case stays so the suite says out loud what
       * the behaviour is, and so the day somebody does turn it off, this is the
       * test that tells them what moved.
       */
      it('coerces a numeric body to a string instead of rejecting it', async () => {
        const response = await postComment(author.token, 42).expect(201);

        expect((response.body as CommentEnvelope).comment.body).toBe('42');
      });

      it('rejects a body that is empty', async () => {
        await postComment(author.token, '').expect(400);
      });

      it('rejects a body that is only whitespace', async () => {
        await postComment(author.token, '   ').expect(400);
      });

      it(`accepts a body of exactly ${COMMENT_BODY_MAX_LENGTH} characters`, async () => {
        await postComment(
          author.token,
          'x'.repeat(COMMENT_BODY_MAX_LENGTH),
        ).expect(201);
      });

      it('rejects a body one character past the limit', async () => {
        await postComment(
          author.token,
          'x'.repeat(COMMENT_BODY_MAX_LENGTH + 1),
        ).expect(400);
      });

      it('rejects an unknown property inside the comment', async () => {
        await postRaw({
          comment: { body: VALID_BODY, author: 'someone' },
        }).expect(400);
      });

      it('rejects an unknown property beside the comment', async () => {
        await postRaw({ comment: { body: VALID_BODY }, draft: true }).expect(
          400,
        );
      });
    });

    describe('article lookup', () => {
      it('returns 404 for a slug no article has', async () => {
        await as(
          request(ctx.server()).post(commentsUrl('no-such-article')),
          author.token,
        )
          .send({ comment: { body: VALID_BODY } })
          .expect(404);
      });

      it('does not write a row when the article is missing', async () => {
        await as(
          request(ctx.server()).post(commentsUrl('no-such-article')),
          author.token,
        )
          .send({ comment: { body: VALID_BODY } })
          .expect(404);

        await expect(commentRows().count()).resolves.toBe(0);
      });
    });

    describe('on success', () => {
      it('returns the comment with its author profile', async () => {
        const response = await postComment(author.token).expect(201);
        const { comment } = response.body as CommentEnvelope;

        expect(Object.keys(comment).sort()).toEqual([
          'author',
          'body',
          'createdAt',
          'id',
          'updatedAt',
        ]);
        expect(comment).toMatchObject({
          body: VALID_BODY,
          author: {
            username: author.user.username,
            bio: null,
            image: null,
            following: false,
          },
        });
        expect(Date.parse(comment.createdAt)).not.toBeNaN();
        expect(comment.updatedAt).toBe(comment.createdAt);
      });

      it('stores the comment against the article and the caller', async () => {
        const response = await postComment(author.token).expect(201);
        const { comment } = response.body as CommentEnvelope;

        const row = await commentRows().findOneByOrFail({ id: comment.id });

        expect(row).toMatchObject({
          body: VALID_BODY,
          articleId: article.id,
          authorId: author.user.id,
        });
      });

      it('trims the body before storing it', async () => {
        const response = await postComment(
          author.token,
          `  ${VALID_BODY}  `,
        ).expect(201);

        expect((response.body as CommentEnvelope).comment.body).toBe(
          VALID_BODY,
        );
      });

      it('lets a reader comment on an article they do not own', async () => {
        const reader = await ctx.factories.users.createAuthenticated();

        const response = await postComment(reader.token).expect(201);

        expect((response.body as CommentEnvelope).comment.author.username).toBe(
          reader.user.username,
        );
      });

      it('reports following as false on your own comment', async () => {
        const response = await postComment(author.token).expect(201);

        expect(
          (response.body as CommentEnvelope).comment.author.following,
        ).toBe(false);
      });
    });
  });

  describe('GET /articles/:slug/comments', () => {
    describe('authentication', () => {
      it('serves an anonymous caller', async () => {
        await ctx.factories.comments.create(article, author.user);

        await listComments().expect(200);
      });

      it('serves a caller with a valid token', async () => {
        await listComments(author.token).expect(200);
      });

      it('rejects a token whose signature does not match', async () => {
        await listComments(tamper(author.token)).expect(401);
      });

      it('rejects a token that has been revoked', async () => {
        await listComments(await revoke(author.token)).expect(401);
      });
    });

    describe('article lookup', () => {
      it('returns 404 for a slug no article has', async () => {
        await request(ctx.server())
          .get(commentsUrl('no-such-article'))
          .expect(404);
      });
    });

    describe('query validation', () => {
      it('accepts a request with no paging parameters', async () => {
        await listComments().expect(200);
      });

      it('accepts a limit of exactly the maximum', async () => {
        await listComments(undefined, `?limit=${MAX_PAGE_LIMIT}`).expect(200);
      });

      it('rejects a limit one past the maximum', async () => {
        await listComments(undefined, `?limit=${MAX_PAGE_LIMIT + 1}`).expect(
          400,
        );
      });

      it('rejects a limit of zero', async () => {
        await listComments(undefined, '?limit=0').expect(400);
      });

      it('rejects a limit that is not a number', async () => {
        await listComments(undefined, '?limit=many').expect(400);
      });

      it('rejects a limit that is not whole', async () => {
        await listComments(undefined, '?limit=1.5').expect(400);
      });

      it('accepts an offset of zero', async () => {
        await listComments(undefined, '?offset=0').expect(200);
      });

      it('rejects a negative offset', async () => {
        await listComments(undefined, '?offset=-1').expect(400);
      });

      it('rejects an unknown query parameter', async () => {
        await listComments(undefined, '?sort=newest').expect(400);
      });
    });

    describe('the page it returns', () => {
      it('returns an empty page for an article with no comments', async () => {
        const response = await listComments().expect(200);

        expect(response.body).toEqual({ comments: [], commentsCount: 0 });
      });

      it('returns comments oldest first', async () => {
        const thread = await ctx.factories.comments.createThread(
          article,
          author.user,
          3,
        );

        const response = await listComments().expect(200);
        const { comments } = response.body as CommentsEnvelope;

        expect(comments.map((comment) => comment.id)).toEqual(
          thread.map((comment) => comment.id),
        );
      });

      it('applies limit and offset to the window', async () => {
        const thread = await ctx.factories.comments.createThread(
          article,
          author.user,
          5,
        );

        const response = await listComments(
          undefined,
          '?limit=2&offset=1',
        ).expect(200);
        const { comments } = response.body as CommentsEnvelope;

        expect(comments.map((comment) => comment.id)).toEqual([
          thread[1].id,
          thread[2].id,
        ]);
      });

      it('counts every comment, not just the window', async () => {
        await ctx.factories.comments.createThread(article, author.user, 5);

        const response = await listComments(undefined, '?limit=2').expect(200);

        expect((response.body as CommentsEnvelope).commentsCount).toBe(5);
      });

      it('returns an empty window past the end without changing the count', async () => {
        await ctx.factories.comments.createThread(article, author.user, 2);

        const response = await listComments(undefined, '?offset=10').expect(
          200,
        );

        expect(response.body).toEqual({ comments: [], commentsCount: 2 });
      });

      it(`defaults the window to ${DEFAULT_PAGE_LIMIT} rows`, async () => {
        await ctx.factories.comments.createThread(
          article,
          author.user,
          DEFAULT_PAGE_LIMIT + 1,
        );

        const response = await listComments().expect(200);
        const { comments, commentsCount } = response.body as CommentsEnvelope;

        expect(comments).toHaveLength(DEFAULT_PAGE_LIMIT);
        expect(commentsCount).toBe(DEFAULT_PAGE_LIMIT + 1);
      });

      it('leaves out comments on other articles', async () => {
        const other = await ctx.factories.articles.create(author.user);
        await ctx.factories.comments.create(other, author.user);
        const mine = await ctx.factories.comments.create(article, author.user);

        const response = await listComments().expect(200);
        const { comments } = response.body as CommentsEnvelope;

        expect(comments.map((comment) => comment.id)).toEqual([mine.id]);
      });
    });

    describe('the following flag on each author', () => {
      it('is false for an anonymous caller', async () => {
        await ctx.factories.comments.create(article, author.user);

        const response = await listComments().expect(200);

        expect(
          (response.body as CommentsEnvelope).comments[0].author.following,
        ).toBe(false);
      });

      it('is true when the caller follows the comment author', async () => {
        const reader = await ctx.factories.users.createAuthenticated();
        await ctx.factories.follows.create(reader.user, author.user);
        await ctx.factories.comments.create(article, author.user);

        const response = await listComments(reader.token).expect(200);

        expect(
          (response.body as CommentsEnvelope).comments[0].author.following,
        ).toBe(true);
      });

      it('is false when the caller does not follow the comment author', async () => {
        const reader = await ctx.factories.users.createAuthenticated();
        await ctx.factories.comments.create(article, author.user);

        const response = await listComments(reader.token).expect(200);

        expect(
          (response.body as CommentsEnvelope).comments[0].author.following,
        ).toBe(false);
      });

      it('is false on your own comment', async () => {
        await ctx.factories.comments.create(article, author.user);

        const response = await listComments(author.token).expect(200);

        expect(
          (response.body as CommentsEnvelope).comments[0].author.following,
        ).toBe(false);
      });

      it('is resolved per author within one page', async () => {
        const reader = await ctx.factories.users.createAuthenticated();
        const stranger = await ctx.factories.users.create();

        await ctx.factories.follows.create(reader.user, author.user);

        const first = await ctx.factories.comments.create(article, author.user);
        const second = await ctx.factories.comments.create(article, stranger);

        const response = await listComments(reader.token).expect(200);
        const { comments } = response.body as CommentsEnvelope;

        const followingById = new Map(
          comments.map((comment) => [comment.id, comment.author.following]),
        );

        expect(followingById.get(first.id)).toBe(true);
        expect(followingById.get(second.id)).toBe(false);
      });
    });
  });

  describe('DELETE /articles/:slug/comments/:id', () => {
    let comment: Comment;

    beforeEach(async () => {
      comment = await ctx.factories.comments.create(article, author.user);
    });

    describe('authentication', () => {
      it('rejects a request with no Authorization header', async () => {
        await deleteComment(comment.id).expect(401);
      });

      it('rejects a token whose signature does not match', async () => {
        await deleteComment(comment.id, tamper(author.token)).expect(401);
      });

      it('rejects a token that has been revoked', async () => {
        await deleteComment(comment.id, await revoke(author.token)).expect(401);
      });

      it('leaves the comment in place when the caller is anonymous', async () => {
        await deleteComment(comment.id).expect(401);

        await expect(commentRows().countBy({ id: comment.id })).resolves.toBe(
          1,
        );
      });
    });

    describe('the id in the path', () => {
      it('rejects an id that is not a uuid', async () => {
        await deleteComment('not-a-uuid', author.token).expect(400);
      });

      it('returns 404 for a well-formed id no comment has', async () => {
        await deleteComment(randomUUID(), author.token).expect(404);
      });
    });

    describe('the article in the path', () => {
      it('returns 404 when the slug belongs to no article', async () => {
        await deleteComment(comment.id, author.token, 'no-such-article').expect(
          404,
        );
      });

      it('returns 404 when the comment is on a different article', async () => {
        const other = await ctx.factories.articles.create(author.user);

        await deleteComment(comment.id, author.token, other.slug).expect(404);
      });

      it('leaves the comment in place after a cross-article attempt', async () => {
        const other = await ctx.factories.articles.create(author.user);

        await deleteComment(comment.id, author.token, other.slug).expect(404);

        await expect(commentRows().countBy({ id: comment.id })).resolves.toBe(
          1,
        );
      });
    });

    describe('authorisation', () => {
      it('refuses a caller who did not write the comment', async () => {
        const stranger = await ctx.factories.users.createAuthenticated();

        await deleteComment(comment.id, stranger.token).expect(403);
      });

      it('refuses the article author when somebody else wrote the comment', async () => {
        const commenter = await ctx.factories.users.createAuthenticated();
        const theirs = await ctx.factories.comments.create(
          article,
          commenter.user,
        );

        await deleteComment(theirs.id, author.token).expect(403);
      });

      it('allows a commenter who does not own the article', async () => {
        const commenter = await ctx.factories.users.createAuthenticated();
        const theirs = await ctx.factories.comments.create(
          article,
          commenter.user,
        );

        await deleteComment(theirs.id, commenter.token).expect(204);
      });

      it('leaves the comment in place after a refused delete', async () => {
        const stranger = await ctx.factories.users.createAuthenticated();

        await deleteComment(comment.id, stranger.token).expect(403);

        await expect(commentRows().countBy({ id: comment.id })).resolves.toBe(
          1,
        );
      });
    });

    describe('on success', () => {
      it('answers 204 with no body', async () => {
        const response = await deleteComment(comment.id, author.token).expect(
          204,
        );

        expect(response.body).toEqual({});
      });

      it('removes the row', async () => {
        await deleteComment(comment.id, author.token).expect(204);

        await expect(commentRows().countBy({ id: comment.id })).resolves.toBe(
          0,
        );
      });

      it('returns 404 the second time', async () => {
        await deleteComment(comment.id, author.token).expect(204);

        await deleteComment(comment.id, author.token).expect(404);
      });

      it('leaves the other comments on the article alone', async () => {
        const survivor = await ctx.factories.comments.create(
          article,
          author.user,
        );

        await deleteComment(comment.id, author.token).expect(204);

        await expect(commentRows().countBy({ id: survivor.id })).resolves.toBe(
          1,
        );
      });
    });
  });

  describe('referential integrity', () => {
    it('drops the comments when the article is deleted', async () => {
      await ctx.factories.comments.createThread(article, author.user, 2);

      await ctx.dataSource.getRepository(Article).delete({ id: article.id });

      await expect(
        commentRows().countBy({ articleId: article.id }),
      ).resolves.toBe(0);
    });

    it('drops the comments when their author is deleted', async () => {
      const commenter = await ctx.factories.users.create();
      await ctx.factories.comments.create(article, commenter);

      await ctx.dataSource.getRepository(User).delete({ id: commenter.id });

      await expect(
        commentRows().countBy({ authorId: commenter.id }),
      ).resolves.toBe(0);
    });
  });
});
