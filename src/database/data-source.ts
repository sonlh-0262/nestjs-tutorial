import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { ENV_FILE_PATHS } from '../config/config.constants';
import databaseConfig from '../config/database.config';
import { buildDataSourceOptions } from './data-source-options';

loadEnv({ path: ENV_FILE_PATHS, quiet: true });

export const dataSourceOptions = buildDataSourceOptions(databaseConfig());

export default new DataSource(dataSourceOptions);
