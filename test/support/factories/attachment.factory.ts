import { DeepPartial, Repository } from 'typeorm';

import {
  AttachableType,
  Attachment,
} from '../../../src/attachments/entities/attachment.entity';
import { User } from '../../../src/users/entities/user.entity';
import { nextSequence } from './sequence';

export class AttachmentFactory {
  constructor(private readonly attachments: Repository<Attachment>) {}

  /**
   * `attachments` is polymorphic and carries no foreign key, so the owner is a
   * plain user and `attachableType` is an override - which is how a test can
   * seed a row belonging to something the read policies do not know.
   */
  create(
    owner: User,
    overrides: DeepPartial<Attachment> = {},
  ): Promise<Attachment> {
    const sequence = nextSequence();

    return this.attachments.save(
      this.attachments.create({
        attachableType: 'User' as AttachableType,
        attachableId: owner.id,
        url: `/attachments/seeded-${sequence}`,
        fileName: `seeded-${sequence}.png`,
        fileType: 'image/png',
        fileSize: 68,
        storagePath: `seeded-${sequence}.png`,
        ...overrides,
      }),
    );
  }
}
