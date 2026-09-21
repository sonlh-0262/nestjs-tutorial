import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  MAX_TAGS_PER_ARTICLE,
  TAG_MAX_LENGTH,
  TAG_MIN_LENGTH,
} from '../articles.constants';
import { ArticleContentDto } from './article-content.dto';

export class CreateArticleBodyDto extends ArticleContentDto {
  @ApiPropertyOptional({
    type: [String],
    description:
      'Tags are lower-cased, trimmed and de-duplicated before they are ' +
      'stored, so `Dragons` and ` dragons ` end up as the same tag.',
    example: ['dragons', 'training'],
    maxItems: MAX_TAGS_PER_ARTICLE,
  })
  @IsOptional()
  @IsArray({ message: i18nValidationMessage('validation.IS_ARRAY') })
  @ArrayMaxSize(MAX_TAGS_PER_ARTICLE, {
    message: i18nValidationMessage('validation.ARRAY_MAX_SIZE'),
  })
  @IsString({
    each: true,
    message: i18nValidationMessage('validation.IS_STRING'),
  })
  @MinLength(TAG_MIN_LENGTH, {
    each: true,
    message: i18nValidationMessage('validation.MIN_LENGTH'),
  })
  @MaxLength(TAG_MAX_LENGTH, {
    each: true,
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  tagList?: string[];
}

export class CreateArticleDto {
  @ApiProperty({ type: CreateArticleBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => CreateArticleBodyDto)
  article: CreateArticleBodyDto;
}
