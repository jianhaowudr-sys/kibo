import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'kibo.db';

/**
 * ⚠️ FK 強制執行目前**停用**（維持 expo-sqlite 預設的 OFF）。
 * schema.ts 宣告了 onDelete cascade，但 FK 一直沒開 → DB 層 cascade 從未執行，全靠 repo 手寫串刪。
 * 打開的效益：孤兒列在 DB 層被擋掉、cascade 真的生效。
 * 打開的風險：**目前靜默成功的寫入會開始報錯** —— 任何亂序插入（子先於父）或指向已刪父的寫入
 * 都會拋 SQLITE_CONSTRAINT。這在已上架、FK 從未開過的 app 上是行為變更，
 * 必須先做完整裝置迴歸（建/刪課表、finishWorkout、備份匯入、雲端 pull 亂序插入）才能開。
 * runAdditions 已做過一次性 orphan sweep（見 migrate.ts），既有孤兒列已清乾淨。
 */
const ENABLE_FK_ENFORCEMENT = false;

export const sqliteDb = openDatabaseSync(DB_NAME);

if (ENABLE_FK_ENFORCEMENT) {
  try { sqliteDb.execSync('PRAGMA foreign_keys = ON;'); } catch {}
}
export const db = drizzle(sqliteDb, { schema });

export type DB = typeof db;
