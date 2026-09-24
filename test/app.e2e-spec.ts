import request from 'supertest';

import { HealthResponseDto } from '../src/dto/health-response.dto';
import { HelloResponseDto } from '../src/dto/hello-response.dto';
import { TestContext } from './support/interfaces/test-context.interface';
import { createTestApp } from './support/test-app';

interface OpenApiDocument {
  info: { title: string; version: string };
  paths: Record<string, unknown>;
}

const JP_HELLO = 'こんにちは世界！';
const JP_HEALTH = 'サービスは正常に稼働しています';

describe('AppController (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    // `swagger: true` because this file is the one that asserts the OpenAPI
    // document; every other spec skips building it.
    ctx = await createTestApp({ swagger: true });
  });

  afterAll(async () => {
    await ctx.close();
  });

  afterEach(async () => {
    await ctx.reset();
  });

  const getHello = async (query = ''): Promise<HelloResponseDto> => {
    const response = await request(ctx.server()).get(`/${query}`);
    expect(response.status).toBe(200);
    return response.body as HelloResponseDto;
  };

  const getHelloWithHeader = async (
    header: string,
    value: string,
  ): Promise<HelloResponseDto> => {
    const response = await request(ctx.server())
      .get('/')
      .set(header, value)
      .expect(200);
    return response.body as HelloResponseDto;
  };

  describe('GET /', () => {
    it('returns the English greeting by default', async () => {
      expect(await getHello()).toEqual({
        message: 'Hello World!',
        language: 'en',
      });
    });

    it('returns Japanese when resolved from the `lang` query parameter', async () => {
      expect(await getHello('?lang=jp')).toEqual({
        message: JP_HELLO,
        language: 'jp',
      });
    });

    it('supports the short `l` query alias', async () => {
      expect((await getHello('?l=jp')).message).toBe(JP_HELLO);
    });

    it('returns Japanese when resolved from the `x-lang` header', async () => {
      expect(await getHelloWithHeader('x-lang', 'jp')).toEqual({
        message: JP_HELLO,
        language: 'jp',
      });
    });

    it('resolves the ISO code `ja` from Accept-Language onto `jp`', async () => {
      // Browsers send `ja`, not `jp`, so this is the realistic header.
      expect(await getHelloWithHeader('Accept-Language', 'ja')).toEqual({
        message: JP_HELLO,
        language: 'jp',
      });
    });

    it('resolves the regional variant `ja-JP` onto `jp`', async () => {
      expect(await getHelloWithHeader('Accept-Language', 'ja-JP')).toEqual({
        message: JP_HELLO,
        language: 'jp',
      });
    });

    it('honours a realistic browser Accept-Language header', async () => {
      // What Chrome on a Japanese machine actually sends.
      const body = await getHelloWithHeader(
        'Accept-Language',
        'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
      );
      expect(body).toEqual({ message: JP_HELLO, language: 'jp' });
    });

    it('serves English for an English regional variant', async () => {
      expect(await getHelloWithHeader('Accept-Language', 'en-GB')).toEqual({
        message: 'Hello World!',
        language: 'en',
      });
    });

    it('still accepts `jp` in Accept-Language', async () => {
      expect((await getHelloWithHeader('Accept-Language', 'jp')).message).toBe(
        JP_HELLO,
      );
    });

    it('falls back to English for an unsupported language', async () => {
      // The reported language must match the language of the body, not the
      // language that was asked for.
      expect(await getHello('?lang=fr')).toEqual({
        message: 'Hello World!',
        language: 'en',
      });
    });

    it('no longer serves Vietnamese', async () => {
      // `vi` was dropped from the supported set, so it must fall back to `en`.
      expect(await getHello('?lang=vi')).toEqual({
        message: 'Hello World!',
        language: 'en',
      });
    });

    it('interpolates the `name` query parameter', async () => {
      expect((await getHello('?name=Son')).message).toBe('Hello, Son!');
    });

    it('interpolates `name` in Japanese too', async () => {
      expect((await getHello('?name=Son&lang=jp')).message).toBe(
        'こんにちは、Sonさん！',
      );
    });
  });

  describe('validation', () => {
    it('rejects a name longer than 50 characters', async () => {
      const response = await request(ctx.server())
        .get(`/?name=${'a'.repeat(51)}`)
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('50');
    });

    it('translates validation errors into the requested language', async () => {
      const response = await request(ctx.server())
        .get(`/?name=${'a'.repeat(51)}&lang=jp`)
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('文字以内');
    });

    it('rejects unknown query parameters', async () => {
      await request(ctx.server()).get('/?unexpected=1').expect(400);
    });
  });

  describe('GET /health', () => {
    it('reports the service as healthy', async () => {
      const response = await request(ctx.server()).get('/health').expect(200);

      const body = response.body as HealthResponseDto;
      expect(body.status).toBe('ok');
      expect(body.message).toBe('Service is healthy');
      expect(typeof body.uptime).toBe('number');
      expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('localises the health message', async () => {
      const response = await request(ctx.server())
        .get('/health?lang=jp')
        .expect(200);

      expect((response.body as HealthResponseDto).message).toBe(JP_HEALTH);
    });
  });

  describe('swagger', () => {
    it('serves the UI', async () => {
      await request(ctx.server())
        .get('/api')
        .expect(200)
        .expect('Content-Type', /text\/html/);
    });

    it('serves the OpenAPI JSON document', async () => {
      const response = await request(ctx.server()).get('/api-json').expect(200);

      const document = response.body as OpenApiDocument;
      expect(document.info.title).toBeDefined();
      expect(document.paths['/']).toBeDefined();
      expect(document.paths['/health']).toBeDefined();
    });

    it('advertises en and jp as the supported languages', async () => {
      const response = await request(ctx.server()).get('/api-json').expect(200);

      const raw = JSON.stringify(response.body);
      expect(raw).toContain('"enum":["en","jp"]');
      expect(raw).not.toContain('"vi"');
    });
  });
});
