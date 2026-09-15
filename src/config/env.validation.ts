import * as Joi from 'joi';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export interface EnvironmentVariables {
  NODE_ENV?: Environment;
  PORT?: number;
  APP_NAME?: string;
  API_PREFIX?: string;
  FALLBACK_LANGUAGE?: string;
  SWAGGER_PATH?: string;
  SWAGGER_ENABLED?: string;
}

export const envValidationSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid(...Object.values(Environment))
    .optional(),
  PORT: Joi.number().min(1).max(65535).optional(),
  APP_NAME: Joi.string().min(1).optional(),
  API_PREFIX: Joi.string().allow('').optional(),
  FALLBACK_LANGUAGE: Joi.string()
    .valid(...SUPPORTED_LANGUAGES)
    .optional(),
  SWAGGER_PATH: Joi.string().min(1).optional(),
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').optional(),
}).unknown(true);
