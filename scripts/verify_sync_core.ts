import { naturalKeyOf, planReconcile, planPull, chunk } from '../src/lib/sync_core';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

// ---- naturalKeyOf ----
ok(naturalKeyOf('workouts', { started_at: 100 }) === '100', 'workouts=started_at');
ok(naturalKeyOf('meals', { logged_at: 5, meal_type: 'lunch' }) === '5|lunch', 'meals=(logged_at,meal_type)');
ok(naturalKeyOf('period_days', { day_key: '2026-07-01' }) === '2026-07-01', 'period=day_key');
ok(naturalKeyOf('achievements', { code: 'first_workout' }) === 'first_workout', 'achievements=code');
ok(naturalKeyOf('unknown_tbl', {}) === null, '未知表 → null');

// ---- 情境 1：重裝（cloud 舊 100 列 local_id 1..100；local 新 3 列 local_id 1..3 但 natural key 不同）----
// 預期：0 claim、100 orphan（0 覆蓋）——絕不能把新資料當舊資料
{
  const cloud = Array.from({ length: 100 }, (_, i) => ({ local_id: i + 1, client_uuid: null, started_at: 1000 + i }));
  const local = [
    { local_id: 1, sync_uuid: 'A', started_at: 9991 },
    { local_id: 2, sync_uuid: 'B', started_at: 9992 },
    { local_id: 3, sync_uuid: 'C', started_at: 9993 },
  ];
  const r = planReconcile('workouts', cloud, local);
  ok(r.claims.length === 0, `重裝：0 claim，實際 ${r.claims.length}`);
  ok(r.orphans.length === 100, `重裝：100 orphan，實際 ${r.orphans.length}`);
}

// ---- 情境 2：非重裝（local_id 且 natural key 都相符）→ claim 回寫 uuid ----
{
  const cloud = [{ local_id: 5, client_uuid: null, started_at: 500 }];
  const local = [{ local_id: 5, sync_uuid: 'U5', started_at: 500 }];
  const r = planReconcile('workouts', cloud, local);
  ok(r.claims.length === 1 && r.claims[0].syncUuid === 'U5' && r.claims[0].cloudLocalId === 5, '非重裝：claim U5');
  ok(r.orphans.length === 0, '非重裝：0 orphan');
}

// ---- 情境 2b：local_id 相同但 natural key 不同（重裝巧合）→ orphan，不 claim ----
{
  const cloud = [{ local_id: 5, client_uuid: null, started_at: 500 }];
  const local = [{ local_id: 5, sync_uuid: 'X', started_at: 888 }];
  const r = planReconcile('workouts', cloud, local);
  ok(r.claims.length === 0 && r.orphans.length === 1, 'local_id 撞但 natural key 不符 → orphan');
}

// ---- 情境 2c：natural key 多筆相符（不唯一）→ 保守當 orphan ----
{
  const cloud = [{ local_id: 5, client_uuid: null, started_at: 500 }];
  const local = [
    { local_id: 5, sync_uuid: 'X', started_at: 500 },
    { local_id: 9, sync_uuid: 'Y', started_at: 500 },
  ];
  const r = planReconcile('workouts', cloud, local);
  ok(r.claims.length === 0 && r.orphans.length === 1, '多筆相符 → 保守 orphan');
}

// ---- 情境 3：換機還原（本地空）→ 全部 pull insert ----
{
  const cloud = [
    { client_uuid: 'a', started_at: 1 },
    { client_uuid: 'b', started_at: 2 },
  ];
  const r = planPull('workouts', cloud, new Set(), []);
  ok(r.toInsert.length === 2 && r.toAdopt.length === 0, '換機：全 insert');
}

// ---- 情境 4：已有相同 uuid → 跳過 ----
{
  const cloud = [{ client_uuid: 'a', started_at: 1 }];
  const r = planPull('workouts', cloud, new Set(['a']), [{ local_id: 1, sync_uuid: 'a', started_at: 1 }]);
  ok(r.toInsert.length === 0 && r.toAdopt.length === 0, '已有 uuid → 跳過');
}

// ---- 情境 5：匯入 pre-UUID 備份後 uuid 再生 → natural key adopt（零重複）----
{
  const cloud = [{ client_uuid: 'cloudUuid', started_at: 777 }];
  const local = [{ local_id: 1, sync_uuid: 'regeneratedLocal', started_at: 777 }]; // 同 natural key、不同 uuid
  const r = planPull('workouts', cloud, new Set(['regeneratedLocal']), local);
  ok(r.toInsert.length === 0, 'adopt：不插入');
  ok(r.toAdopt.length === 1 && r.toAdopt[0].cloudUuid === 'cloudUuid' && r.toAdopt[0].localSyncUuid === 'regeneratedLocal', 'adopt：過繼 uuid');
}

// ---- chunk ----
ok(JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === JSON.stringify([[1, 2], [3, 4], [5]]), 'chunk 2');
ok(chunk([], 500).length === 0, 'chunk 空 → []');
ok(JSON.stringify(chunk([1, 2], 0)) === JSON.stringify([[1, 2]]), 'chunk size 0 → 單批');

console.log(`ALL PASS (${pass} checks)`);
