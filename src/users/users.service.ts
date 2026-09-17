import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { CreateUserInput } from './interfaces/create-user-input.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  static normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: UsersService.normaliseEmail(email) },
    });
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
}
