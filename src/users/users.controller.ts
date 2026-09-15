import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { toUserResponse, UserResponseDto } from './dto/user.dto';
import { User } from './entities/user.entity';

@ApiTags('User')
@Controller('user')
export class UsersController {
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
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
}
