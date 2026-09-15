import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { DEFAULT_LANGUAGE } from './common/constants/languages';
import { AppConfig } from './config/configuration';
import { HealthResponseDto } from './dto/health-response.dto';
import { HelloResponseDto } from './dto/hello-response.dto';

@Injectable()
export class AppService {
  constructor(
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  getHello(lang: string, name?: string): HelloResponseDto {
    const language = this.effectiveLanguage(lang);

    const message = name
      ? this.i18n.t('common.greeting', { lang: language, args: { name } })
      : this.i18n.t('common.hello_world', { lang: language });

    return { message, language };
  }

  getHealth(lang: string): HealthResponseDto {
    const language = this.effectiveLanguage(lang);

    return {
      status: 'ok',
      message: this.i18n.t('common.health_ok', { lang: language }),
      uptime: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  private effectiveLanguage(lang: string): string {
    const resolved = this.i18n.resolveLanguage(lang);

    if (this.i18n.getSupportedLanguages().includes(resolved)) {
      return resolved;
    }

    return (
      this.configService.get<AppConfig>('app')?.fallbackLanguage ??
      DEFAULT_LANGUAGE
    );
  }
}
