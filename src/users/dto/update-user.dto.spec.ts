import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { UpdateUserBodyDto } from './update-user.dto';

const check = async (
  payload: Record<string, unknown>,
): Promise<{ instance: UpdateUserBodyDto; errors: ValidationError[] }> => {
  const instance = plainToInstance(UpdateUserBodyDto, payload, {
    enableImplicitConversion: true,
  });

  return { instance, errors: await validate(instance) };
};

const failedProperties = (errors: ValidationError[]): string[] =>
  errors.map((error) => error.property).sort();

describe('UpdateUserBodyDto', () => {
  describe('everything is optional', () => {
    it('accepts an empty body', async () => {
      const { errors } = await check({});

      expect(errors).toHaveLength(0);
    });

    it('accepts a single field', async () => {
      const { errors } = await check({ bio: 'just a bio' });

      expect(errors).toHaveLength(0);
    });
  });

  describe('inherited credential rules', () => {
    it('still rejects a malformed email', async () => {
      const { errors } = await check({ email: 'not-an-email' });

      expect(failedProperties(errors)).toEqual(['email']);
    });

    it('still rejects a short password', async () => {
      const { errors } = await check({ password: 'short' });

      expect(failedProperties(errors)).toEqual(['password']);
    });

    it('still rejects a password past the bcrypt limit', async () => {
      const { errors } = await check({ password: 'a'.repeat(73) });

      expect(failedProperties(errors)).toEqual(['password']);
    });

    it('still rejects a username that is too short', async () => {
      const { errors } = await check({ username: 'ab' });

      expect(failedProperties(errors)).toEqual(['username']);
    });

    it('still rejects a username with characters that are not URL safe', async () => {
      const { errors } = await check({ username: 'not valid!' });

      expect(failedProperties(errors)).toEqual(['username']);
    });

    it('accepts a username made of letters, digits, hyphens and underscores', async () => {
      const { errors } = await check({ username: 'jake_the-dog9' });

      expect(errors).toHaveLength(0);
    });

    it('reports every bad field at once', async () => {
      const { errors } = await check({
        email: 'nope',
        password: 'short',
        username: 'x',
      });

      expect(failedProperties(errors)).toEqual([
        'email',
        'password',
        'username',
      ]);
    });
  });

  describe('inherited transforms', () => {
    it('still lower-cases and trims the email', async () => {
      const { instance } = await check({ email: '  JAKE@Jake.JAKE ' });

      expect(instance.email).toBe('jake@jake.jake');
    });

    it('still trims the username', async () => {
      const { instance } = await check({ username: '  jake  ' });

      expect(instance.username).toBe('jake');
    });
  });

  describe('bio and image', () => {
    it('keeps a bio that was sent', async () => {
      const { instance, errors } = await check({ bio: '  a bio  ' });

      expect(errors).toHaveLength(0);
      expect(instance.bio).toBe('a bio');
    });

    it('treats an empty bio as a request to clear it', async () => {
      const { instance } = await check({ bio: '' });

      expect(instance.bio).toBeNull();
    });

    it('treats whitespace as empty', async () => {
      const { instance } = await check({ bio: '   ' });

      expect(instance.bio).toBeNull();
    });

    it('accepts an explicit null', async () => {
      const { instance, errors } = await check({ bio: null });

      expect(errors).toHaveLength(0);
      expect(instance.bio).toBeNull();
    });

    it('leaves a bio that was not sent undefined, which means "unchanged"', async () => {
      const { instance } = await check({ username: 'jake' });

      expect(instance.bio).toBeUndefined();
    });

    it('rejects a bio past the column width', async () => {
      const { errors } = await check({ bio: 'a'.repeat(1001) });

      expect(failedProperties(errors)).toEqual(['bio']);
    });

    it('rejects an image URL past the column width', async () => {
      const { errors } = await check({ image: `https://x/${'a'.repeat(512)}` });

      expect(failedProperties(errors)).toEqual(['image']);
    });

    it('accepts an image URL', async () => {
      const { instance, errors } = await check({
        image: 'https://example.com/a.png',
      });

      expect(errors).toHaveLength(0);
      expect(instance.image).toBe('https://example.com/a.png');
    });
  });
});
