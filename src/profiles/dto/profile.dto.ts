import { ApiProperty } from '@nestjs/swagger';

import { User } from '../../users/entities/user.entity';

export class ProfileDto {
  @ApiProperty({ example: 'jake' })
  username: string;

  @ApiProperty({ nullable: true, example: 'I work at statefarm' })
  bio: string | null;

  @ApiProperty({
    nullable: true,
    description:
      'Either an `/attachments/<uuid>` path for an uploaded avatar, or an ' +
      'external URL the user set directly.',
    example: '/attachments/7f1b8b1e-9d3a-4f2c-9c1e-6a1f0b2c3d4e',
  })
  image: string | null;

  @ApiProperty({
    description:
      'Whether the caller follows this user. Always `false` for anonymous ' +
      'callers and when viewing your own profile.',
    example: false,
  })
  following: boolean;
}

export class ProfileResponseDto {
  @ApiProperty({ type: ProfileDto })
  profile: ProfileDto;
}

export function toProfileResponse(
  user: User,
  following: boolean,
): ProfileResponseDto {
  return {
    profile: {
      username: user.username,
      bio: user.bio,
      image: user.image,
      following,
    },
  };
}
