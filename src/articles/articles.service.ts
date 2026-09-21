import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { pageBounds } from '../common/page-bounds';
import { isUniqueViolation } from '../database/is-unique-violation';
import { UserFollow } from '../users/entities/user-follow.entity';
import { User } from '../users/entities/user.entity';
import { ArticleViewService } from './article-view.service';
import { SLUG_ATTEMPT_LIMIT } from './articles.constants';
import { ArticleResponseDto, ArticlesResponseDto } from './dto/article.dto';
import { CreateArticleBodyDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { UpdateArticleBodyDto } from './dto/update-article.dto';
import { ArticleFavorite } from './entities/article-favorite.entity';
import { Article } from './entities/article.entity';
import { FavoritesService } from './favorites.service';
import { slugCandidate } from './slug';
import { TagsService } from './tags.service';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    @InjectRepository(Article)
    private readonly articlesRepository: Repository<Article>,
    private readonly tagsService: TagsService,
    private readonly favoritesService: FavoritesService,
    private readonly view: ArticleViewService,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async create(
    author: User,
    input: CreateArticleBodyDto,
  ): Promise<ArticleResponseDto> {
    const article = await this.withUniqueSlug(input.title, (slug) =>
      this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(Article);

        const saved = await repository.save(
          repository.create({
            slug,
            title: input.title,
            description: input.description,
            body: input.body,
            authorId: author.id,
            tags: await this.tagsService.resolve(input.tagList ?? [], manager),
          }),
        );

        saved.author = author;

        return saved;
      }),
    );

    this.logger.log(`Created article ${article.slug} by ${author.username}`);

    return this.view.one(article, author);
  }

  async list(
    query: ListArticlesQueryDto,
    viewer?: User,
  ): Promise<ArticlesResponseDto> {
    const builder = this.baseQuery();

    if (query.tag) {
      builder.innerJoin('article.tags', 'filterTag', 'filterTag.name = :tag', {
        tag: query.tag,
      });
    }

    if (query.author) {
      builder.andWhere('author.username = :author', { author: query.author });
    }

    if (query.favorited) {
      builder
        .innerJoin(
          ArticleFavorite,
          'filterFavorite',
          'filterFavorite.articleId = article.id',
        )
        .innerJoin(
          User,
          'filterFavoriter',
          'filterFavoriter.id = filterFavorite.userId AND filterFavoriter.username = :favorited',
          { favorited: query.favorited },
        );
    }

    return this.paginate(builder, query, viewer);
  }

  async feed(
    query: PaginationQueryDto,
    viewer: User,
  ): Promise<ArticlesResponseDto> {
    const builder = this.baseQuery().innerJoin(
      UserFollow,
      'feedFollow',
      'feedFollow.followingId = article.authorId AND feedFollow.followerId = :viewerId',
      { viewerId: viewer.id },
    );

    return this.paginate(builder, query, viewer);
  }

  async getBySlug(slug: string, viewer?: User): Promise<ArticleResponseDto> {
    return this.view.one(await this.findBySlugOrFail(slug), viewer);
  }

  async findBySlugOrFail(slug: string): Promise<Article> {
    const article = await this.articlesRepository.findOne({
      where: { slug },
      relations: { author: true, tags: true },
    });

    if (!article) {
      throw new NotFoundException(this.i18n.t('article.NOT_FOUND'));
    }

    return article;
  }

  async update(
    slug: string,
    author: User,
    input: UpdateArticleBodyDto,
  ): Promise<ArticleResponseDto> {
    const article = await this.findBySlugOrFail(slug);

    this.assertAuthor(article, author);

    const changes: Partial<Article> = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.body !== undefined ? { body: input.body } : {}),
    };

    if (Object.keys(changes).length === 0) {
      return this.view.one(article, author);
    }

    const updated =
      input.title !== undefined && input.title !== article.title
        ? await this.withUniqueSlug(input.title, (nextSlug) =>
            this.persist(article, { ...changes, slug: nextSlug }),
          )
        : await this.persist(article, changes);

    this.logger.log(`Updated article ${updated.slug}`);

    return this.view.one(updated, author);
  }

  async remove(slug: string, author: User): Promise<void> {
    const article = await this.findBySlugOrFail(slug);

    this.assertAuthor(article, author);

    await this.articlesRepository.delete({ id: article.id });

    this.logger.log(`Deleted article ${slug}`);
  }

  async favorite(slug: string, viewer: User): Promise<ArticleResponseDto> {
    const article = await this.findBySlugOrFail(slug);

    await this.favoritesService.favorite(viewer.id, article.id);

    return this.view.one(article, viewer);
  }

  async unfavorite(slug: string, viewer: User): Promise<ArticleResponseDto> {
    const article = await this.findBySlugOrFail(slug);

    await this.favoritesService.unfavorite(viewer.id, article.id);

    return this.view.one(article, viewer);
  }

  private baseQuery(): SelectQueryBuilder<Article> {
    return this.articlesRepository
      .createQueryBuilder('article')
      .innerJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.tags', 'tag')
      .orderBy('article.createdAt', 'DESC')
      .addOrderBy('article.id', 'DESC');
  }

  private async paginate(
    builder: SelectQueryBuilder<Article>,
    pagination: PaginationQueryDto,
    viewer?: User,
  ): Promise<ArticlesResponseDto> {
    const { take, skip } = pageBounds(pagination);

    const [articles, total] = await builder
      .take(take)
      .skip(skip)
      .getManyAndCount();

    return this.view.page(articles, total, viewer);
  }

  private assertAuthor(article: Article, user: User): void {
    if (article.authorId !== user.id) {
      throw new ForbiddenException(this.i18n.t('article.FORBIDDEN'));
    }
  }

  private async withUniqueSlug(
    title: string,
    write: (slug: string) => Promise<Article>,
  ): Promise<Article> {
    for (let attempt = 0; attempt < SLUG_ATTEMPT_LIMIT; attempt += 1) {
      try {
        return await write(slugCandidate(title, attempt));
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException(this.i18n.t('article.SLUG_CONFLICT'));
  }

  private async persist(
    article: Article,
    changes: Partial<Article>,
  ): Promise<Article> {
    await this.articlesRepository.update({ id: article.id }, changes);

    return this.findBySlugOrFail(changes.slug ?? article.slug);
  }
}
