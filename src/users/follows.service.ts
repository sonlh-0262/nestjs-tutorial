import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';

import { UserFollow } from './entities/user-follow.entity';

@Injectable()
export class FollowsService {
  private readonly logger = new Logger(FollowsService.name);

  constructor(
    @InjectRepository(UserFollow)
    private readonly followsRepository: Repository<UserFollow>,
    private readonly i18n: I18nService,
  ) {}

  async follow(followerId: string, followingId: string): Promise<void> {
    this.assertNotSelf(followerId, followingId);

    await this.followsRepository
      .createQueryBuilder()
      .insert()
      .into(UserFollow)
      .values({ followerId, followingId })
      .orIgnore()
      .execute();

    this.logger.log(`${followerId} follows ${followingId}`);
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    this.assertNotSelf(followerId, followingId);

    await this.followsRepository.delete({ followerId, followingId });

    this.logger.log(`${followerId} unfollowed ${followingId}`);
  }

  isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return this.followsRepository.existsBy({ followerId, followingId });
  }

  private assertNotSelf(followerId: string, followingId: string): void {
    if (followerId === followingId) {
      throw new UnprocessableEntityException(
        this.i18n.t('profile.CANNOT_FOLLOW_SELF'),
      );
    }
  }
}
