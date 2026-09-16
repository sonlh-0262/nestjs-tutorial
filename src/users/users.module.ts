import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AttachmentsModule } from '../attachments/attachments.module';
import { buildMulterOptions } from '../attachments/storage/multer.config';
import { StorageConfig, STORAGE_CONFIG_KEY } from '../config/storage.config';
import { UserFollow } from './entities/user-follow.entity';
import { User } from './entities/user.entity';
import { FollowsService } from './follows.service';
import { PasswordService } from './password.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserFollow]),
    AttachmentsModule,
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildMulterOptions(
          configService.getOrThrow<StorageConfig>(STORAGE_CONFIG_KEY),
        ),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, FollowsService, PasswordService],
  exports: [UsersService, FollowsService, PasswordService],
})
export class UsersModule {}
