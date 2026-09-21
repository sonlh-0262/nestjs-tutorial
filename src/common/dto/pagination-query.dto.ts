import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import {
  DEFAULT_PAGE_LIMIT,
  DEFAULT_PAGE_OFFSET,
  MAX_PAGE_LIMIT,
  MIN_PAGE_LIMIT,
  MIN_PAGE_OFFSET,
} from '../constants/pagination';
import { LangQueryDto } from './lang-query.dto';

export class PaginationQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    description: `How many rows to return (max ${MAX_PAGE_LIMIT}).`,
    minimum: MIN_PAGE_LIMIT,
    maximum: MAX_PAGE_LIMIT,
    default: DEFAULT_PAGE_LIMIT,
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.IS_INT') })
  @Min(MIN_PAGE_LIMIT, { message: i18nValidationMessage('validation.MIN') })
  @Max(MAX_PAGE_LIMIT, { message: i18nValidationMessage('validation.MAX') })
  limit?: number;

  @ApiPropertyOptional({
    description: 'How many rows to skip.',
    minimum: MIN_PAGE_OFFSET,
    default: DEFAULT_PAGE_OFFSET,
  })
  @IsOptional()
  @IsInt({ message: i18nValidationMessage('validation.IS_INT') })
  @Min(MIN_PAGE_OFFSET, { message: i18nValidationMessage('validation.MIN') })
  offset?: number;
}
