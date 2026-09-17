/**
 * The languages this API ships translations for.
 *
 * Single source of truth: the Swagger `lang` enum, the environment validation
 * and the i18n defaults all read from here, so adding or removing a language
 * means adding a folder under `src/i18n/` and editing this list.
 */
export const SUPPORTED_LANGUAGES = ['en', 'jp'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Language tags accepted from clients, mapped onto the catalogue that serves
 * them.
 *
 * This API exposes Japanese as `jp`, but the ISO 639-1 code browsers actually
 * put in `Accept-Language` is `ja` (usually as `ja-JP`), so both are accepted.
 * Keys must be lower case; regional suffixes are stripped before lookup.
 */
export const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  en: 'en',
  jp: 'jp',
  ja: 'jp',
};

/**
 * Fallbacks handed to `nestjs-i18n`. These cover the query-string and
 * `x-lang` resolvers, which pass their raw value straight through.
 */
export const LANGUAGE_FALLBACKS: Record<string, string> = {
  'en-*': 'en',
  'jp-*': 'jp',
  ja: 'jp',
  'ja-*': 'jp',
};

export const LANGUAGE_QUERY_PARAM = 'lang';

/** Short alias for {@link LANGUAGE_QUERY_PARAM}. */
export const LANGUAGE_QUERY_PARAM_ALIAS = 'l';

export const LANGUAGE_QUERY_PARAMS = [
  LANGUAGE_QUERY_PARAM,
  LANGUAGE_QUERY_PARAM_ALIAS,
];

/** Header `nestjs-i18n`'s `HeaderResolver` reads. */
export const LANGUAGE_HEADER = 'x-lang';

export const SUPPORTED_LANGUAGES_LABEL = SUPPORTED_LANGUAGES.join(' / ');
