import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';

import {
  AttachmentsService,
  UploadedImage,
} from '../attachments/attachments.service';
import { UpdateUserBodyDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { PasswordService } from './password.service';

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}

interface AvatarOutcome {
  url?: string | null;
  storagePath?: string;
  staleStoragePaths: string[];
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly attachmentsService: AttachmentsService,
    private readonly passwordService: PasswordService,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  static normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { username } });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', {
        email: UsersService.normaliseEmail(email),
      })
      .getOne();
  }

  async create(input: CreateUserInput): Promise<User> {
    const user = this.usersRepository.create({
      username: input.username,
      email: UsersService.normaliseEmail(input.email),
      passwordHash: input.passwordHash,
      bio: null,
      image: null,
    });

    return this.usersRepository.save(user);
  }

  async update(
    user: User,
    input: UpdateUserBodyDto,
    avatar?: UploadedImage,
  ): Promise<User> {
    await this.assertCredentialsAvailable(input.email, input.username, user.id);

    const passwordHash = input.password
      ? await this.passwordService.hash(input.password)
      : undefined;

    let written: string | undefined;

    try {
      const { updated, staleStoragePaths } = await this.dataSource.transaction(
        async (manager) => {
          const image: AvatarOutcome = avatar
            ? await this.storeAvatar(manager, user, avatar)
            : { url: input.image, staleStoragePaths: [] };

          written = image.storagePath;

          const changes: Partial<User> = {
            ...(input.username !== undefined
              ? { username: input.username }
              : {}),
            ...(input.email !== undefined
              ? { email: UsersService.normaliseEmail(input.email) }
              : {}),
            ...(passwordHash !== undefined ? { passwordHash } : {}),
            ...(input.bio !== undefined ? { bio: input.bio } : {}),
            ...(image.url !== undefined ? { image: image.url } : {}),
          };

          const repository = manager.getRepository(User);

          if (Object.keys(changes).length > 0) {
            await repository.update({ id: user.id }, changes);
          }

          return {
            updated: await repository.findOneOrFail({ where: { id: user.id } }),
            staleStoragePaths: image.staleStoragePaths,
          };
        },
      );

      await this.attachmentsService.discardFiles(staleStoragePaths);

      this.logger.log(`Updated user ${updated.username} (${updated.id})`);

      return updated;
    } catch (error) {
      if (written) {
        await this.attachmentsService.discardFiles([written]);
      }

      throw error;
    }
  }

  async assertCredentialsAvailable(
    email?: string,
    username?: string,
    excludeUserId?: string,
  ): Promise<void> {
    const notSelf = excludeUserId ? { id: Not(excludeUserId) } : {};

    const [emailOwner, usernameOwner] = await Promise.all([
      email === undefined
        ? null
        : this.usersRepository.findOne({
            where: { email: UsersService.normaliseEmail(email), ...notSelf },
          }),
      username === undefined
        ? null
        : this.usersRepository.findOne({ where: { username, ...notSelf } }),
    ]);

    if (emailOwner) {
      throw new ConflictException(this.i18n.t('auth.EMAIL_TAKEN'));
    }

    if (usernameOwner) {
      throw new ConflictException(this.i18n.t('auth.USERNAME_TAKEN'));
    }
  }

  private async storeAvatar(
    manager: EntityManager,
    user: User,
    avatar: UploadedImage,
  ): Promise<AvatarOutcome> {
    const { attachment, staleStoragePaths } =
      await this.attachmentsService.replaceFor(
        { type: 'User', id: user.id },
        avatar,
        manager,
      );

    return {
      url: attachment.url,
      storagePath: attachment.storagePath,
      staleStoragePaths,
    };
  }
}
