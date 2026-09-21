import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { trim } from '../../common/transforms/trim';
import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants';

export class CreateCommentBodyDto {
  @ApiProperty({
    example: 'His name was my name too.',
    maxLength: COMMENT_BODY_MAX_LENGTH,
  })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @MaxLength(COMMENT_BODY_MAX_LENGTH, {
    message: i18nValidationMessage('validation.MAX_LENGTH'),
  })
  @Transform(trim)
  body: string;
}

export class CreateCommentDto {
  @ApiProperty({ type: CreateCommentBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => CreateCommentBodyDto)
  comment: CreateCommentBodyDto;
}
