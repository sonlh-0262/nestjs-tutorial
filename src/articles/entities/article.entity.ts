import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { User } from '../../users/entities/user.entity';
import {
  DESCRIPTION_MAX_LENGTH,
  SLUG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '../articles.constants';
import { Tag } from './tag.entity';

@Entity('articles')
@Index('IDX_articles_author_id', ['authorId'])
@Index('IDX_articles_created_at', ['createdAt'])
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_articles_slug', { unique: true })
  @Column({ type: 'varchar', length: SLUG_MAX_LENGTH })
  slug: string;

  @Column({ type: 'varchar', length: TITLE_MAX_LENGTH })
  title: string;

  @Column({ type: 'varchar', length: DESCRIPTION_MAX_LENGTH })
  description: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'author_id',
    foreignKeyConstraintName: 'FK_articles_author',
  })
  author: User;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'article_tags',
    joinColumn: {
      name: 'article_id',
      foreignKeyConstraintName: 'FK_article_tags_article',
    },
    inverseJoinColumn: {
      name: 'tag_id',
      foreignKeyConstraintName: 'FK_article_tags_tag',
    },
  })
  tags: Tag[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
