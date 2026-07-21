// 雲同步規劃純函數（零 import，node 可直測）。見 scripts/verify_sync_core.ts。
// 定位：本地為真相、雲端為備份+還原。用 client 端 sync_uuid 當跨裝置主鍵，取代不穩定的 local_id。

/** 各表的 natural key（reconcile/pull 防重用）。只有 period_days.day_key、achievements.code 是真唯一鍵；
 *  其餘靠 ms 時間戳，故 reconcile 採「唯一候選才 claim」策略。
 *  ⚠️ 接線注意：子表（routine_exercises/workout_sets）的 key 依賴父的 client_uuid。cloud 列已帶
 *  routine_client_uuid/workout_client_uuid；但本地 SQLite 列只有原生 FK（routine_id/workout_id），
 *  呼叫端**必須先把本地列 enrich 成帶父 uuid**（查父 sync_uuid）才能傳進來，否則兩邊 key 不會相符。
 *  verify_sync_core 目前只覆蓋父表，子表路徑待接線時補測。 */
export function naturalKeyOf(table: string, row: any): string | null {
  const j = (...vals: any[]) => vals.map((v) => (v === null || v === undefined ? '' : String(v))).join('|');
  switch (table) {
    case 'workouts': return j(row.started_at);
    case 'meals': return j(row.logged_at, row.meal_type);
    case 'body_measurements': return j(row.measured_at);
    case 'routines': return j(row.created_at, row.name);
    case 'routine_exercises': return j(row.routine_client_uuid ?? row.routine_local_id, row.order_idx);
    case 'workout_sets': return j(row.workout_client_uuid ?? row.workout_local_id, row.order_idx, row.created_at);
    case 'eggs': return j(row.created_at);
    case 'pets': return j(row.created_at);
    case 'achievements': return j(row.code);
    case 'custom_foods': return j(row.name, row.created_at);
    // created_at 一併納入：loggedAt 可由呼叫端指定（補記過去日期），
    // 補兩杯同容量到同一個時間戳會撞 key；created_at 是寫入當下的 ms，可拆開。
    case 'water_logs': return j(row.logged_at, row.amount_ml, row.created_at);
    case 'bowel_logs': return j(row.logged_at);
    case 'sleep_logs': return j(row.bedtime_at, row.wake_at);
    case 'period_days': return j(row.day_key);
    default: return null;
  }
}

export type LocalRow = { local_id: number; sync_uuid: string; [k: string]: any };
export type CloudRow = { local_id?: number; client_uuid?: string | null; [k: string]: any };

/**
 * Reconcile（首次 v1.1.0 啟動，處理雲端 client_uuid 為 null 的 legacy 列）：
 * - claim：雲端列 local_id 在本地存在，**且該本地列 natural key 與雲端相符、且本地唯一一筆相符**
 *          → 判定同一列 → 把本地 sync_uuid 回寫雲端（不覆蓋資料）。
 * - orphan：其餘（含「重裝後本地 id 重來、natural key 不符」）→ 這是重裝前的舊資料 → 匯入本地成新列。
 * 安全鐵則：絕不只靠 local_id 配對（否則重裝情境會把新資料當舊資料覆蓋，重演 P0-3）。
 */
export function planReconcile(
  table: string,
  cloudRows: CloudRow[],
  localRows: LocalRow[],
): { claims: { cloudLocalId: number; syncUuid: string }[]; orphans: CloudRow[] } {
  const byNat = new Map<string, LocalRow[]>();
  const byLocalId = new Map<number, { natKey: string | null; sync_uuid: string }>();
  for (const lr of localRows) {
    const k = naturalKeyOf(table, lr);
    if (k) { const arr = byNat.get(k) ?? []; arr.push(lr); byNat.set(k, arr); }
    byLocalId.set(lr.local_id, { natKey: k, sync_uuid: lr.sync_uuid });
  }
  const claims: { cloudLocalId: number; syncUuid: string }[] = [];
  const orphans: CloudRow[] = [];
  for (const cr of cloudRows) {
    const natKey = naturalKeyOf(table, cr);
    const sameId = cr.local_id !== undefined ? byLocalId.get(cr.local_id) : undefined;
    const candidates = natKey ? (byNat.get(natKey) ?? []) : [];
    if (sameId && natKey && sameId.natKey === natKey && candidates.length === 1) {
      claims.push({ cloudLocalId: cr.local_id!, syncUuid: sameId.sync_uuid });
    } else {
      orphans.push(cr);
    }
  }
  return { claims, orphans };
}

/**
 * Pull 規劃（雲端 → 本地，比對鍵 = client_uuid）：
 * - 已有相同 sync_uuid → 跳過。
 * - natural key 命中本地既有列（但 uuid 不同，典型：匯入 pre-UUID 備份後 uuid 被重生）→ adopt：
 *   把雲端 uuid 過繼到本地列的 sync_uuid，不插入（防重）。
 * - 其餘 → toInsert（本地新增，autoincrement 發新 local id，不指定 id）。
 */
export function planPull(
  table: string,
  cloudRows: CloudRow[],
  localSyncUuids: Set<string>,
  localRows: LocalRow[],
): { toInsert: CloudRow[]; toAdopt: { cloudUuid: string; localSyncUuid: string }[] } {
  const byNat = new Map<string, string>();
  for (const lr of localRows) {
    const k = naturalKeyOf(table, lr);
    if (k && !byNat.has(k)) byNat.set(k, lr.sync_uuid);
  }
  const toInsert: CloudRow[] = [];
  const toAdopt: { cloudUuid: string; localSyncUuid: string }[] = [];
  // 有 uuid 的先處理：否則一筆 null-uuid 列可能先吃掉候選名額，讓真正該 adopt 的列落到 insert。
  // 雲端回傳順序 Postgres 不保證，排序後結果才具決定性。
  const ordered = [...cloudRows].sort((a, b) => (a.client_uuid ? 0 : 1) - (b.client_uuid ? 0 : 1));
  // 「候選名額」(byNat，adopt 會消耗) 與「該 natural key 本地已存在」(covered，永不消耗) 必須分開：
  // 只用 byNat 的話，uuid 列 adopt 後把名額吃掉，同 natKey 的 null-uuid 列就找不到對應 → 被當新列插入 → 仍重複。
  const covered = new Set(byNat.keys());
  for (const cr of ordered) {
    const uuid = cr.client_uuid;
    if (uuid && localSyncUuids.has(uuid)) continue;
    const natKey = naturalKeyOf(table, cr);
    const localUuid = natKey ? byNat.get(natKey) : undefined;
    if (localUuid) {
      if (uuid) {
        // 佔用該本地列 → 移出候選，避免同 natural key 的第二筆又 adopt 到它（UPDATE 0 rows、靜默消失）
        byNat.delete(natKey!);
        toAdopt.push({ cloudUuid: uuid, localSyncUuid: localUuid });
      }
      continue; // null uuid + 有對應本地列 → 同筆資料，跳過
    }
    // 無可用候選：null uuid 沒有身分可辨識，若該 natural key 本地已存在就一律跳過防重
    // （它會在 reconcile 拿到 uuid 後，下一輪才以正確身分處理）。
    // 有 uuid 的列則是獨立身分 → 照插，避免資料遺失（P1-C）。
    if (!uuid && natKey && covered.has(natKey)) continue;
    toInsert.push(cr);
  }
  return { toInsert, toAdopt };
}

/** 分批（push chunk）。 */
export function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
