import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ArticlesModule } from '../articles/articles.module';
import { UsersModule } from '../users/users.module';
import { CommentViewService } from './comment-view.service';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { Comment } from './entities/comment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Comment]), ArticlesModule, UsersModule],
  controllers: [CommentsController],
  providers: [CommentsService, CommentViewService],
})
export class CommentsModule {}
