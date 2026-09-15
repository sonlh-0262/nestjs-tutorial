import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { LangQueryDto } from '../common/dto/lang-query.dto';

export class HelloQueryDto extends LangQueryDto {
  @ApiPropertyOptional({
    description: 'Optional name to greet.',
    example: 'Son',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MinLength(1, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(50, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  name?: string;
}
