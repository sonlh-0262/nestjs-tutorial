import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  CurrentUser,
  OptionalCurrentUser,
} from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { ProfileResponseDto } from './dto/profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get profile',
    description:
      'The public view of a user. Authentication is optional: send a token ' +
      'to have `following` reflect your own relationship to them, or none ' +
      'at all to get the anonymous view.',
  })
  @ApiParam({ name: 'username', example: 'jake' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiUnauthorizedResponse({
    description: 'A token was sent, but it is invalid or revoked.',
  })
  @ApiNotFoundResponse({ description: 'No user with that username.' })
  getProfile(
    @Param('username') username: string,
    @OptionalCurrentUser() viewer?: User,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.getProfile(username, viewer);
  }

  @Post(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Follow user',
    description:
      'Idempotent - following someone you already follow succeeds and ' +
      'changes nothing.',
  })
  @ApiParam({ name: 'username', example: 'jake' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiNotFoundResponse({ description: 'No user with that username.' })
  @ApiUnprocessableEntityResponse({
    description: 'You cannot follow yourself.',
  })
  follow(
    @Param('username') username: string,
    @CurrentUser() viewer: User,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.follow(username, viewer);
  }

  @Delete(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Unfollow user',
    description:
      'Idempotent - unfollowing someone you do not follow succeeds and ' +
      'changes nothing.',
  })
  @ApiParam({ name: 'username', example: 'jake' })
  @ApiOkResponse({ type: ProfileResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiNotFoundResponse({ description: 'No user with that username.' })
  @ApiUnprocessableEntityResponse({
    description: 'You cannot unfollow yourself.',
  })
  unfollow(
    @Param('username') username: string,
    @CurrentUser() viewer: User,
  ): Promise<ProfileResponseDto> {
    return this.profilesService.unfollow(username, viewer);
  }
}
