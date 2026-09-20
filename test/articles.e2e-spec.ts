import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { MAX_TAGS_PER_ARTICLE } from '../src/articles/articles.constants';
import { ArticleFavorite } from '../src/articles/entities/article-favorite.entity';
import { Article } from '../src/articles/entities/article.entity';
import { Tag } from '../src/articles/entities/tag.entity';
import { MAX_PAGE_LIMIT } from '../src/common/constants/pagination';
import { configureApp } from '../src/config/app-setup';
import { APP_CONFIG_KEY, AppConfig } from '../src/config/configuration';
import { User } from '../src/users/entities/user.entity';

interface ArticleBody {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
}

interface ArticleEnvelope {
  article: ArticleBody;
}

interface ArticlesEnvelope {
  articles: ArticleBody[];
  articlesCount: number;
}

interface UserEnvelope {
  user: { username: string; token?: string };
}

const buildCredentials = () => {
  const suffix = randomUUID().slice(0, 8);

  return {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: 'Sup3rS3cret!',
  };
};

const uniqueTag = () => `tag-${randomUUID().slice(0, 8)}`;

describe('Articles (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const appConfig = app
      .get(ConfigService)
      .getOrThrow<AppConfig>(APP_CONFIG_KEY);
    configureApp(app, appConfig);

    app.enableShutdownHooks();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  const register = async () => {
    const credentials = buildCredentials();

    const response = await request(server())
      .post('/users')
      .send({ user: credentials })
      .expect(201);

    return {
      username: credentials.username,
      token: (response.body as UserEnvelope).user.token as string,
    };
  };

  const createArticle = async (
    token: string,
    overrides: Record<string, unknown> = {},
  ): Promise<ArticleBody> => {
    const response = await request(server())
      .post('/articles')
      .set('Authorization', `Token ${token}`)
      .send({
        article: {
          title: `Dragons ${randomUUID().slice(0, 8)}`,
          description: 'Ever wonder how?',
          body: 'It takes a Jacobian',
          ...overrides,
        },
      })
      .expect(201);

    return (response.body as ArticleEnvelope).article;
  };

  const follow = (token: string, username: string) =>
    request(server())
      .post(`/profiles/${username}/follow`)
      .set('Authorization', `Token ${token}`)
      .expect(200);

  describe('POST /articles', () => {
    it('returns the created article', async () => {
      const { token, username } = await register();

      const response = await request(server())
        .post('/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: {
            title: 'How to train your dragon',
            description: 'Ever wonder how?',
            body: 'It takes a Jacobian',
            tagList: ['dragons', 'training'],
          },
        })
        .expect(201);

      const { article } = response.body as ArticleEnvelope;

      expect(article).toMatchObject({
        title: 'How to train your dragon',
        description: 'Ever wonder how?',
        body: 'It takes a Jacobian',
        tagList: ['dragons', 'training'],
        favorited: false,
        favoritesCount: 0,
        author: { username, following: false },
      });
      expect(article.slug).toMatch(/^how-to-train-your-dragon/);
      expect(Date.parse(article.createdAt)).not.toBeNaN();
    });

    it('never exposes internal ids', async () => {
      const { token } = await register();

      const article = await createArticle(token);

      expect(article).not.toHaveProperty('id');
      expect(article).not.toHaveProperty('authorId');
      expect(article.author).not.toHaveProperty('email');
    });

    it('gives a second article with the same title a distinct slug', async () => {
      const { token } = await register();
      const title = `Same title ${randomUUID().slice(0, 8)}`;

      const first = await createArticle(token, { title });
      const second = await createArticle(token, { title });

      expect(second.slug).not.toBe(first.slug);
      expect(second.slug).toMatch(new RegExp(`^${first.slug}-[a-z0-9]{6}$`));
    });

    it('still produces a slug for a title with no latin characters', async () => {
      const { token } = await register();

      const article = await createArticle(token, { title: 'こんにちは世界' });

      expect(article.slug).toMatch(/^[a-z0-9]{6}$/);
    });

    it('lower-cases, trims and de-duplicates the tags', async () => {
      const { token } = await register();
      const tag = uniqueTag();

      const article = await createArticle(token, {
        tagList: [` ${tag.toUpperCase()} `, tag, 'Dragons'],
      });

      expect(article.tagList).toEqual([tag, 'dragons'].sort());
    });

    it('reuses an existing tag row rather than duplicating it', async () => {
      const { token } = await register();
      const tag = uniqueTag();

      await createArticle(token, { tagList: [tag] });
      await createArticle(token, { tagList: [tag.toUpperCase()] });

      await expect(
        dataSource.getRepository(Tag).countBy({ name: tag }),
      ).resolves.toBe(1);
    });

    it('rejects an anonymous request', async () => {
      await request(server())
        .post('/articles')
        .send({ article: { title: 't', description: 'd', body: 'b' } })
        .expect(401);
    });

    it('rejects a missing required field', async () => {
      const { token } = await register();

      await request(server())
        .post('/articles')
        .set('Authorization', `Token ${token}`)
        .send({ article: { title: 'Only a title' } })
        .expect(400);
    });

    it('rejects more tags than the cap', async () => {
      const { token } = await register();

      await request(server())
        .post('/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: {
            title: 'Too many tags',
            description: 'd',
            body: 'b',
            tagList: Array.from(
              { length: MAX_TAGS_PER_ARTICLE + 1 },
              (_, index) => `tag${index}`,
            ),
          },
        })
        .expect(400);
    });

    it('rejects an unknown field in the envelope', async () => {
      const { token } = await register();

      await request(server())
        .post('/articles')
        .set('Authorization', `Token ${token}`)
        .send({
          article: {
            title: 't',
            description: 'd',
            body: 'b',
            favoritesCount: 99,
          },
        })
        .expect(400);
    });
  });

  describe('GET /articles', () => {
    it('lists an author’s articles, newest first', async () => {
      const { token, username } = await register();

      const first = await createArticle(token);
      const second = await createArticle(token);

      const response = await request(server())
        .get('/articles')
        .query({ author: username })
        .expect(200);

      const { articles, articlesCount } = response.body as ArticlesEnvelope;

      expect(articlesCount).toBe(2);
      expect(articles.map((article) => article.slug)).toEqual([
        second.slug,
        first.slug,
      ]);
    });

    it('filters by tag', async () => {
      const { token } = await register();
      const tag = uniqueTag();

      const tagged = await createArticle(token, { tagList: [tag] });
      await createArticle(token);

      const response = await request(server())
        .get('/articles')
        .query({ tag })
        .expect(200);

      const { articles } = response.body as ArticlesEnvelope;

      expect(articles.map((article) => article.slug)).toEqual([tagged.slug]);
    });

    it('matches a tag filter regardless of the case sent', async () => {
      const { token } = await register();
      const tag = uniqueTag();

      await createArticle(token, { tagList: [tag] });

      const response = await request(server())
        .get('/articles')
        .query({ tag: tag.toUpperCase() })
        .expect(200);

      expect((response.body as ArticlesEnvelope).articlesCount).toBe(1);
    });

    it('filters by who favorited', async () => {
      const { token: authorToken } = await register();
      const { token: readerToken, username: reader } = await register();

      const favorited = await createArticle(authorToken);
      await createArticle(authorToken);

      await request(server())
        .post(`/articles/${favorited.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const response = await request(server())
        .get('/articles')
        .query({ favorited: reader })
        .expect(200);

      const { articles } = response.body as ArticlesEnvelope;

      expect(articles.map((article) => article.slug)).toEqual([favorited.slug]);
    });

    it('combines filters with AND', async () => {
      const { token, username } = await register();
      const { token: otherToken } = await register();
      const tag = uniqueTag();

      const wanted = await createArticle(token, { tagList: [tag] });
      await createArticle(token);
      await createArticle(otherToken, { tagList: [tag] });

      const response = await request(server())
        .get('/articles')
        .query({ tag, author: username })
        .expect(200);

      const { articles } = response.body as ArticlesEnvelope;

      expect(articles.map((article) => article.slug)).toEqual([wanted.slug]);
    });

    it('pages without changing the reported total', async () => {
      const { token, username } = await register();

      await createArticle(token);
      await createArticle(token);
      const third = await createArticle(token);

      const response = await request(server())
        .get('/articles')
        .query({ author: username, limit: 1, offset: 0 })
        .expect(200);

      const page = response.body as ArticlesEnvelope;

      expect(page.articles).toHaveLength(1);
      expect(page.articles[0].slug).toBe(third.slug);
      expect(page.articlesCount).toBe(3);
    });

    it('walks pages without repeating or skipping rows', async () => {
      const { token, username } = await register();

      await createArticle(token);
      await createArticle(token);
      await createArticle(token);

      const slugAt = async (offset: number) => {
        const response = await request(server())
          .get('/articles')
          .query({ author: username, limit: 1, offset })
          .expect(200);

        return (response.body as ArticlesEnvelope).articles[0].slug;
      };

      const slugs = [await slugAt(0), await slugAt(1), await slugAt(2)];

      expect(new Set(slugs).size).toBe(3);
    });

    it('returns an empty page for an author nobody has', async () => {
      const response = await request(server())
        .get('/articles')
        .query({ author: 'nobody-at-all' })
        .expect(200);

      expect(response.body).toEqual({ articles: [], articlesCount: 0 });
    });

    it('reports the caller relationships when a token is sent', async () => {
      const { token: authorToken, username: authorName } = await register();
      const { token: readerToken } = await register();

      const article = await createArticle(authorToken);

      await follow(readerToken, authorName);
      await request(server())
        .post(`/articles/${article.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const response = await request(server())
        .get('/articles')
        .query({ author: authorName })
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const [listed] = (response.body as ArticlesEnvelope).articles;

      expect(listed.favorited).toBe(true);
      expect(listed.favoritesCount).toBe(1);
      expect(listed.author.following).toBe(true);
    });

    it('reports no relationships for an anonymous caller', async () => {
      const { token: authorToken, username: authorName } = await register();
      const { token: readerToken } = await register();

      const article = await createArticle(authorToken);

      await follow(readerToken, authorName);
      await request(server())
        .post(`/articles/${article.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const response = await request(server())
        .get('/articles')
        .query({ author: authorName })
        .expect(200);

      const [listed] = (response.body as ArticlesEnvelope).articles;

      expect(listed.favorited).toBe(false);
      expect(listed.favoritesCount).toBe(1);
      expect(listed.author.following).toBe(false);
    });

    it('rejects a non-numeric limit', async () => {
      await request(server())
        .get('/articles')
        .query({ limit: 'abc' })
        .expect(400);
    });

    it('rejects a limit above the cap', async () => {
      await request(server())
        .get('/articles')
        .query({ limit: MAX_PAGE_LIMIT + 1 })
        .expect(400);
    });

    it('rejects an unknown query parameter', async () => {
      await request(server())
        .get('/articles')
        .query({ sort: 'title' })
        .expect(400);
    });

    it('still accepts the language parameter', async () => {
      await request(server())
        .get('/articles')
        .query({ lang: 'jp' })
        .expect(200);
    });
  });

  describe('GET /articles/feed', () => {
    it('returns articles by the users you follow', async () => {
      const { token: authorToken, username: authorName } = await register();
      const { token: otherToken } = await register();
      const { token: readerToken } = await register();

      const followed = await createArticle(authorToken);
      await createArticle(otherToken);

      await follow(readerToken, authorName);

      const response = await request(server())
        .get('/articles/feed')
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const { articles } = response.body as ArticlesEnvelope;

      expect(articles.map((article) => article.slug)).toContain(followed.slug);
      expect(articles.every((article) => article.author.following)).toBe(true);
    });

    it('is empty when you follow nobody', async () => {
      const { token: authorToken } = await register();
      const { token: readerToken } = await register();

      await createArticle(authorToken);

      const response = await request(server())
        .get('/articles/feed')
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect(response.body).toEqual({ articles: [], articlesCount: 0 });
    });

    it('excludes your own articles', async () => {
      const { token, username } = await register();
      const { token: followerToken } = await register();

      const own = await createArticle(token);
      await follow(followerToken, username);

      const response = await request(server())
        .get('/articles/feed')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect(
        (response.body as ArticlesEnvelope).articles.map(
          (article) => article.slug,
        ),
      ).not.toContain(own.slug);
    });

    it('is not mistaken for an article whose slug is "feed"', async () => {
      const { token } = await register();

      await createArticle(token, { title: 'feed' });

      const response = await request(server())
        .get('/articles/feed')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('articlesCount');
    });

    it('rejects an anonymous request', async () => {
      await request(server()).get('/articles/feed').expect(401);
    });

    it('honours the page bounds', async () => {
      const { token: authorToken, username: authorName } = await register();
      const { token: readerToken } = await register();

      await createArticle(authorToken);
      await createArticle(authorToken);

      await follow(readerToken, authorName);

      const response = await request(server())
        .get('/articles/feed')
        .query({ limit: 1 })
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const page = response.body as ArticlesEnvelope;

      expect(page.articles).toHaveLength(1);
      expect(page.articlesCount).toBe(2);
    });
  });

  describe('GET /articles/:slug', () => {
    it('returns the article', async () => {
      const { token } = await register();
      const created = await createArticle(token, { tagList: ['dragons'] });

      const response = await request(server())
        .get(`/articles/${created.slug}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article).toMatchObject({
        slug: created.slug,
        tagList: ['dragons'],
      });
    });

    it('404s on an unknown slug', async () => {
      await request(server()).get('/articles/no-such-article').expect(404);
    });

    it('localises the not-found message', async () => {
      const response = await request(server())
        .get('/articles/no-such-article')
        .set('x-lang', 'jp')
        .expect(404);

      expect((response.body as { message: string }).message).toBe(
        'そのスラッグの記事は存在しません',
      );
    });

    it('reflects the caller relationships when a token is sent', async () => {
      const { token: authorToken, username: authorName } = await register();
      const { token: readerToken } = await register();

      const created = await createArticle(authorToken);
      await follow(readerToken, authorName);

      const response = await request(server())
        .get(`/articles/${created.slug}`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article.author.following).toBe(
        true,
      );
    });

    it('rejects a token that is not valid', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .get(`/articles/${created.slug}`)
        .set('Authorization', 'Token not-a-real-token')
        .expect(401);
    });
  });

  describe('PUT /articles/:slug', () => {
    it('updates only the fields that were sent', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      const response = await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: { body: 'Rewritten' } })
        .expect(200);

      const { article } = response.body as ArticleEnvelope;

      expect(article.body).toBe('Rewritten');
      expect(article.title).toBe(created.title);
      expect(article.slug).toBe(created.slug);
    });

    it('renames the slug when the title changes', async () => {
      const { token } = await register();
      const created = await createArticle(token);
      const title = `Renamed ${randomUUID().slice(0, 8)}`;

      const response = await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: { title } })
        .expect(200);

      const { article } = response.body as ArticleEnvelope;

      expect(article.slug).not.toBe(created.slug);
      expect(article.slug).toMatch(/^renamed-/);

      await request(server()).get(`/articles/${created.slug}`).expect(404);
      await request(server()).get(`/articles/${article.slug}`).expect(200);
    });

    it('moves updatedAt forward', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      const response = await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: { description: 'Now with more dragons' } })
        .expect(200);

      const { article } = response.body as ArticleEnvelope;

      expect(Date.parse(article.updatedAt)).toBeGreaterThanOrEqual(
        Date.parse(created.updatedAt),
      );
    });

    it('keeps the tags', async () => {
      const { token } = await register();
      const created = await createArticle(token, { tagList: ['dragons'] });

      const response = await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: { body: 'Rewritten' } })
        .expect(200);

      expect((response.body as ArticleEnvelope).article.tagList).toEqual([
        'dragons',
      ]);
    });

    it('treats an empty patch as a no-op rather than an error', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      const response = await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: {} })
        .expect(200);

      expect((response.body as ArticleEnvelope).article).toMatchObject({
        slug: created.slug,
        title: created.title,
        body: created.body,
      });
    });

    it('rejects a body with no article envelope', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({})
        .expect(400);
    });

    it('refuses a caller who is not the author', async () => {
      const { token } = await register();
      const { token: strangerToken } = await register();
      const created = await createArticle(token);

      await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${strangerToken}`)
        .send({ article: { body: 'Not mine' } })
        .expect(403);
    });

    it('leaves the article untouched after a refused update', async () => {
      const { token } = await register();
      const { token: strangerToken } = await register();
      const created = await createArticle(token);

      await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${strangerToken}`)
        .send({ article: { body: 'Not mine' } })
        .expect(403);

      const response = await request(server())
        .get(`/articles/${created.slug}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article.body).toBe(
        created.body,
      );
    });

    it('404s on an unknown slug', async () => {
      const { token } = await register();

      await request(server())
        .put('/articles/no-such-article')
        .set('Authorization', `Token ${token}`)
        .send({ article: { body: 'x' } })
        .expect(404);
    });

    it('rejects an anonymous request', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .put(`/articles/${created.slug}`)
        .send({ article: { body: 'x' } })
        .expect(401);
    });

    it('refuses to change the tags here', async () => {
      const { token } = await register();
      const created = await createArticle(token, { tagList: ['dragons'] });

      await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: { tagList: ['cooking'] } })
        .expect(400);
    });

    it('rejects a blank title', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .put(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .send({ article: { title: '   ' } })
        .expect(400);
    });
  });

  describe('DELETE /articles/:slug', () => {
    it('removes the article', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .delete(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .expect(204);

      await request(server()).get(`/articles/${created.slug}`).expect(404);
    });

    it('takes its tag links and favorites with it', async () => {
      const { token } = await register();
      const { token: readerToken } = await register();
      const tag = uniqueTag();

      const created = await createArticle(token, { tagList: [tag] });

      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const articles = dataSource.getRepository(Article);
      const row = await articles.findOneOrFail({
        where: { slug: created.slug },
      });

      await request(server())
        .delete(`/articles/${created.slug}`)
        .set('Authorization', `Token ${token}`)
        .expect(204);

      await expect(
        dataSource
          .getRepository(ArticleFavorite)
          .countBy({ articleId: row.id }),
      ).resolves.toBe(0);

      await expect(
        dataSource.getRepository(Tag).countBy({ name: tag }),
      ).resolves.toBe(1);
    });

    it('refuses a caller who is not the author', async () => {
      const { token } = await register();
      const { token: strangerToken } = await register();
      const created = await createArticle(token);

      await request(server())
        .delete(`/articles/${created.slug}`)
        .set('Authorization', `Token ${strangerToken}`)
        .expect(403);

      await request(server()).get(`/articles/${created.slug}`).expect(200);
    });

    it('404s on an unknown slug', async () => {
      const { token } = await register();

      await request(server())
        .delete('/articles/no-such-article')
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects an anonymous request', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server()).delete(`/articles/${created.slug}`).expect(401);
    });
  });

  describe('POST /articles/:slug/favorite', () => {
    it('marks the article and raises the count', async () => {
      const { token: authorToken } = await register();
      const { token: readerToken } = await register();

      const created = await createArticle(authorToken);

      const response = await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const { article } = response.body as ArticleEnvelope;

      expect(article.favorited).toBe(true);
      expect(article.favoritesCount).toBe(1);
    });

    it('is idempotent', async () => {
      const { token: authorToken } = await register();
      const { token: readerToken } = await register();

      const created = await createArticle(authorToken);

      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const response = await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article.favoritesCount).toBe(1);
    });

    it('counts each reader once', async () => {
      const { token: authorToken } = await register();
      const { token: firstReader } = await register();
      const { token: secondReader } = await register();

      const created = await createArticle(authorToken);

      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${firstReader}`)
        .expect(200);

      const response = await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${secondReader}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article.favoritesCount).toBe(2);
    });

    it('lets an author favorite their own article', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      const response = await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article.favorited).toBe(true);
    });

    it('404s on an unknown slug', async () => {
      const { token } = await register();

      await request(server())
        .post('/articles/no-such-article/favorite')
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects an anonymous request', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .expect(401);
    });
  });

  describe('DELETE /articles/:slug/favorite', () => {
    it('clears the mark and lowers the count', async () => {
      const { token: authorToken } = await register();
      const { token: readerToken } = await register();

      const created = await createArticle(authorToken);

      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const response = await request(server())
        .delete(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      const { article } = response.body as ArticleEnvelope;

      expect(article.favorited).toBe(false);
      expect(article.favoritesCount).toBe(0);
    });

    it('is idempotent', async () => {
      const { token: authorToken } = await register();
      const { token: readerToken } = await register();

      const created = await createArticle(authorToken);

      const response = await request(server())
        .delete(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${readerToken}`)
        .expect(200);

      expect((response.body as ArticleEnvelope).article.favoritesCount).toBe(0);
    });

    it('leaves other readers’ favorites alone', async () => {
      const { token: authorToken } = await register();
      const { token: firstReader } = await register();
      const { token: secondReader } = await register();

      const created = await createArticle(authorToken);

      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${firstReader}`)
        .expect(200);
      await request(server())
        .post(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${secondReader}`)
        .expect(200);

      const response = await request(server())
        .delete(`/articles/${created.slug}/favorite`)
        .set('Authorization', `Token ${firstReader}`)
        .expect(200);

      const { article } = response.body as ArticleEnvelope;

      expect(article.favorited).toBe(false);
      expect(article.favoritesCount).toBe(1);
    });

    it('404s on an unknown slug', async () => {
      const { token } = await register();

      await request(server())
        .delete('/articles/no-such-article/favorite')
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects an anonymous request', async () => {
      const { token } = await register();
      const created = await createArticle(token);

      await request(server())
        .delete(`/articles/${created.slug}/favorite`)
        .expect(401);
    });
  });

  describe('cascades', () => {
    it('removes a user’s articles with the user', async () => {
      const { token, username } = await register();

      const created = await createArticle(token);

      await dataSource.getRepository(User).delete({ username });

      await expect(
        dataSource.getRepository(Article).countBy({ slug: created.slug }),
      ).resolves.toBe(0);
    });
  });
});
