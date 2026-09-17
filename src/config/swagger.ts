import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import {
  LANGUAGE_QUERY_PARAM,
  SUPPORTED_LANGUAGES,
  SUPPORTED_LANGUAGES_LABEL,
} from '../common/constants/languages';
import { SWAGGER_BEARER_AUTH_NAME } from '../common/constants/swagger';
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

  const config = new DocumentBuilder()
    .setTitle(appConfig.name)
    .setDescription(
      [
        'NestJS tutorial API.',
        '',
        `Responses are localised (${SUPPORTED_LANGUAGES_LABEL}). Choose a language with the`,
        '`?lang=jp` query parameter, the `x-lang` header, or a standard',
        '`Accept-Language` header (`ja` and `ja-JP` also resolve to `jp`).',
      ].join('\n'),
    )
    .setVersion('0.1.0')
    .addGlobalParameters({
      name: LANGUAGE_QUERY_PARAM,
      in: 'query',
      required: false,
      description: `Response language (${SUPPORTED_LANGUAGES_LABEL}).`,
      schema: { type: 'string', enum: [...SUPPORTED_LANGUAGES] },
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Access token from `POST /users` or `POST /users/login`. ' +
          'Paste the raw JWT - Swagger UI sends it as `Authorization: Bearer <token>`. ' +
          'The RealWorld `Authorization: Token <token>` scheme is accepted too.',
      },
      SWAGGER_BEARER_AUTH_NAME,
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
