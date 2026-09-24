import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import databaseConfig from '../config/database.config';
import { envFilePaths } from '../config/env-files';
import { buildDataSourceOptions } from './data-source-options';

loadEnv({ path: envFilePaths(), quiet: true });

export const dataSourceOptions = buildDataSourceOptions(databaseConfig());

export default new DataSource(dataSourceOptions);
