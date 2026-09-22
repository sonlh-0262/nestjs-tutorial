import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Article } from '../../../src/articles/entities/article.entity';
import { AuthService } from '../../../src/auth/auth.service';
import { Comment } from '../../../src/comments/entities/comment.entity';
import { UserFollow } from '../../../src/users/entities/user-follow.entity';
import { User } from '../../../src/users/entities/user.entity';
import { PasswordService } from '../../../src/users/password.service';
import { ArticleFactory } from './article.factory';
import { CommentFactory } from './comment.factory';
import { FollowFactory } from './follow.factory';
import { UserFactory } from './user.factory';

/**
 * The seeded fake data a spec file builds its arrangements from, in one object
 * so a test reads `factories.comments.createThread(...)` rather than carrying
 * four repositories and two services around.
 *
 * Repositories come from the running `DataSource` rather than from
 * `getRepositoryToken()`, so a factory works for any entity in the schema
 * whether or not some module happens to have registered it with
 * `TypeOrmModule.forFeature`.
 */
export class Factories {
  readonly users: UserFactory;
  readonly articles: ArticleFactory;
  readonly comments: CommentFactory;
  readonly follows: FollowFactory;

  constructor(app: INestApplication) {
    const dataSource = app.get(DataSource);

    this.users = new UserFactory(
      dataSource.getRepository(User),
      app.get(PasswordService),
      app.get(AuthService),
    );
    this.articles = new ArticleFactory(dataSource.getRepository(Article));
    this.comments = new CommentFactory(dataSource.getRepository(Comment));
    this.follows = new FollowFactory(dataSource.getRepository(UserFollow));
  }
}
