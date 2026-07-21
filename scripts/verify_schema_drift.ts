// 斷言 migrate.ts 的 SCHEMA_SQL + runAdditions 覆蓋 drizzle schema 的每一張表、每一個欄位。
// schema 有兩份真相（schema.ts 是 canonical、migrate.ts 是實際建表 SQL），漏同步就會出現
// 「drizzle 讀得到但 DB 沒這欄」的執行期錯誤。把「靠人記得」變成 CI 斷言。
import fs from 'fs';
import path from 'path';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../src/db/schema';
import { ALL_TABLES } from '../src/db/tables';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'db', 'migrate.ts'), 'utf8');

// CREATE TABLE IF NOT EXISTS <name> ( ...欄位... );
const createBlocks = new Map<string, string>();
for (const m of src.matchAll(/CREATE TABLE IF NOT EXISTS\s+["']?(\w+)["']?\s*\(([\s\S]*?)\n\s*\);/g)) {
  createBlocks.set(m[1], m[2]);
}
// ALTER TABLE <name> ADD COLUMN <col>（動態表名 ${t} 的略過——那是 sync_uuid，不在 drizzle schema）
const added = new Map<string, Set<string>>();
for (const m of src.matchAll(/ALTER TABLE\s+["']?(\w+)["']?\s+ADD COLUMN\s+["']?(\w+)["']?/gi)) {
  const [, tbl, col] = m;
  if (!added.has(tbl)) added.set(tbl, new Set());
  added.get(tbl)!.add(col);
}

const configs = Object.values(schema)
  .filter((t) => { try { getTableConfig(t as any); return true; } catch { return false; } })
  .map((t) => getTableConfig(t as any));

ok(configs.length === ALL_TABLES.length, `drizzle 表數(${configs.length}) 應等於註冊表(${ALL_TABLES.length})`);

const missing: string[] = [];
for (const c of configs) {
  const block = createBlocks.get(c.name);
  ok(!!block, `migrate.ts 缺 CREATE TABLE: ${c.name}`);
  const addedCols = added.get(c.name) ?? new Set<string>();
  for (const col of c.columns) {
    const name = col.name;
    // 欄位名須出現在該表的 CREATE 區塊，或曾被 ALTER ADD COLUMN 補過
    const inCreate = new RegExp(`(^|[\\s(,])["']?${name}["']?[\\s]`, 'm').test(block!);
    if (!inCreate && !addedCols.has(name)) missing.push(`${c.name}.${name}`);
  }
}
ok(missing.length === 0,
  `drizzle 有但 migrate.ts never creates/adds 的欄位:\n  ${missing.join('\n  ')}`);

console.log(`ALL PASS (${pass} checks; ${configs.length} tables, 0 drifted columns)`);
