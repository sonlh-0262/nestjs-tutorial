import { Repository } from 'typeorm';

import { UserFollow } from '../../../src/users/entities/user-follow.entity';
import { User } from '../../../src/users/entities/user.entity';

export class FollowFactory {
  constructor(private readonly follows: Repository<UserFollow>) {}

  async create(follower: User, following: User): Promise<void> {
    await this.follows.save(
      this.follows.create({
        followerId: follower.id,
        followingId: following.id,
      }),
    );
  }
}
