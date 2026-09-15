import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const MIN_JWT_SECRET_LENGTH = 32;

export const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)?$/;

export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  APP_NAME?: string;

  @IsOptional()
  @IsString()
  API_PREFIX?: string;

  @IsOptional()
  @IsIn([...SUPPORTED_LANGUAGES])
  FALLBACK_LANGUAGE?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  SWAGGER_PATH?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  SWAGGER_ENABLED?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_HOST?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  DB_PORT?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_USERNAME?: string;

  @IsOptional()
  @IsString()
  DB_PASSWORD?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_DATABASE?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  DB_SCHEMA?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DB_SSL?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DB_LOGGING?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  REDIS_HOST?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(15)
  REDIS_DB?: number;

  @IsOptional()
  @IsString()
  REDIS_KEY_PREFIX?: string;

  @ValidateIf((env: EnvironmentVariables) => {
    return env.NODE_ENV === Environment.Production || env.JWT_SECRET != null;
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_JWT_SECRET_LENGTH)
  JWT_SECRET?: string;

  @IsOptional()
  @Matches(JWT_DURATION_PATTERN, {
    message: 'JWT_EXPIRES_IN must be a duration such as 60, 30s, 15m, 1d or 2w',
  })
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  JWT_ISSUER?: string;

  @IsOptional()
  @IsNumber()
  @Min(4)
  @Max(31)
  BCRYPT_SALT_ROUNDS?: number;
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment variables:\n${errors
        .map((error) => `  - ${error.toString()}`)
        .join('\n')}`,
    );
  }

  return validatedConfig;
}
