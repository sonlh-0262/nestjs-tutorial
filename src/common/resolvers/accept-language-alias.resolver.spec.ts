import { ExecutionContext } from '@nestjs/common';

import { AcceptLanguageAliasResolver } from './accept-language-alias.resolver';

describe('AcceptLanguageAliasResolver', () => {
  const resolver = new AcceptLanguageAliasResolver();

  const contextWith = (
    header?: string,
    type: 'http' | 'ws' = 'http',
  ): ExecutionContext =>
    ({
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => ({
          headers: header === undefined ? {} : { 'accept-language': header },
        }),
      }),
    }) as unknown as ExecutionContext;

  it.each([
    ['ja', 'jp'],
    ['ja-JP', 'jp'],
    ['JA-jp', 'jp'],
    ['jp', 'jp'],
    ['en', 'en'],
    ['en-GB', 'en'],
  ])('resolves %s to %s', (header, expected) => {
    expect(resolver.resolve(contextWith(header))).toBe(expected);
  });

  it('honours q-values rather than header order', () => {
    expect(resolver.resolve(contextWith('en;q=0.8,ja-JP;q=0.9'))).toBe('jp');
    expect(resolver.resolve(contextWith('ja;q=0.5,en;q=0.9'))).toBe('en');
  });

  it('picks the first supported tag when several are listed', () => {
    expect(resolver.resolve(contextWith('fr-FR,ja;q=0.9,en;q=0.8'))).toBe('jp');
  });

  it('defaults a missing q-value to the highest priority', () => {
    expect(resolver.resolve(contextWith('ja,en;q=0.9'))).toBe('jp');
  });

  it('ignores tags with a zero q-value', () => {
    expect(resolver.resolve(contextWith('ja;q=0,en;q=0.5'))).toBe('en');
  });

  it('returns undefined so the next resolver can try', () => {
    expect(resolver.resolve(contextWith('fr-FR,de;q=0.8'))).toBeUndefined();
    expect(resolver.resolve(contextWith(''))).toBeUndefined();
    expect(resolver.resolve(contextWith(undefined))).toBeUndefined();
    expect(resolver.resolve(contextWith('*'))).toBeUndefined();
  });

  it('ignores non-http execution contexts', () => {
    expect(resolver.resolve(contextWith('ja', 'ws'))).toBeUndefined();
  });
});
