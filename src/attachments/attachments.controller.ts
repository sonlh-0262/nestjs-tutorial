import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AttachmentsService } from './attachments.service';

const FIRST_PRINTABLE_ASCII = 0x20;
const LAST_PRINTABLE_ASCII = 0x7e;

@ApiTags('Attachments')
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
  @Header('Cache-Control', 'private, max-age=86400')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    summary: 'Download an attachment',
    description:
      'Streams a stored file. Uploads are kept outside the web root and are ' +
      'only reachable here, so every download is authenticated and checked ' +
      'against the read policy for that kind of attachment.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({
    description: 'The file, with its detected media type.',
    content: { 'image/*': { schema: { type: 'string', format: 'binary' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or revoked token.',
  })
  @ApiForbiddenResponse({
    description: 'The caller may not read this attachment.',
  })
  @ApiNotFoundResponse({ description: 'No such attachment.' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer: User,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const { attachment, stream } =
      await this.attachmentsService.openForDownload(id, viewer);

    response.setHeader(
      'Content-Disposition',
      `inline; filename="${asciiFallback(attachment.fileName)}"; ` +
        `filename*=UTF-8''${encodeURIComponent(attachment.fileName)}`,
    );

    return new StreamableFile(stream, {
      type: attachment.fileType,
      length: attachment.fileSize,
    });
  }
}

function asciiFallback(fileName: string): string {
  return [...fileName]
    .map((character) => {
      const code = character.charCodeAt(0);

      return code >= FIRST_PRINTABLE_ASCII && code <= LAST_PRINTABLE_ASCII
        ? character
        : '_';
    })
    .join('');
}
