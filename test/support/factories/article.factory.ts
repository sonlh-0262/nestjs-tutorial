import { DeepPartial, Repository } from 'typeorm';

import { Article } from '../../../src/articles/entities/article.entity';
import { User } from '../../../src/users/entities/user.entity';
import { nextSequence } from './sequence';

export class ArticleFactory {
  constructor(private readonly articles: Repository<Article>) {}

  /**
   * `author` is a parameter rather than an override because `articles.author_id`
   * is `NOT NULL` with a foreign key: there is no useful default, and a factory
   * that made one up would fail inside Postgres instead of at the call site.
   */
  create(author: User, overrides: DeepPartial<Article> = {}): Promise<Article> {
    const sequence = nextSequence();

    return this.articles.save(
      this.articles.create({
        slug: `article-${sequence}`,
        title: `Article ${sequence}`,
        description: `Description ${sequence}`,
        body: `Body ${sequence}`,
        authorId: author.id,
        ...overrides,
      }),
    );
  }
}
