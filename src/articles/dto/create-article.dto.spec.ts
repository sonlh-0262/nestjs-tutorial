import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

import {
  BODY_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  MAX_TAGS_PER_ARTICLE,
  TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '../articles.constants';
import { CreateArticleBodyDto } from './create-article.dto';
import { UpdateArticleBodyDto } from './update-article.dto';

const valid = {
  title: 'How to train your dragon',
  description: 'Ever wonder how?',
  body: 'It takes a Jacobian',
};

const check = async <T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
): Promise<{ instance: T; errors: ValidationError[] }> => {
  const instance = plainToInstance(cls, payload, {
    enableImplicitConversion: true,
  });

  return { instance, errors: await validate(instance) };
};

const failedProperties = (errors: ValidationError[]): string[] =>
  errors.map((error) => error.property).sort();

describe('CreateArticleBodyDto', () => {
  it('accepts a complete article', async () => {
    const { errors } = await check(CreateArticleBodyDto, valid);

    expect(errors).toHaveLength(0);
  });

  it('requires all three text fields', async () => {
    const { errors } = await check(CreateArticleBodyDto, {});

    expect(failedProperties(errors)).toEqual(['body', 'description', 'title']);
  });

  it('rejects a blank title', async () => {
    const { errors } = await check(CreateArticleBodyDto, {
      ...valid,
      title: '   ',
    });

    expect(failedProperties(errors)).toEqual(['title']);
  });

  it('trims the title and description', async () => {
    const { instance } = await check(CreateArticleBodyDto, {
      ...valid,
      title: '  Dragons  ',
      description: '  Ever wonder how?  ',
    });

    expect(instance.title).toBe('Dragons');
    expect(instance.description).toBe('Ever wonder how?');
  });

  it('leaves the body untouched, since whitespace there is content', async () => {
    const { instance } = await check(CreateArticleBodyDto, {
      ...valid,
      body: '  # Heading\n\n  indented code\n',
    });

    expect(instance.body).toBe('  # Heading\n\n  indented code\n');
  });

  it.each([
    ['title', TITLE_MAX_LENGTH],
    ['description', DESCRIPTION_MAX_LENGTH],
    ['body', BODY_MAX_LENGTH],
  ])('caps %s at the column width', async (field, max) => {
    const { errors } = await check(CreateArticleBodyDto, {
      ...valid,
      [field]: 'a'.repeat(max + 1),
    });

    expect(failedProperties(errors)).toEqual([field]);
  });

  describe('tagList', () => {
    it('is optional', async () => {
      const { errors } = await check(CreateArticleBodyDto, valid);

      expect(errors).toHaveLength(0);
    });

    it('accepts a list of strings', async () => {
      const { errors } = await check(CreateArticleBodyDto, {
        ...valid,
        tagList: ['dragons', 'training'],
      });

      expect(errors).toHaveLength(0);
    });

    it('rejects a bare string', async () => {
      const { errors } = await check(CreateArticleBodyDto, {
        ...valid,
        tagList: 'dragons',
      });

      expect(failedProperties(errors)).toEqual(['tagList']);
    });

    it('rejects a non-string item', async () => {
      const { errors } = await check(CreateArticleBodyDto, {
        ...valid,
        tagList: ['dragons', 7],
      });

      expect(failedProperties(errors)).toEqual(['tagList']);
    });

    it('rejects more tags than the cap', async () => {
      const { errors } = await check(CreateArticleBodyDto, {
        ...valid,
        tagList: Array.from(
          { length: MAX_TAGS_PER_ARTICLE + 1 },
          (_, index) => `tag${index}`,
        ),
      });

      expect(failedProperties(errors)).toEqual(['tagList']);
    });

    it('rejects a tag longer than the column', async () => {
      const { errors } = await check(CreateArticleBodyDto, {
        ...valid,
        tagList: ['a'.repeat(TAG_MAX_LENGTH + 1)],
      });

      expect(failedProperties(errors)).toEqual(['tagList']);
    });
  });
});

describe('UpdateArticleBodyDto', () => {
  it('accepts an empty patch', async () => {
    const { errors } = await check(UpdateArticleBodyDto, {});

    expect(errors).toHaveLength(0);
  });

  it('accepts a single field', async () => {
    const { errors } = await check(UpdateArticleBodyDto, { body: 'rewritten' });

    expect(errors).toHaveLength(0);
  });

  it('still enforces the create-time bounds on what is sent', async () => {
    const { errors } = await check(UpdateArticleBodyDto, {
      title: 'a'.repeat(TITLE_MAX_LENGTH + 1),
    });

    expect(failedProperties(errors)).toEqual(['title']);
  });

  it('rejects a blank title rather than treating it as absent', async () => {
    const { errors } = await check(UpdateArticleBodyDto, { title: '  ' });

    expect(failedProperties(errors)).toEqual(['title']);
  });

  it('rejects a tagList the way the global pipe would', async () => {
    const instance = plainToInstance(UpdateArticleBodyDto, {
      tagList: ['dragons'],
    });

    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    expect(failedProperties(errors)).toEqual(['tagList']);
  });
});
