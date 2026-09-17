import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { User } from '../entities/user.entity';

export class UserDto {
  @ApiProperty({ example: 'jake@jake.jake', format: 'email' })
  email: string;

  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ nullable: true, example: 'I work at statefarm' })
  bio: string | null;

  @ApiProperty({ nullable: true, example: null })
  image: string | null;

  @ApiPropertyOptional({
    description:
      'JWT access token. Present on register and login; omitted elsewhere.',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  token?: string;
}

export class UserResponseDto {
  @ApiProperty({ type: UserDto })
  user: UserDto;
}

export function toUserDto(user: User, token?: string): UserDto {
  return {
    email: user.email,
    username: user.username,
    bio: user.bio,
    image: user.image,
    ...(token ? { token } : {}),
  };
}

export function toUserResponse(user: User, token?: string): UserResponseDto {
  return { user: toUserDto(user, token) };
}
