import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';

import { Tag } from './entities/tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
  ) {}

  static normalise(names: string[]): string[] {
    return [
      ...new Set(
        names.map((name) => name.trim().toLowerCase()).filter(Boolean),
      ),
    ];
  }

  async resolve(names: string[], manager?: EntityManager): Promise<Tag[]> {
    const wanted = TagsService.normalise(names);

    if (wanted.length === 0) {
      return [];
    }

    const repository = manager
      ? manager.getRepository(Tag)
      : this.tagsRepository;

    await repository
      .createQueryBuilder()
      .insert()
      .into(Tag)
      .values(wanted.map((name) => ({ name })))
      .orIgnore()
      .execute();

    return repository.findBy({ name: In(wanted) });
  }
}
