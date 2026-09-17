import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

import { SUPPORTED_IMAGE_MIME_TYPES } from '../attachments/storage/image-type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { toUserResponse, UserResponseDto } from './dto/user.dto';
import { UpdateUserBodyDto, UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

const AVATAR_FIELD = 'avatar';

@ApiTags('User')
@ApiExtraModels(UpdateUserDto)
@Controller('user')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly i18n: I18nService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Get current user',
    description:
      'Returns the user the access token belongs to. No token is returned: ' +
      'the caller already holds the one they authenticated with.',
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  getCurrentUser(@CurrentUser() user: User): UserResponseDto {
    return toUserResponse(user);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor(AVATAR_FIELD))
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiOperation({
    summary: 'Update current user',
    description:
      'Partial update - only the fields present are changed. To upload an ' +
      'avatar, send `multipart/form-data` with the file under `avatar` and ' +
      'any other fields as `user[bio]`, `user[username]` and so on; multer ' +
      'reassembles that bracket notation into the same `user` envelope the ' +
      'JSON body uses. The stored avatar is exposed as ' +
      '`/attachments/<uuid>`, which requires a token to download.',
  })
  @ApiBody({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(UpdateUserDto) },
        {
          type: 'object',
          properties: {
            'user[username]': { type: 'string' },
            'user[email]': { type: 'string', format: 'email' },
            'user[password]': { type: 'string', format: 'password' },
            'user[bio]': { type: 'string' },
            'user[image]': { type: 'string' },
            [AVATAR_FIELD]: {
              type: 'string',
              format: 'binary',
              description: `Image file (${SUPPORTED_IMAGE_MIME_TYPES.join(', ')}).`,
            },
          },
        },
      ],
    },
  })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiConflictResponse({
    description: 'The email or username belongs to another account.',
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'The uploaded file is not one of the supported image types.',
  })
  @ApiPayloadTooLargeResponse({ description: 'The uploaded file is too big.' })
  async update(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
    @UploadedFile() avatar?: Express.Multer.File,
  ): Promise<UserResponseDto> {
    const input: UpdateUserBodyDto = dto.user ?? {};

    if (avatar && input.image !== undefined) {
      throw new BadRequestException(this.i18n.t('attachment.IMAGE_CONFLICT'));
    }

    return toUserResponse(await this.usersService.update(user, input, avatar));
  }
}
