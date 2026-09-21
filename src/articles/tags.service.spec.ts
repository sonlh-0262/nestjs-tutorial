import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { Tag } from './entities/tag.entity';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;

  const executeMock = jest.fn().mockResolvedValue({ identifiers: [] });
  const orIgnoreMock = jest.fn(() => ({ execute: executeMock }));
  const valuesMock = jest.fn(() => ({ orIgnore: orIgnoreMock }));
  const intoMock = jest.fn(() => ({ values: valuesMock }));
  const insertMock = jest.fn(() => ({ into: intoMock }));

  const repositoryMock = {
    createQueryBuilder: jest.fn(() => ({ insert: insertMock })),
    findBy: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        { provide: getRepositoryToken(Tag), useValue: repositoryMock },
      ],
    }).compile();

    service = module.get(TagsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    repositoryMock.findBy.mockResolvedValue([]);
  });

  describe('normalise', () => {
    it('lower-cases and trims', () => {
      expect(TagsService.normalise([' Dragons ', 'TRAINING'])).toEqual([
        'dragons',
        'training',
      ]);
    });

    it('collapses names that differ only by case or padding', () => {
      expect(TagsService.normalise(['dragons', 'Dragons', ' dragons'])).toEqual(
        ['dragons'],
      );
    });

    it('drops names that are only whitespace', () => {
      expect(TagsService.normalise(['  ', 'dragons', ''])).toEqual(['dragons']);
    });
  });

  describe('resolve', () => {
    it('writes nothing for an empty list', async () => {
      await expect(service.resolve([])).resolves.toEqual([]);

      expect(repositoryMock.createQueryBuilder).not.toHaveBeenCalled();
      expect(repositoryMock.findBy).not.toHaveBeenCalled();
    });

    it('writes nothing when every name normalises away', async () => {
      await expect(service.resolve(['   ', ''])).resolves.toEqual([]);

      expect(repositoryMock.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserts the normalised names', async () => {
      await service.resolve([' Dragons ', 'dragons', 'Training']);

      expect(valuesMock).toHaveBeenCalledWith([
        { name: 'dragons' },
        { name: 'training' },
      ]);
    });

    it('lets the unique index absorb a concurrent writer', async () => {
      await service.resolve(['dragons']);

      expect(orIgnoreMock).toHaveBeenCalled();
    });

    it('reads the rows back after inserting', async () => {
      const rows = [{ id: 'tag-1', name: 'dragons' } as Tag];
      repositoryMock.findBy.mockResolvedValue(rows);

      await expect(service.resolve(['Dragons'])).resolves.toBe(rows);
    });

    it('uses the transaction manager when one is given', async () => {
      const scopedRepository = {
        createQueryBuilder: jest.fn(() => ({ insert: insertMock })),
        findBy: jest.fn().mockResolvedValue([]),
      };
      const manager = { getRepository: jest.fn(() => scopedRepository) };

      await service.resolve(['dragons'], manager as never);

      expect(manager.getRepository).toHaveBeenCalledWith(Tag);
      expect(scopedRepository.findBy).toHaveBeenCalled();
      expect(repositoryMock.findBy).not.toHaveBeenCalled();
    });
  });
});
