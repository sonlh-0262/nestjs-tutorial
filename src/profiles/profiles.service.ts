import { Injectable, NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

import { User } from '../users/entities/user.entity';
import { FollowsService } from '../users/follows.service';
import { UsersService } from '../users/users.service';
import { ProfileResponseDto, toProfileResponse } from './dto/profile.dto';

@Injectable()
export class ProfilesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly followsService: FollowsService,
    private readonly i18n: I18nService,
  ) {}

  async getProfile(
    username: string,
    viewer?: User,
  ): Promise<ProfileResponseDto> {
    const user = await this.findOrFail(username);

    return toProfileResponse(user, await this.isFollowedBy(user, viewer));
  }

  async follow(username: string, viewer: User): Promise<ProfileResponseDto> {
    const user = await this.findOrFail(username);

    await this.followsService.follow(viewer.id, user.id);

    return toProfileResponse(user, true);
  }

  async unfollow(username: string, viewer: User): Promise<ProfileResponseDto> {
    const user = await this.findOrFail(username);

    await this.followsService.unfollow(viewer.id, user.id);

    return toProfileResponse(user, false);
  }

  private async findOrFail(username: string): Promise<User> {
    const user = await this.usersService.findByUsername(username);

    if (!user) {
      throw new NotFoundException(this.i18n.t('profile.NOT_FOUND'));
    }

    return user;
  }

  private isFollowedBy(user: User, viewer?: User): Promise<boolean> {
    if (!viewer || viewer.id === user.id) {
      return Promise.resolve(false);
    }

    return this.followsService.isFollowing(viewer.id, user.id);
  }
}
