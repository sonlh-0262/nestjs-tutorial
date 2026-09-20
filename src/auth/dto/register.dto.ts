import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, ValidateNested } from 'class-validator';
import { i18nValidationMessage } from 'nestjs-i18n';

import { UserCredentialsDto } from '../../users/dto/user-credentials.dto';

export class RegisterUserBodyDto extends UserCredentialsDto {}

export class RegisterUserDto {
  @ApiProperty({ type: RegisterUserBodyDto })
  @IsObject({ message: i18nValidationMessage('validation.IS_OBJECT') })
  @ValidateNested()
  @Type(() => RegisterUserBodyDto)
  user: RegisterUserBodyDto;
}
