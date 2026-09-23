export const SLUG_MAX_LENGTH = 255;

export const TITLE_MAX_LENGTH = 255;

export const DESCRIPTION_MAX_LENGTH = 500;

export const BODY_MAX_LENGTH = 50_000;

export const TAG_MIN_LENGTH = 1;

export const TAG_MAX_LENGTH = 50;

export const MAX_TAGS_PER_ARTICLE = 10;

export const SLUG_SUFFIX_LENGTH = 6;

export const SLUG_ATTEMPT_LIMIT = 5;

export const SLUG_BASE_MAX_LENGTH = SLUG_MAX_LENGTH - SLUG_SUFFIX_LENGTH - 1;

export const SLUG_PARAM = { name: 'slug', example: 'how-to-train-your-dragon' };

export const LIST_COLUMNS = [
  'article.id',
  'article.slug',
  'article.title',
  'article.description',
  'article.body',
  'article.authorId',
  'article.createdAt',
  'article.updatedAt',
  'author.id',
  'author.username',
  'author.bio',
  'author.image',
  'tag.id',
  'tag.name',
];
