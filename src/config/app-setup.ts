import { INestApplication } from '@nestjs/common';
import { I18nValidationExceptionFilter, I18nValidationPipe } from 'nestjs-i18n';

import { AppConfig } from './configuration';

/**
 * Applies every cross-cutting concern (prefix, CORS, validation, i18n error
 * rendering) to a Nest application instance.
 *
 * Shared by `main.ts` and the e2e tests so both run against an identically
 * configured app.
 */
export function configureApp(
  app: INestApplication,
  appConfig: AppConfig,
): INestApplication {
  if (appConfig.apiPrefix) {
    app.setGlobalPrefix(appConfig.apiPrefix);
  }

  app.enableCors();

  // `I18nValidationPipe` is a `ValidationPipe` whose errors carry translation
  // keys, which the filter below renders in the request language.
  app.useGlobalPipes(
    new I18nValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(
    new I18nValidationExceptionFilter({ detailedErrors: false }),
  );

  return app;
}
