import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { trim, trimLower } from '../../common/transforms/trim';
import { USERNAME_MAX_LENGTH } from '../../users/users.constants';
import { TAG_MAX_LENGTH } from '../articles.constants';

export class ListArticlesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Only articles carrying this tag.',
    example: 'dragons',
    maxLength: TAG_MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(TAG_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(trimLower)
  tag?: string;

  @ApiPropertyOptional({
    description: 'Only articles written by this username.',
    example: 'jake',
    maxLength: USERNAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(USERNAME_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(trim)
  author?: string;

  @ApiPropertyOptional({
    description: 'Only articles this username has favorited.',
    example: 'jake',
    maxLength: USERNAME_MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(USERNAME_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(trim)
  favorited?: string;
}
