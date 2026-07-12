import { BACKUP_SCHEMA_VERSION, validateBackupFile, tablesToImport, planTableInsert } from '../src/lib/backup_core';
import { ALL_TABLES } from '../src/db/tables';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

// ---- validateBackupFile 版本矩陣 ----
ok(validateBackupFile(null).ok === false, 'null → 拒');
ok(validateBackupFile(42 as any).ok === false, '非物件 → 拒');
ok(validateBackupFile([] as any).ok === false, '陣列 → 拒');
ok(validateBackupFile({ schemaVersion: 4 }).ok === false, '缺 tables → 拒');
ok(validateBackupFile({ schemaVersion: 4, tables: [] as any }).ok === false, 'tables 為陣列 → 拒');
ok(validateBackupFile({ tables: {} }).ok === false, '缺 schemaVersion → 拒');
ok(validateBackupFile({ schemaVersion: 0, tables: {} }).ok === false, 'v0 → 拒');
ok(validateBackupFile({ schemaVersion: -1, tables: {} }).ok === false, 'v負 → 拒');
ok(validateBackupFile({ schemaVersion: 3, tables: {} }).ok === true, 'v3 舊檔 → 收');
ok(validateBackupFile({ schemaVersion: 4, tables: {} }).ok === true, 'v4 → 收');
ok(validateBackupFile({ schemaVersion: 5, tables: {} }).ok === false, 'v5(較新)→ 拒');
ok(BACKUP_SCHEMA_VERSION === 4, '當前版本 = 4');

// ---- tablesToImport ----
{
  const r = tablesToImport(['users', 'meals', 'water_logs'], ALL_TABLES);
  ok(r.skippedTables.length === 0, '全認識 → 無 skipped');
  // 以 registry 順序回傳（users 在 meals 在 water_logs 前）
  ok(r.tables.indexOf('users') < r.tables.indexOf('meals'), 'users 在 meals 前');
  ok(r.tables.indexOf('meals') < r.tables.indexOf('water_logs'), 'meals 在 water_logs 前');
  ok(r.tables.length === 3, '3 張');
}
{
  const r = tablesToImport(['bogus_table', 'users'], ALL_TABLES);
  ok(r.tables.length === 1 && r.tables[0] === 'users', '未知表被濾掉');
  ok(r.skippedTables.length === 1 && r.skippedTables[0] === 'bogus_table', 'bogus → skipped');
}
{
  // v3 舊檔的 11 張
  const v3 = ['users', 'exercises', 'workouts', 'workout_sets', 'eggs', 'pets', 'achievements', 'routines', 'routine_exercises', 'body_measurements', 'meals'];
  const r = tablesToImport(v3, ALL_TABLES);
  ok(r.tables.length === 11, 'v3 → 只 11 張');
  ok(!r.tables.includes('water_logs'), 'v3 不含 water_logs（其餘不動）');
  ok(r.skippedTables.length === 0, 'v3 全部認識');
}

// ---- planTableInsert ----
{
  const p = planTableInsert(['a', 'b', 'c'], ['a', 'b']);
  ok(p.columns.length === 2 && p.columns.join(',') === 'a,b', '交集 = a,b');
  ok(p.skippedColumns.length === 1 && p.skippedColumns[0] === 'c', 'c 是廢欄 → skipped');
  ok(p.sql('t') === 'INSERT INTO "t" ("a", "b") VALUES (?, ?)', 'sql 2 placeholder');
}
{
  // 檔案缺新欄 → 不列，DB 用 default
  const p = planTableInsert(['a'], ['a', 'b', 'extra']);
  ok(p.columns.length === 1 && p.columns[0] === 'a', '只插 a');
  ok(p.skippedColumns.length === 0, '無廢欄');
  ok(p.sql('t') === 'INSERT INTO "t" ("a") VALUES (?)', 'sql 1 placeholder');
}
{
  const p = planTableInsert([], ['a', 'b']);
  ok(p.columns.length === 0, '空欄 → 空');
}

console.log(`ALL PASS (${pass} checks)`);
