import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
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

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { User } from '../users/entities/user.entity';
import { ArticlesService } from './articles.service';
import { ArticleResponseDto, ArticlesResponseDto } from './dto/article.dto';
import { CreateArticleDto } from './dto/create-article.dto';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

const SLUG_PARAM = { name: 'slug', example: 'how-to-train-your-dragon' };

@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Create article',
    description:
      'The slug is derived from the title. When that slug is already taken, ' +
      'a short random discriminator is appended rather than the request being ' +
      'rejected.',
  })
  @ApiCreatedResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  create(
    @CurrentUser() author: User,
    @Body() dto: CreateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.create(author, dto.article);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'List articles',
    description:
      'Newest first. Authentication is optional: send a token to have ' +
      '`favorited` and `author.following` reflect your own relationships. ' +
      'Filtering by a username nobody has returns an empty page, not a 404.',
  })
  @ApiOkResponse({ type: ArticlesResponseDto })
  @ApiUnauthorizedResponse({
    description: 'A token was sent, but it is invalid or revoked.',
  })
  @ApiBadRequestResponse({ description: 'A filter or page bound is invalid.' })
  list(
    @Query() query: ListArticlesQueryDto,
    @OptionalCurrentUser() viewer?: User,
  ): Promise<ArticlesResponseDto> {
    return this.articlesService.list(query, viewer);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Feed articles',
    description:
      'Articles by the users you follow, newest first. Following nobody ' +
      'gives an empty page.',
  })
  @ApiOkResponse({ type: ArticlesResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiBadRequestResponse({ description: 'A page bound is invalid.' })
  feed(
    @Query() query: PaginationQueryDto,
    @CurrentUser() viewer: User,
  ): Promise<ArticlesResponseDto> {
    return this.articlesService.feed(query, viewer);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Get article',
    description:
      'Authentication is optional and only affects `favorited` and ' +
      '`author.following`.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({
    description: 'A token was sent, but it is invalid or revoked.',
  })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  get(
    @Param('slug') slug: string,
    @OptionalCurrentUser() viewer?: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.getBySlug(slug, viewer);
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Update article',
    description:
      'Partial update of the article text, author only. Changing the title ' +
      'also changes the slug, so use the slug in the response from then on. ' +
      'Tags are fixed at creation time and cannot be changed here.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiForbiddenResponse({ description: 'You are not the author.' })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  @ApiBadRequestResponse({ description: 'Validation failed.' })
  update(
    @Param('slug') slug: string,
    @CurrentUser() author: User,
    @Body() dto: UpdateArticleDto,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.update(slug, author, dto.article);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Delete article',
    description:
      'Author only. Its tag links and favorites go with it; the tags ' +
      'themselves stay, since other articles may still use them.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiNoContentResponse({ description: 'The article is gone.' })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiForbiddenResponse({ description: 'You are not the author.' })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  remove(
    @Param('slug') slug: string,
    @CurrentUser() author: User,
  ): Promise<void> {
    return this.articlesService.remove(slug, author);
  }

  @Post(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Favorite article',
    description:
      'Idempotent - favoriting something you already favorited succeeds and ' +
      'leaves the count alone. Favoriting your own article is allowed.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  favorite(
    @Param('slug') slug: string,
    @CurrentUser() viewer: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.favorite(slug, viewer);
  }

  @Delete(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Unfavorite article',
    description:
      'Idempotent - unfavoriting something you never favorited succeeds and ' +
      'changes nothing.',
  })
  @ApiParam(SLUG_PARAM)
  @ApiOkResponse({ type: ArticleResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiNotFoundResponse({ description: 'No article with that slug.' })
  unfavorite(
    @Param('slug') slug: string,
    @CurrentUser() viewer: User,
  ): Promise<ArticleResponseDto> {
    return this.articlesService.unfavorite(slug, viewer);
  }
}
