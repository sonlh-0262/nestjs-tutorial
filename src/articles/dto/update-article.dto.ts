import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { ArticleContentDto } from './article-content.dto';

export class UpdateArticleBodyDto extends PartialType(ArticleContentDto) {}

export class UpdateArticleDto {
  @ApiProperty({ type: UpdateArticleBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => UpdateArticleBodyDto)
  article: UpdateArticleBodyDto;
}
