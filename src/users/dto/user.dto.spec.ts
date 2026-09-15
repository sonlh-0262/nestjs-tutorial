import { User } from '../entities/user.entity';
import { toUserDto, toUserResponse } from './user.dto';

const USER = {
  id: 'user-id',
  email: 'jake@jake.jake',
  username: 'jake',
  passwordHash: '$2b$10$not-a-real-hash',
  bio: 'I work at statefarm',
  image: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
} as User;

describe('user serialisation', () => {
  it('exposes only the public profile fields', () => {
    expect(toUserDto(USER)).toEqual({
      email: 'jake@jake.jake',
      username: 'jake',
      bio: 'I work at statefarm',
      image: null,
    });
  });

  it('never leaks the password hash, the id or the timestamps', () => {
    const dto = toUserDto(USER) as unknown as Record<string, unknown>;

    expect(dto.passwordHash).toBeUndefined();
    expect(dto.id).toBeUndefined();
    expect(dto.createdAt).toBeUndefined();
    expect(dto.updatedAt).toBeUndefined();
  });

  it('includes the token when one is issued', () => {
    expect(toUserDto(USER, 'signed.jwt.token').token).toBe('signed.jwt.token');
  });

  it('omits the token key entirely when none is issued', () => {
    expect('token' in toUserDto(USER)).toBe(false);
  });

  it('wraps the payload in the `user` envelope', () => {
    expect(toUserResponse(USER, 'signed.jwt.token')).toEqual({
      user: {
        email: 'jake@jake.jake',
        username: 'jake',
        bio: 'I work at statefarm',
        image: null,
        token: 'signed.jwt.token',
      },
    });
  });
});
