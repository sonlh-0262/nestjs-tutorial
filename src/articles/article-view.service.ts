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

@Injectable()
export class ArticleViewService {
  constructor(
    private readonly favoritesService: FavoritesService,
    private readonly followsService: FollowsService,
  ) {}

  async toArticleResponse(
    article: Article,
    viewer?: User,
  ): Promise<ArticleResponseDto> {
    const [dto] = await this.toDtosWithViewerFlags([article], viewer);

    return { article: dto };
  }

  async toArticlesResponse(
    articles: Article[],
    articlesCount: number,
    viewer?: User,
  ): Promise<ArticlesResponseDto> {
    return {
      articles: await this.toDtosWithViewerFlags(articles, viewer),
      articlesCount,
    };
  }

  private async toDtosWithViewerFlags(
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
      this.favoritesService.favoritedBy(viewer?.id, articleIds),
      this.followsService.followingAmong(viewer?.id, authorIds),
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
