import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { SUPPORTED_LANGUAGES } from '../constants/languages';

const LANGUAGES = SUPPORTED_LANGUAGES.join(' / ');

/**
 * Base class for any DTO bound with `@Query()`.
 *
 * The global validation pipe runs with `forbidNonWhitelisted`, so the query
 * parameters that `nestjs-i18n`'s `QueryResolver` reads (`lang` / `l`) have to
 * be declared explicitly, otherwise `GET /?lang=jp` would be rejected as an
 * unknown parameter.
 *
 * The `enum` below documents the supported values for Swagger only - these are
 * deliberately validated as plain strings, so an unsupported language falls
 * back to the default instead of failing the request.
 */
export class LangQueryDto {
  @ApiPropertyOptional({
    description: `Response language (${LANGUAGES}).`,
    enum: SUPPORTED_LANGUAGES,
    example: 'jp',
  })
  @IsOptional()
  @IsString()
  lang?: string;

  /** Short alias for `lang`. */
  @ApiPropertyOptional({
    description: 'Short alias for `lang`.',
    enum: SUPPORTED_LANGUAGES,
    example: 'jp',
  })
  @IsOptional()
  @IsString()
  l?: string;
}
