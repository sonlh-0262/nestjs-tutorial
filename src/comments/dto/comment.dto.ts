import { ApiProperty } from '@nestjs/swagger';

import { ProfileDto, toProfileDto } from '../../profiles/dto/profile.dto';
import { Comment } from '../entities/comment.entity';
import { CommentViewFlags } from '../interfaces/comment-view-flags.interface';

export class CommentDto {
  @ApiProperty({
    format: 'uuid',
    example: '7f1b8b1e-9d3a-4f2c-9c1e-6a1f0b2c3d4e',
  })
  id: string;

  @ApiProperty({ example: 'His name was my name too.' })
  body: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-18T08:30:00.000Z' })
  createdAt: string;

  @ApiProperty({ format: 'date-time', example: '2026-09-18T08:30:00.000Z' })
  updatedAt: string;

  @ApiProperty({ type: ProfileDto })
  author: ProfileDto;
}

export class CommentResponseDto {
  @ApiProperty({ type: CommentDto })
  comment: CommentDto;
}

export class CommentsResponseDto {
  @ApiProperty({ type: [CommentDto] })
  comments: CommentDto[];

  @ApiProperty({
    description:
      'Total number of comments on the article, ignoring `limit` and ' +
      '`offset` - use it to size a pager.',
    example: 2,
  })
  commentsCount: number;
}

export function toCommentDto(
  comment: Comment,
  flags: CommentViewFlags,
): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    author: toProfileDto(comment.author, flags.following),
  };
}
