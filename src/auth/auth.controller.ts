import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';

import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { CurrentToken } from '../common/decorators/current-user.decorator';
import { toUserResponse, UserResponseDto } from '../users/dto/user.dto';
import { AuthService } from './auth.service';
import { LoginUserDto } from './dto/login.dto';
import { LogoutResponseDto } from './dto/logout-response.dto';
import { RegisterUserDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TokenIdentity } from './interfaces/token-identity.interface';

@ApiTags('Auth')
@Controller('users')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly i18n: I18nService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Register',
    description:
      'Creates an account and returns it together with an access token, ' +
      'so a newly registered user does not have to log in separately.',
  })
  @ApiCreatedResponse({ type: UserResponseDto })
  @ApiConflictResponse({ description: 'Email or username already taken.' })
  async register(@Body() dto: RegisterUserDto): Promise<UserResponseDto> {
    const { user, token } = await this.authService.register(dto.user);

    return toUserResponse(user, token);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Email or password is incorrect.' })
  async login(@Body() dto: LoginUserDto): Promise<UserResponseDto> {
    const { user, token } = await this.authService.login(dto.user);

    return toUserResponse(user, token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @ApiOperation({
    summary: 'Log out',
    description:
      'Revokes the access token used to make this request by adding it to a ' +
      'Redis denylist, where it stays until it would have expired anyway.',
  })
  @ApiOkResponse({ type: LogoutResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  async logout(
    @CurrentToken() token: TokenIdentity,
  ): Promise<LogoutResponseDto> {
    await this.authService.logout(token.jti, token.expiresAt);

    return { message: this.i18n.t('auth.LOGGED_OUT') };
  }
}
