import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfig } from './config/configuration';

describe('AppController', () => {
  let appController: AppController;

  const translations: Record<string, Record<string, string>> = {
    en: {
      'common.hello_world': 'Hello World!',
      'common.health_ok': 'Service is healthy',
    },
    jp: {
      'common.hello_world': 'こんにちは世界！',
      'common.health_ok': 'サービスは正常に稼働しています',
    },
  };

  const i18nServiceMock = {
    t: jest.fn(
      (key: string, options: { lang: string; args?: { name?: string } }) => {
        if (options.args?.name) {
          return options.lang === 'jp'
            ? `こんにちは、${options.args.name}さん！`
            : `Hello, ${options.args.name}!`;
        }
        return translations[options.lang]?.[key] ?? key;
      },
    ),
    resolveLanguage: jest.fn((lang: string) => {
      const base = lang.split('-')[0];
      return base === 'ja' ? 'jp' : base;
    }),
    getSupportedLanguages: jest.fn(() => ['en', 'jp']),
  };

  const configServiceMock = {
    get: jest.fn((): Partial<AppConfig> => ({ fallbackLanguage: 'en' })),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: I18nService, useValue: i18nServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('returns the default greeting', () => {
      expect(appController.getHello('en', {})).toEqual({
        message: 'Hello World!',
        language: 'en',
      });
    });

    it('returns a personalised greeting when a name is given', () => {
      expect(appController.getHello('en', { name: 'Son' })).toEqual({
        message: 'Hello, Son!',
        language: 'en',
      });
    });

    it('renders the greeting in the resolved language', () => {
      expect(appController.getHello('jp', {})).toEqual({
        message: 'こんにちは世界！',
        language: 'jp',
      });
    });

    it('personalises the Japanese greeting', () => {
      expect(appController.getHello('jp', { name: 'Son' }).message).toBe(
        'こんにちは、Sonさん！',
      );
    });

    it('collapses a regional variant onto its base language', () => {
      expect(appController.getHello('jp-JP', {}).language).toBe('jp');
    });

    it('maps the ISO code `ja` onto `jp`', () => {
      expect(appController.getHello('ja', {})).toEqual({
        message: 'こんにちは世界！',
        language: 'jp',
      });
    });

    it('maps `ja-JP` onto `jp`', () => {
      expect(appController.getHello('ja-JP', {}).language).toBe('jp');
    });

    it('reports the fallback language for an unsupported one', () => {
      // The body is English, so `language` must say `en` rather than echo `fr`.
      expect(appController.getHello('fr', {})).toEqual({
        message: 'Hello World!',
        language: 'en',
      });
    });
  });

  describe('GET /health', () => {
    it('reports the service as healthy', () => {
      const result = appController.getHealth('en');

      expect(result.status).toBe('ok');
      expect(result.message).toBe('Service is healthy');
      expect(typeof result.uptime).toBe('number');
      expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
    });

    it('localises the health message', () => {
      expect(appController.getHealth('jp').message).toBe(
        'サービスは正常に稼働しています',
      );
    });
  });
});
