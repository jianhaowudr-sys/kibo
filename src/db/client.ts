import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'kibo.db';

export const sqliteDb = openDatabaseSync(DB_NAME);
export const db = drizzle(sqliteDb, { schema });

export type DB = typeof db;
