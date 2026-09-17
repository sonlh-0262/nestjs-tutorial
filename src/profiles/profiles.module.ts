import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [UsersModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
})
export class ProfilesModule {}
