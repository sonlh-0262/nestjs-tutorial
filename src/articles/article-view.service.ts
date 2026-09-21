import { Injectable } from '@nestjs/common';

import { User } from '../users/entities/user.entity';
import { FollowsService } from '../users/follows.service';
import {
  ArticleDto,
  ArticleResponseDto,
  ArticlesResponseDto,
  toArticleDto,
} from './dto/article.dto';
import { Article } from './entities/article.entity';
import { FavoritesService } from './favorites.service';

const NO_MATCHES: ReadonlySet<string> = new Set<string>();

@Injectable()
export class ArticleViewService {
  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly followsService: FollowsService,
  ) {}

  async one(article: Article, viewer?: User): Promise<ArticleResponseDto> {
    const [dto] = await this.render([article], viewer);

    return { article: dto };
  }

  async page(
    articles: Article[],
    articlesCount: number,
    viewer?: User,
  ): Promise<ArticlesResponseDto> {
    return { articles: await this.render(articles, viewer), articlesCount };
  }

  private async render(
    articles: Article[],
    viewer?: User,
  ): Promise<ArticleDto[]> {
    if (articles.length === 0) {
      return [];
    }

    const articleIds = articles.map((article) => article.id);
    const authorIds = [...new Set(articles.map((article) => article.authorId))];

    const [favoritesCounts, favorited, following] = await Promise.all([
      this.favoritesService.countsFor(articleIds),
      viewer
        ? this.favoritesService.favoritedBy(viewer.id, articleIds)
        : NO_MATCHES,
      viewer
        ? this.followsService.followingAmong(viewer.id, authorIds)
        : NO_MATCHES,
    ]);

    return articles.map((article) =>
      toArticleDto(article, {
        favorited: favorited.has(article.id),
        favoritesCount: favoritesCounts.get(article.id) ?? 0,
        following: following.has(article.authorId),
      }),
    );
  }
}
