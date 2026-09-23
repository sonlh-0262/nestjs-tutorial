import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants';
import { CreateCommentBodyDto } from './create-comment.dto';

const check = async (
  payload: Record<string, unknown>,
): Promise<{ instance: CreateCommentBodyDto; errors: ValidationError[] }> => {
  const instance = plainToInstance(CreateCommentBodyDto, payload, {
    enableImplicitConversion: true,
  });

  return { instance, errors: await validate(instance) };
};

describe('CreateCommentBodyDto', () => {
  it('accepts a body', async () => {
    const { errors } = await check({ body: 'His name was my name too.' });

    expect(errors).toHaveLength(0);
  });

  it('requires a body', async () => {
    const { errors } = await check({});

    expect(errors.map((error) => error.property)).toEqual(['body']);
  });

  it('trims the body before validating it', async () => {
    const { instance, errors } = await check({ body: '  spaced  ' });

    expect(instance.body).toBe('spaced');
    expect(errors).toHaveLength(0);
  });

  it('rejects a body that is only whitespace', async () => {
    const { errors } = await check({ body: '   ' });

    expect(errors).toHaveLength(1);
  });

  it('coerces a non-string body rather than storing it raw', async () => {
    const { instance, errors } = await check({ body: 42 });

    expect(instance.body).toBe('42');
    expect(errors).toHaveLength(0);
  });

  it(`rejects a body longer than ${COMMENT_BODY_MAX_LENGTH} characters`, async () => {
    const { errors } = await check({
      body: 'a'.repeat(COMMENT_BODY_MAX_LENGTH + 1),
    });

    expect(errors).toHaveLength(1);
  });

  it(`accepts a body of exactly ${COMMENT_BODY_MAX_LENGTH} characters`, async () => {
    const { errors } = await check({
      body: 'a'.repeat(COMMENT_BODY_MAX_LENGTH),
    });

    expect(errors).toHaveLength(0);
  });
});
