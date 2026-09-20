import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { I18nService } from 'nestjs-i18n';
import { Readable } from 'stream';
import { EntityManager, Repository } from 'typeorm';

import { User } from '../users/entities/user.entity';
import { AttachableType, Attachment } from './entities/attachment.entity';
import { sanitiseFileName } from './storage/file-name';
import {
  detectImageType,
  SUPPORTED_IMAGE_MIME_TYPES,
} from './storage/image-type';
import { LocalFileStorage } from './storage/local-file-storage';

export interface UploadedImage {
  originalname: string;
  buffer: Buffer;
}

export interface AttachmentOwner {
  type: AttachableType;
  id: string;
}

export interface StoredAttachment {
  attachment: Attachment;
  staleStoragePaths: string[];
}

type ReadPolicy = (attachment: Attachment, viewer: User) => boolean;

const READ_POLICIES: Partial<Record<AttachableType, ReadPolicy>> = {
  User: () => true,
};

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentsRepository: Repository<Attachment>,
    private readonly storage: LocalFileStorage,
    private readonly i18n: I18nService,
  ) {}

  async replaceFor(
    owner: AttachmentOwner,
    file: UploadedImage,
    manager?: EntityManager,
  ): Promise<StoredAttachment> {
    const imageType = detectImageType(file.buffer);

    if (!imageType) {
      throw new UnsupportedMediaTypeException(
        this.i18n.t('attachment.UNSUPPORTED_TYPE', {
          args: { types: SUPPORTED_IMAGE_MIME_TYPES.join(', ') },
        }),
      );
    }

    const repository = this.repository(manager);

    const id = randomUUID();
    const storagePath = `${owner.type.toLowerCase()}/${id}.${imageType.extension}`;

    await this.storage.save(storagePath, file.buffer);

    const previous = await repository.find({
      where: { attachableType: owner.type, attachableId: owner.id },
    });

    if (previous.length > 0) {
      await repository.delete({
        attachableType: owner.type,
        attachableId: owner.id,
      });
    }

    const attachment = await repository.save(
      repository.create({
        id,
        attachableType: owner.type,
        attachableId: owner.id,
        url: `/attachments/${id}`,
        fileName: sanitiseFileName(file.originalname, imageType.extension),
        fileType: imageType.mime,
        fileSize: file.buffer.length,
        storagePath,
      }),
    );

    this.logger.log(
      `Stored ${imageType.mime} attachment ${id} for ${owner.type} ${owner.id}`,
    );

    return {
      attachment,
      staleStoragePaths: previous.map((row) => row.storagePath),
    };
  }

  async discardFiles(storagePaths: string[]): Promise<void> {
    await Promise.all(
      storagePaths.map((storagePath) => this.storage.remove(storagePath)),
    );
  }

  async openForDownload(
    id: string,
    viewer: User,
  ): Promise<{ attachment: Attachment; stream: Readable }> {
    const attachment = await this.attachmentsRepository.findOne({
      where: { id },
    });

    if (!attachment) {
      throw new NotFoundException(this.i18n.t('attachment.NOT_FOUND'));
    }

    this.assertReadable(attachment, viewer);

    if (!(await this.storage.exists(attachment.storagePath))) {
      this.logger.error(
        `Attachment ${id} has no file at "${attachment.storagePath}"`,
      );

      throw new NotFoundException(this.i18n.t('attachment.NOT_FOUND'));
    }

    return {
      attachment,
      stream: this.storage.createReadStream(attachment.storagePath),
    };
  }

  private assertReadable(attachment: Attachment, viewer: User): void {
    const policy = READ_POLICIES[attachment.attachableType];

    if (!policy?.(attachment, viewer)) {
      throw new ForbiddenException(this.i18n.t('attachment.FORBIDDEN'));
    }
  }

  private repository(manager?: EntityManager): Repository<Attachment> {
    return manager
      ? manager.getRepository(Attachment)
      : this.attachmentsRepository;
  }
}
