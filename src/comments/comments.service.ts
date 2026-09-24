import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { ArticlesService } from '../articles/articles.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { pageBounds } from '../common/page-bounds';
import { User } from '../users/entities/user.entity';
import { CommentViewService } from './comment-view.service';
import { CommentResponseDto, CommentsResponseDto } from './dto/comment.dto';
import { CreateCommentBodyDto } from './dto/create-comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentsService {
  private readonly logger = new Logger(CommentsService.name);

  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly articlesService: ArticlesService,
    private readonly view: CommentViewService,
    private readonly i18n: I18nService,
  ) {}

  async create(
    slug: string,
    author: User,
    input: CreateCommentBodyDto,
  ): Promise<CommentResponseDto> {
    const articleId = await this.articlesService.findIdBySlugOrFail(slug);

    const comment = await this.commentsRepository.save(
      this.commentsRepository.create({
        body: input.body,
        articleId,
        authorId: author.id,
      }),
    );

    comment.author = author;

    this.logger.log(
      `Created comment ${comment.id} on ${slug} by ${author.username}`,
    );

    return this.view.toCommentResponse(comment, author);
  }

  async list(
    slug: string,
    query: PaginationQueryDto,
    viewer?: User,
  ): Promise<CommentsResponseDto> {
    const articleId = await this.articlesService.findIdBySlugOrFail(slug);

    const [comments, total] = await this.commentsRepository.findAndCount({
      where: { articleId },
      relations: { author: true },
      select: {
        id: true,
        body: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        author: { id: true, username: true, bio: true, image: true },
      },
      order: { createdAt: 'ASC', id: 'ASC' },
      ...pageBounds(query),
    });

    return this.view.toCommentsResponse(comments, total, viewer);
  }

  async remove(slug: string, id: string, author: User): Promise<void> {
    const articleId = await this.articlesService.findIdBySlugOrFail(slug);
    const comment = await this.findOrFail(articleId, id);

    this.assertAuthor(comment, author);

    await this.commentsRepository.delete({ id: comment.id });

    this.logger.log(`Deleted comment ${id} on ${slug}`);
  }

  private async findOrFail(articleId: string, id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id, articleId },
      select: { id: true, authorId: true },
    });

    if (!comment) {
      throw new NotFoundException(this.i18n.t('comment.NOT_FOUND'));
    }

    return comment;
  }

  private assertAuthor(comment: Comment, user: User): void {
    if (comment.authorId !== user.id) {
      throw new ForbiddenException(this.i18n.t('comment.FORBIDDEN'));
    }
  }
}
