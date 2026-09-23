import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { SLUG_PARAM } from '../articles/articles.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { COMMENT_ID_PARAM } from './comments.constants';
import { CommentsService } from './comments.service';
import { CommentResponseDto, CommentsResponseDto } from './dto/comment.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('Comments')
@Controller('articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Add a comment to an article',
    description:
      'Anyone signed in may comment, including on their own article. ' +
      'Comments cannot be edited - delete and post again instead.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiCreatedResponse({ type: CommentResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  create(
    @Param('slug') slug: string,
    @CurrentUser() author: User,
    @Body() dto: CreateCommentDto,
  ): Promise<CommentResponseDto> {
    return this.commentsService.create(slug, author, dto.comment);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Get the comments on an article',
    description:
      'Oldest first, so a page reads in the order the thread was written. ' +
      'Authentication is optional and only affects `author.following`.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: CommentsResponseDto })
  @ApiUnauthorizedResponse({
    description: 'A token was sent, but it is invalid or revoked.',
  })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  @ApiBadRequestResponse({ description: 'A page bound is invalid.' })
  list(
    @Param('slug') slug: string,
    @Query() query: PaginationQueryDto,
    @OptionalCurrentUser() viewer?: User,
  ): Promise<CommentsResponseDto> {
    return this.commentsService.list(slug, query, viewer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Delete a comment',
    description:
      'Comment author only. The comment must belong to the article in the ' +
      'path, so a valid id under the wrong slug is a 404 rather than a ' +
      'cross-article delete.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiParam(COMMENT_ID_PARAM)
  @ApiNoContentResponse({ description: 'The comment is gone.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiForbiddenResponse({ description: 'You are not the comment author.' })
  @ApiNotFoundResponse({
    description: 'No article with that slug, or no such comment on it.',
  })
  remove(
    @Param('slug') slug: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() author: User,
  ): Promise<void> {
    return this.commentsService.remove(slug, id, author);
  }
}
