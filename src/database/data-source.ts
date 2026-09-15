import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import databaseConfig from '../config/database.config';
import { buildDataSourceOptions } from './data-source-options';

loadEnv({ path: ['.env.local', '.env'], quiet: true });

export const dataSourceOptions = buildDataSourceOptions(databaseConfig());

export default new DataSource(dataSourceOptions);
