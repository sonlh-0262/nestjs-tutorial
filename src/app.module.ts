import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { LANGUAGE_FALLBACKS } from './common/constants/languages';
import { AcceptLanguageAliasResolver } from './common/resolvers/accept-language-alias.resolver';
import authConfig from './config/auth.config';
import configuration, { AppConfig } from './config/configuration';
import databaseConfig from './config/database.config';
import { envValidationSchema } from './config/env.validation';
import redisConfig from './config/redis.config';
import storageConfig from './config/storage.config';
import { DatabaseModule } from './database/database.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RedisModule } from './redis/redis.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [
        configuration,
        databaseConfig,
        redisConfig,
        authConfig,
        storageConfig,
      ],
      validationSchema: envValidationSchema,
      validationOptions: { abortEarly: false },
      envFilePath: ['.env.local', '.env'],
    }),
    I18nModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = configService.getOrThrow<AppConfig>('app');

        return {
          fallbackLanguage: config.fallbackLanguage,
          fallbacks: LANGUAGE_FALLBACKS,
          loaderOptions: {
            path: path.join(__dirname, '/i18n/'),
            watch: config.nodeEnv !== 'production',
          },
        };
      },
      resolvers: [
        { use: QueryResolver, options: ['lang', 'l'] },
        new HeaderResolver(['x-lang']),
        // Must come before the bundled resolver: it maps `ja` / `ja-JP` onto
        // the `jp` catalogue, which the bundled one cannot do on its own.
        AcceptLanguageAliasResolver,
        AcceptLanguageResolver,
      ],
    }),
    DatabaseModule,
    RedisModule,
    UsersModule,
    AuthModule,
    AttachmentsModule,
    ProfilesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
