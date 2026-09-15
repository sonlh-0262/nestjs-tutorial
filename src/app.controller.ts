import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18nLang } from 'nestjs-i18n';

import { AppService } from './app.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { HelloQueryDto } from './dto/hello-query.dto';
import { HelloResponseDto } from './dto/hello-response.dto';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({
    summary: 'Hello world',
    description:
      'Returns a localised greeting. Pass `?lang=jp` or an ' +
      '`Accept-Language: ja` header to get the Japanese version.',
  })
  @ApiOkResponse({ type: HelloResponseDto })
  getHello(
    @I18nLang() lang: string,
    @Query() query: HelloQueryDto,
  ): HelloResponseDto {
    return this.appService.getHello(lang, query.name);
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ type: HealthResponseDto })
  getHealth(@I18nLang() lang: string): HealthResponseDto {
    return this.appService.getHealth(lang);
  }
}
