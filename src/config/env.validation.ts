import * as Joi from 'joi';

import { SUPPORTED_LANGUAGES } from '../common/constants/languages';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export const MIN_JWT_SECRET_LENGTH = 32;

export const JWT_DURATION_PATTERN = /^\d+(ms|s|m|h|d|w|y)?$/;

export interface EnvironmentVariables {
  NODE_ENV?: Environment;
  PORT?: number;
  APP_NAME?: string;
  API_PREFIX?: string;
  FALLBACK_LANGUAGE?: string;
  SWAGGER_PATH?: string;
  SWAGGER_ENABLED?: string;

  DB_HOST?: string;
  DB_PORT?: number;
  DB_USERNAME?: string;
  DB_PASSWORD?: string;
  DB_DATABASE?: string;
  DB_SCHEMA?: string;
  DB_SSL?: string;
  DB_LOGGING?: string;

  REDIS_HOST?: string;
  REDIS_PORT?: number;
  REDIS_PASSWORD?: string;
  REDIS_DB?: number;
  REDIS_KEY_PREFIX?: string;

  JWT_SECRET?: string;
  JWT_EXPIRES_IN?: string;
  JWT_ISSUER?: string;
  BCRYPT_SALT_ROUNDS?: number;
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

  DB_HOST: Joi.string().min(1).optional(),
  DB_PORT: Joi.number().min(1).max(65535).optional(),
  DB_USERNAME: Joi.string().min(1).optional(),
  DB_PASSWORD: Joi.string().allow('').optional(),
  DB_DATABASE: Joi.string().min(1).optional(),
  DB_SCHEMA: Joi.string().min(1).optional(),
  DB_SSL: Joi.string().valid('true', 'false').optional(),
  DB_LOGGING: Joi.string().valid('true', 'false').optional(),

  REDIS_HOST: Joi.string().min(1).optional(),
  REDIS_PORT: Joi.number().min(1).max(65535).optional(),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().min(0).max(15).optional(),
  REDIS_KEY_PREFIX: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(MIN_JWT_SECRET_LENGTH).when('NODE_ENV', {
    is: Environment.Production,
    then: Joi.required(),
    otherwise: Joi.optional(),
  }),
  JWT_EXPIRES_IN: Joi.string().pattern(JWT_DURATION_PATTERN).optional(),
  JWT_ISSUER: Joi.string().min(1).optional(),
  BCRYPT_SALT_ROUNDS: Joi.number().min(4).max(31).optional(),
}).unknown(true);
