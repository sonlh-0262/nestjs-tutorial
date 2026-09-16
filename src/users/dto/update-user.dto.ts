import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { BIO_MAX_LENGTH, IMAGE_URL_MAX_LENGTH } from '../users.constants';
import { UserCredentialsDto } from './user-credentials.dto';

const emptyToNull = ({ value }: { value: unknown }): unknown => {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === '' ? null : trimmed;
};

export class UpdateUserBodyDto extends PartialType(UserCredentialsDto) {
  @ApiPropertyOptional({
    description: 'Send `null` or an empty string to clear it.',
    nullable: true,
    example: 'I work at statefarm',
    maxLength: BIO_MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(BIO_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(emptyToNull)
  bio?: string | null;

  @ApiPropertyOptional({
    description:
      'URL of an externally hosted avatar. Mutually exclusive with the ' +
      '`avatar` file part - send one or the other, not both. Send `null` or ' +
      'an empty string to clear it.',
    nullable: true,
    example: 'https://i.stack.imgur.com/xHWG8.jpg',
    maxLength: IMAGE_URL_MAX_LENGTH,
  })
  @IsOptional()
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MaxLength(IMAGE_URL_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(emptyToNull)
  image?: string | null;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ type: UpdateUserBodyDto })
  @IsOptional()
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => UpdateUserBodyDto)
  user?: UpdateUserBodyDto;
}
