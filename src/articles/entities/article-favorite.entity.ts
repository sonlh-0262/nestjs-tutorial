import {
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import { Article } from './article.entity';

@Entity('article_favorites')
@Index('IDX_article_favorites_article_id', ['articleId'])
export class ArticleFavorite {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @PrimaryColumn({ name: 'article_id', type: 'uuid' })
  articleId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'FK_article_favorites_user',
  })
  user: User;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'article_id',
    foreignKeyConstraintName: 'FK_article_favorites_article',
  })
  article: Article;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
