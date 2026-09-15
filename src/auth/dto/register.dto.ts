import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class RegisterUserBodyDto {
  @ApiProperty({ example: 'jake', minLength: 3, maxLength: 50 })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @IsNotEmpty({ message: i18nValidationMessage('validation.NOT_EMPTY') })
  @MinLength(3, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(50, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Matches(USERNAME_PATTERN, {
    message: i18nValidationMessage('validation.USERNAME_FORMAT'),
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  username: string;

  @ApiProperty({ example: 'jake@jake.jake', format: 'email' })
  @IsEmail({}, { message: i18nValidationMessage('validation.IS_EMAIL') })
  @MaxLength(255, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({ example: 'Sup3rS3cret!', minLength: 8, maxLength: 72 })
  @IsString({ message: i18nValidationMessage('validation.IS_STRING') })
  @MinLength(8, { message: i18nValidationMessage('validation.MIN_LENGTH') })
  @MaxLength(72, { message: i18nValidationMessage('validation.MAX_LENGTH') })
  password: string;
}

export class RegisterUserDto {
  @ApiProperty({ type: RegisterUserBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => RegisterUserBodyDto)
  user: RegisterUserBodyDto;
}
