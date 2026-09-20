import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import { MAX_PAGE_LIMIT } from '../constants/pagination';
import { PaginationQueryDto } from './pagination-query.dto';

const check = async (
  payload: Record<string, unknown>,
): Promise<{ instance: PaginationQueryDto; errors: ValidationError[] }> => {
  const instance = plainToInstance(PaginationQueryDto, payload, {
    enableImplicitConversion: true,
  });

  return { instance, errors: await validate(instance) };
};

const failedProperties = (errors: ValidationError[]): string[] =>
  errors.map((error) => error.property).sort();

describe('PaginationQueryDto', () => {
  it('accepts an empty query', async () => {
    const { errors } = await check({});

    expect(errors).toHaveLength(0);
  });

  it('coerces the query string values to numbers', async () => {
    const { instance, errors } = await check({ limit: '5', offset: '10' });

    expect(errors).toHaveLength(0);
    expect(instance.limit).toBe(5);
    expect(instance.offset).toBe(10);
  });

  it('rejects a non-numeric limit instead of silently defaulting', async () => {
    const { errors } = await check({ limit: 'abc' });

    expect(failedProperties(errors)).toEqual(['limit']);
  });

  it('rejects a fractional limit', async () => {
    const { errors } = await check({ limit: '1.5' });

    expect(failedProperties(errors)).toEqual(['limit']);
  });

  it('rejects a limit below one', async () => {
    const { errors } = await check({ limit: '0' });

    expect(failedProperties(errors)).toEqual(['limit']);
  });

  it('caps the limit', async () => {
    const { errors } = await check({ limit: String(MAX_PAGE_LIMIT + 1) });

    expect(failedProperties(errors)).toEqual(['limit']);
  });

  it('accepts the cap itself', async () => {
    const { errors } = await check({ limit: String(MAX_PAGE_LIMIT) });

    expect(errors).toHaveLength(0);
  });

  it('rejects a negative offset', async () => {
    const { errors } = await check({ offset: '-1' });

    expect(failedProperties(errors)).toEqual(['offset']);
  });

  it('accepts a zero offset', async () => {
    const { errors } = await check({ offset: '0' });

    expect(errors).toHaveLength(0);
  });

  it('inherits the language parameters so the pipe does not reject them', async () => {
    const { instance, errors } = await check({ lang: 'jp', l: 'en' });

    expect(errors).toHaveLength(0);
    expect(instance.lang).toBe('jp');
    expect(instance.l).toBe('en');
  });
});
