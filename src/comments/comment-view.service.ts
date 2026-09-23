import { Injectable } from '@nestjs/common';

import { User } from '../users/entities/user.entity';
import { FollowsService } from '../users/follows.service';
import {
  CommentDto,
  CommentResponseDto,
  CommentsResponseDto,
  toCommentDto,
} from './dto/comment.dto';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentViewService {
  constructor(private readonly followsService: FollowsService) {}

  async toCommentResponse(
    comment: Comment,
    viewer?: User,
  ): Promise<CommentResponseDto> {
    const [dto] = await this.toDtosWithViewerFlags([comment], viewer);

    return { comment: dto };
  }

  async toCommentsResponse(
    comments: Comment[],
    commentsCount: number,
    viewer?: User,
  ): Promise<CommentsResponseDto> {
    return {
      comments: await this.toDtosWithViewerFlags(comments, viewer),
      commentsCount,
    };
  }

  private async toDtosWithViewerFlags(
    comments: Comment[],
    viewer?: User,
  ): Promise<CommentDto[]> {
    if (comments.length === 0) {
      return [];
    }

    const authorIds = [...new Set(comments.map((comment) => comment.authorId))];
    const following = await this.followsService.followingAmong(
      viewer?.id,
      authorIds,
    );

    return comments.map((comment) =>
      toCommentDto(comment, { following: following.has(comment.authorId) }),
    );
  }
}
