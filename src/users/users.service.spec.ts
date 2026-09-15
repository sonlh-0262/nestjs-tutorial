import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;

  const queryBuilderMock = {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };

  const repositoryMock = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((input: Partial<User>) => input as User),
    save: jest.fn((user: User) => Promise.resolve({ ...user, id: 'user-id' })),
    createQueryBuilder: jest.fn(() => queryBuilderMock),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repositoryMock },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('normaliseEmail', () => {
    it('lower-cases and trims', () => {
      expect(UsersService.normaliseEmail('  Jake@Jake.JAKE  ')).toBe(
        'jake@jake.jake',
      );
    });

    it('leaves an already normalised address alone', () => {
      expect(UsersService.normaliseEmail('jake@jake.jake')).toBe(
        'jake@jake.jake',
      );
    });
  });

  describe('findByEmail', () => {
    it('looks the address up in its normalised form', async () => {
      await service.findByEmail('  Jake@Jake.JAKE ');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { email: 'jake@jake.jake' },
      });
    });
  });

  describe('findById / findByUsername', () => {
    it('queries by id', async () => {
      await service.findById('user-id');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });

    it('queries by username without altering its case', async () => {
      await service.findByUsername('Jake');

      expect(repositoryMock.findOne).toHaveBeenCalledWith({
        where: { username: 'Jake' },
      });
    });
  });

  describe('findByEmailWithPassword', () => {
    it('explicitly selects the hash the entity hides by default', async () => {
      await service.findByEmailWithPassword('JAKE@jake.jake');

      expect(queryBuilderMock.addSelect).toHaveBeenCalledWith(
        'user.passwordHash',
      );
      expect(queryBuilderMock.where).toHaveBeenCalledWith(
        'user.email = :email',
        { email: 'jake@jake.jake' },
      );
    });
  });

  describe('create', () => {
    it('stores the normalised email and empty profile fields', async () => {
      const user = await service.create({
        username: 'jake',
        email: 'JAKE@Jake.jake',
        passwordHash: 'hashed',
      });

      expect(repositoryMock.create).toHaveBeenCalledWith({
        username: 'jake',
        email: 'jake@jake.jake',
        passwordHash: 'hashed',
        bio: null,
        image: null,
      });
      expect(user.id).toBe('user-id');
    });
  });

  it('is typed against the real repository', () => {
    const repository = repositoryMock as unknown as Repository<User>;
    expect(typeof repository.findOne).toBe('function');
  });
});
