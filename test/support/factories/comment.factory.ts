import { DeepPartial, Repository } from 'typeorm';

import { Article } from '../../../src/articles/entities/article.entity';
import { Comment } from '../../../src/comments/entities/comment.entity';
import { User } from '../../../src/users/entities/user.entity';
import { backdate } from '../test-database';
import { SEEDED_ROW_INTERVAL_MS } from '../test.constants';
import { nextSequence } from './sequence';

export class CommentFactory {
  constructor(private readonly comments: Repository<Comment>) {}

  create(
    article: Article,
    author: User,
    overrides: DeepPartial<Comment> = {},
  ): Promise<Comment> {
    return this.comments.save(
      this.comments.create({
        body: `Comment ${nextSequence()}`,
        articleId: article.id,
        authorId: author.id,
        ...overrides,
      }),
    );
  }

  /**
   * `count` comments a second apart, oldest first.
   *
   * `GET /articles/:slug/comments` orders by `created_at` and breaks ties on
   * `id`, which is a random uuid. Inserted at full speed the rows share a
   * timestamp and come back in an order no assertion can predict, so every
   * ordering and pagination test here would be flaky. Spacing the timestamps is
   * something only a factory writing rows directly can do - the endpoint always
   * stamps `now()`.
   */
  async createThread(
    article: Article,
    author: User,
    count: number,
  ): Promise<Comment[]> {
    const oldest = Date.now() - count * SEEDED_ROW_INTERVAL_MS;
    const thread: Comment[] = [];

    for (let index = 0; index < count; index += 1) {
      const comment = await this.create(article, author);
      const createdAt = new Date(oldest + index * SEEDED_ROW_INTERVAL_MS);

      await backdate(this.comments, comment.id, createdAt);

      comment.createdAt = createdAt;
      comment.updatedAt = createdAt;
      thread.push(comment);
    }

    return thread;
  }
}
