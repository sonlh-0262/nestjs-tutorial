import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { Article } from '../../articles/entities/article.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
@Index('IDX_comments_article_id_created_at', ['articleId', 'createdAt'])
@Index('IDX_comments_author_id', ['authorId'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'article_id', type: 'uuid' })
  articleId: string;

  @ManyToOne(() => Article, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'article_id',
    foreignKeyConstraintName: 'FK_comments_article',
  })
  article: Article;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'FK_comments_author',
  })
  author: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
