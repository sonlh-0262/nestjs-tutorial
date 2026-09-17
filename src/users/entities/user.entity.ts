import { Exclude } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import {
  EMAIL_MAX_LENGTH,
  IMAGE_URL_MAX_LENGTH,
  PASSWORD_HASH_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
} from '../users.constants';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_users_email', { unique: true })
  @Column({ type: 'varchar', length: EMAIL_MAX_LENGTH })
  email: string;

  @Index('UQ_users_username', { unique: true })
  @Column({ type: 'varchar', length: USERNAME_MAX_LENGTH })
  username: string;

  @Exclude()
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: PASSWORD_HASH_MAX_LENGTH,
    select: false,
  })
  passwordHash: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'varchar', length: IMAGE_URL_MAX_LENGTH, nullable: true })
  image: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
