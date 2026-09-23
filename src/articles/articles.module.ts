import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UsersModule } from '../users/users.module';
import { ArticleViewService } from './article-view.service';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Article } from './entities/article.entity';
import { Tag } from './entities/tag.entity';
import { FavoritesService } from './favorites.service';
import { TagsService } from './tags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, ArticleFavorite, Tag]),
    UsersModule,
  ],
  controllers: [ArticlesController],
  providers: [
    ArticlesService,
    ArticleViewService,
    FavoritesService,
    TagsService,
  ],
  exports: [ArticlesService],
})
export class ArticlesModule {}
