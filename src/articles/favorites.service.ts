import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { ArticleFavorite } from './entities/article-favorite.entity';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectRepository(ArticleFavorite)
    private readonly favoritesRepository: Repository<ArticleFavorite>,
  ) {}

  async favorite(userId: string, articleId: string): Promise<void> {
    await this.favoritesRepository
      .createQueryBuilder()
      .insert()
      .into(ArticleFavorite)
      .values({ userId, articleId })
      .orIgnore()
      .execute();

    this.logger.log(`${userId} favorited ${articleId}`);
  }

  async unfavorite(userId: string, articleId: string): Promise<void> {
    await this.favoritesRepository.delete({ userId, articleId });

    this.logger.log(`${userId} unfavorited ${articleId}`);
  }

  async countsFor(articleIds: string[]): Promise<Map<string, number>> {
    if (articleIds.length === 0) {
      return new Map();
    }

    const rows = await this.favoritesRepository
      .createQueryBuilder('favorite')
      .select('favorite.articleId', 'articleId')
      .addSelect('COUNT(*)', 'count')
      .where('favorite.articleId IN (:...articleIds)', { articleIds })
      .groupBy('favorite.articleId')
      .getRawMany<{ articleId: string; count: string }>();

    return new Map(rows.map((row) => [row.articleId, Number(row.count)]));
  }

  async favoritedBy(
    userId: string,
    articleIds: string[],
  ): Promise<Set<string>> {
    if (articleIds.length === 0) {
      return new Set();
    }

    const rows = await this.favoritesRepository.find({
      where: { userId, articleId: In(articleIds) },
      select: { articleId: true },
    });

    return new Set(rows.map((row) => row.articleId));
  }
}
