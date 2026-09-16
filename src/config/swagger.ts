import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';
import { AppConfig } from './configuration';

/**
 * Mounts the OpenAPI document. Defaults to `GET /api`, and the raw JSON
 * document is served from `GET /api-json`.
 */
export function setupSwagger(
  app: INestApplication,
  appConfig: AppConfig,
): void {
  if (!appConfig.swagger.enabled) {
    return;
  }

  const languages = SUPPORTED_LANGUAGES.join(' / ');

  const config = new DocumentBuilder()
    .setTitle(appConfig.name)
    .setDescription(
      [
        'NestJS tutorial API.',
        '',
        `Responses are localised (${languages}). Choose a language with the`,
        '`?lang=jp` query parameter, the `x-lang` header, or a standard',
        '`Accept-Language` header (`ja` and `ja-JP` also resolve to `jp`).',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addGlobalParameters({
      name: 'lang',
      in: 'query',
      required: false,
      description: `Response language (${languages}).`,
      schema: { type: 'string', enum: [...SUPPORTED_LANGUAGES] },
    })
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup(appConfig.swagger.path, app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
}
