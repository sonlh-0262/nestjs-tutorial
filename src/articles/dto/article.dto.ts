import { ApiProperty } from '@nestjs/swagger';

import { ProfileDto, toProfileDto } from '../../profiles/dto/profile.dto';
import { Article } from '../entities/article.entity';
import { ArticleViewFlags } from '../interfaces/article-view-flags.interface';

export class ArticleDto {
  @ApiProperty({ example: 'how-to-train-your-dragon' })
  slug: string;

  @ApiProperty({ example: 'How to train your dragon' })
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  description: string;

  @ApiProperty({ example: 'It takes a Jacobian' })
  body: string;

  @ApiProperty({ type: [String], example: ['dragons', 'training'] })
  tagList: string[];

  @ApiProperty({ format: 'date-time', example: '2026-09-18T08:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-18T08:30:00.000Z' })
  updatedAt: string;

  @ApiProperty({
    description: 'Whether the caller favorited it. `false` when anonymous.',
    example: false,
  })
  favorited: boolean;

  @ApiProperty({ example: 0 })
  favoritesCount: number;

  @ApiProperty({ type: ProfileDto })
  author: ProfileDto;
}

export class ArticleResponseDto {
  @ApiProperty({ type: ArticleDto })
  article: ArticleDto;
}

export class ArticlesResponseDto {
  @ApiProperty({ type: [ArticleDto] })
  articles: ArticleDto[];

  @ApiProperty({
    description:
      'Total number of rows matching the filters, ignoring `limit` and ' +
      '`offset` - use it to size a pager.',
    example: 2,
  })
  articlesCount: number;
}

export function toArticleDto(
  article: Article,
  flags: ArticleViewFlags,
): ArticleDto {
  return {
    slug: article.slug,
    title: article.title,
    description: article.description,
    body: article.body,
    tagList: (article.tags ?? []).map((tag) => tag.name).sort(),
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    favorited: flags.favorited,
    favoritesCount: flags.favoritesCount,
    author: toProfileDto(article.author, flags.following),
  };
}
