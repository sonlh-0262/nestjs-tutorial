import {
  Check,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { User } from './user.entity';

@Entity('user_follows')
@Index('IDX_user_follows_following_id', ['followingId'])
@Check('CHK_user_follows_not_self', '"follower_id" <> "following_id"')
export class UserFollow {
  @PrimaryColumn({ name: 'follower_id', type: 'uuid' })
  followerId: string;

  @PrimaryColumn({ name: 'following_id', type: 'uuid' })
  followingId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'follower_id',
    foreignKeyConstraintName: 'FK_user_follows_follower',
  })
  follower: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'following_id',
    foreignKeyConstraintName: 'FK_user_follows_following',
  })
  following: User;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
