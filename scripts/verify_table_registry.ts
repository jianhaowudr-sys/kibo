// 斷言 src/db/tables.ts 的 ALL_TABLES 與 drizzle schema 完全一致（張數 + 名稱集合），
// 且排序滿足 FK「父先子後」。未來有人加表沒更新註冊表 → 這裡會掛。
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import * as schema from '../src/db/schema';
import { ALL_TABLES } from '../src/db/tables';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

// schema.ts 的 runtime 匯出只有 sqliteTable 物件（type 匯出在執行期被抹除）。
const configs = Object.values(schema)
  .filter((t) => { try { getTableConfig(t as any); return true; } catch { return false; } })
  .map((t) => getTableConfig(t as any));

const schemaNames = configs.map((c) => c.name).sort();
const registry = [...ALL_TABLES];
const registrySorted = [...registry].sort();

// ---- 集合 / 張數一致 ----
ok(registry.length === 22, `registry 應為 22 張，實際 ${registry.length}`);
ok(configs.length === 22, `schema 應為 22 張，實際 ${configs.length}`);
ok(new Set(registry).size === 22, 'registry 無重複');
ok(JSON.stringify(registrySorted) === JSON.stringify(schemaNames),
  `registry 與 schema 名稱集合不符：\n registry=${registrySorted}\n schema=  ${schemaNames}`);

// ---- 排序滿足 FK（被 reference 的表 index 較小）----
const idx = new Map<string, number>(registry.map((name, i) => [name, i]));
for (const c of configs) {
  const selfIdx = idx.get(c.name)!;
  for (const fk of c.foreignKeys) {
    let foreignName: string;
    try { foreignName = getTableConfig((fk.reference() as any).foreignTable).name; }
    catch { continue; }
    if (foreignName === c.name) continue; // 自我參照略過
    ok(idx.get(foreignName)! < selfIdx,
      `FK 順序違反：${c.name}(#${selfIdx}) 參照 ${foreignName}(#${idx.get(foreignName)}) 應在前`);
  }
}

// ---- eggs 先於 pets（唯一真 FK：pets.egg_id → eggs.id）----
ok(idx.get('eggs')! < idx.get('pets')!, 'eggs 應在 pets 之前');
// ---- users 最前 ----
ok(idx.get('users') === 0, 'users 應為第一張');

console.log(`ALL PASS (${pass} checks)`);
