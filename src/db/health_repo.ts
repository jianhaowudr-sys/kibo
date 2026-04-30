/**
 * 健康四模組（喝水/排便/睡眠/月經）的 SQLite repo。
 * 配合 useAppStore 的 mutation methods 使用。
 */

import { sqliteDb } from './client';
import { enqueueRemoteDelete } from './repo';
import type {
  WaterLog, NewWaterLog,
  BowelLog, NewBowelLog,
  SleepLog, NewSleepLog,
  PeriodDay, NewPeriodDay,
  PetMessage, NewPetMessage,
} from './schema';

const ROW2WATER = (r: any): WaterLog => ({
  id: r.id, userId: r.user_id, amountMl: r.amount_ml,
  loggedAt: new Date(r.logged_at), batchKey: r.batch_key,
  createdAt: new Date(r.created_at),
});
const ROW2BOWEL = (r: any): BowelLog => ({
  id: r.id, userId: r.user_id, loggedAt: new Date(r.logged_at),
  bristol: r.bristol, hasBlood: r.has_blood, hasPain: r.has_pain,
  notes: r.notes, createdAt: new Date(r.created_at),
});
const ROW2SLEEP = (r: any): SleepLog => ({
  id: r.id, userId: r.user_id,
  bedtimeAt: new Date(r.bedtime_at), wakeAt: new Date(r.wake_at),
  durationMin: r.duration_min, quality: r.quality,
  dayKey: r.day_key,
  kind: (r.kind as 'main' | 'nap') ?? 'main',
  assignedDayKey: r.assigned_day_key ?? r.day_key,
  createdAt: new Date(r.created_at),
});
const ROW2PERIOD = (r: any): PeriodDay => ({
  id: r.id, userId: r.user_id, date: new Date(r.date),
  dayKey: r.day_key, flow: r.flow, symptomsJson: r.symptoms_json,
  notes: r.notes, isCycleStart: r.is_cycle_start,
  createdAt: new Date(r.created_at),
});
const ROW2PETMSG = (r: any): PetMessage => ({
  id: r.id, userId: r.user_id, petId: r.pet_id,
  generatedAt: new Date(r.generated_at), category: r.category,
  text: r.text, read: r.read, triggerData: r.trigger_data,
});

// ===== Water =====

export async function addWater(data: { userId: number; amountMl: number; loggedAt?: number; batchKey?: string }): Promise<number> {
  const now = Date.now();
  const r = await sqliteDb.runAsync(
    `INSERT INTO water_logs (user_id, amount_ml, logged_at, batch_key, created_at) VALUES (?, ?, ?, ?, ?)`,
    [data.userId, data.amountMl, data.loggedAt ?? now, data.batchKey ?? null, now],
  );
  return Number(r.lastInsertRowId);
}

export async function listWaterToday(userId: number): Promise<WaterLog[]> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM water_logs WHERE user_id = ? AND logged_at >= ? ORDER BY logged_at DESC`,
    [userId, start.getTime()],
  );
  return rows.map(ROW2WATER);
}

export async function listWaterBetween(userId: number, fromMs: number, toMs: number): Promise<WaterLog[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM water_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC`,
    [userId, fromMs, toMs],
  );
  return rows.map(ROW2WATER);
}

export async function deleteWater(id: number): Promise<void> {
  await enqueueRemoteDelete('water_logs', id);
  await sqliteDb.runAsync(`DELETE FROM water_logs WHERE id = ?`, [id]);
}

export async function deleteWaterBatch(batchKey: string): Promise<number[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT id FROM water_logs WHERE batch_key = ?`,
    [batchKey],
  );
  for (const r of rows) await enqueueRemoteDelete('water_logs', r.id as number);
  await sqliteDb.runAsync(`DELETE FROM water_logs WHERE batch_key = ?`, [batchKey]);
  return rows.map((r) => r.id as number);
}

export async function dailyWaterSeries(userId: number, startMs: number, endMs: number): Promise<{ dateKey: string; totalMl: number }[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT date(logged_at / 1000, 'unixepoch', 'localtime') as d, SUM(amount_ml) as total
     FROM water_logs WHERE user_id = ? AND logged_at BETWEEN ? AND ?
     GROUP BY d ORDER BY d ASC`,
    [userId, startMs, endMs],
  );
  return rows.map((r) => ({ dateKey: r.d, totalMl: r.total ?? 0 }));
}

export async function dailyBowelSeries(userId: number, startMs: number, endMs: number): Promise<{ dateKey: string; count: number }[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT date(logged_at / 1000, 'unixepoch', 'localtime') as d, COUNT(*) as c
     FROM bowel_logs WHERE user_id = ? AND logged_at BETWEEN ? AND ?
     GROUP BY d ORDER BY d ASC`,
    [userId, startMs, endMs],
  );
  return rows.map((r) => ({ dateKey: r.d, count: r.c ?? 0 }));
}

/**
 * 主睡 + 小睡每日總時長
 */
export async function dailySleepSeries(userId: number, startMs: number, endMs: number): Promise<{ dateKey: string; mainMin: number; napMin: number }[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT assigned_day_key as d,
       SUM(CASE WHEN kind = 'main' THEN duration_min ELSE 0 END) as main_min,
       SUM(CASE WHEN kind = 'nap' THEN duration_min ELSE 0 END) as nap_min
     FROM sleep_logs
     WHERE user_id = ? AND wake_at BETWEEN ? AND ?
     GROUP BY d ORDER BY d ASC`,
    [userId, startMs, endMs],
  );
  return rows.map((r) => ({ dateKey: r.d, mainMin: r.main_min ?? 0, napMin: r.nap_min ?? 0 }));
}

export async function rangeWaterSummary(userId: number, startMs: number, endMs: number): Promise<{
  count: number; uniqueDays: number; totalMl: number; avgMlPerDay: number;
}> {
  const r = await sqliteDb.getFirstAsync<any>(
    `SELECT COUNT(*) as c,
       COUNT(DISTINCT date(logged_at / 1000, 'unixepoch', 'localtime')) as ud,
       COALESCE(SUM(amount_ml), 0) as ml
     FROM water_logs WHERE user_id = ? AND logged_at BETWEEN ? AND ?`,
    [userId, startMs, endMs],
  );
  const days = Math.max(1, r?.ud ?? 0);
  return {
    count: r?.c ?? 0,
    uniqueDays: r?.ud ?? 0,
    totalMl: r?.ml ?? 0,
    avgMlPerDay: Math.round((r?.ml ?? 0) / days),
  };
}

// ===== Bowel =====

export async function addBowel(data: {
  userId: number; loggedAt?: number;
  bristol?: number; hasBlood?: number; hasPain?: number; notes?: string;
}): Promise<number> {
  const now = Date.now();
  const r = await sqliteDb.runAsync(
    `INSERT INTO bowel_logs (user_id, logged_at, bristol, has_blood, has_pain, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.userId, data.loggedAt ?? now, data.bristol ?? 4, data.hasBlood ?? 0, data.hasPain ?? 0, data.notes ?? null, now],
  );
  return Number(r.lastInsertRowId);
}

export async function listBowelToday(userId: number): Promise<BowelLog[]> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM bowel_logs WHERE user_id = ? AND logged_at >= ? ORDER BY logged_at DESC`,
    [userId, start.getTime()],
  );
  return rows.map(ROW2BOWEL);
}

export async function listBowelBetween(userId: number, fromMs: number, toMs: number): Promise<BowelLog[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM bowel_logs WHERE user_id = ? AND logged_at >= ? AND logged_at < ? ORDER BY logged_at DESC`,
    [userId, fromMs, toMs],
  );
  return rows.map(ROW2BOWEL);
}

export async function updateBowel(id: number, patch: Partial<NewBowelLog>): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  if (patch.bristol !== undefined) { fields.push('bristol = ?'); values.push(patch.bristol); }
  if (patch.hasBlood !== undefined) { fields.push('has_blood = ?'); values.push(patch.hasBlood); }
  if (patch.hasPain !== undefined) { fields.push('has_pain = ?'); values.push(patch.hasPain); }
  if (patch.notes !== undefined) { fields.push('notes = ?'); values.push(patch.notes); }
  if (fields.length === 0) return;
  values.push(id);
  await sqliteDb.runAsync(`UPDATE bowel_logs SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteBowel(id: number): Promise<void> {
  await enqueueRemoteDelete('bowel_logs', id);
  await sqliteDb.runAsync(`DELETE FROM bowel_logs WHERE id = ?`, [id]);
}

export async function rangeBowelSummary(userId: number, startMs: number, endMs: number): Promise<{
  count: number; uniqueDays: number;
  bristolDist: Record<number, number>;
  bloodCount: number; painCount: number;
  avgBristol: number | null;
}> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT bristol, has_blood, has_pain, logged_at FROM bowel_logs
     WHERE user_id = ? AND logged_at BETWEEN ? AND ?`,
    [userId, startMs, endMs],
  );
  const days = new Set<string>();
  const bristolDist: Record<number, number> = {};
  let bloodCount = 0; let painCount = 0; let bristolSum = 0; let bristolN = 0;
  for (const r of rows) {
    const d = new Date(r.logged_at);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    if (r.bristol) {
      bristolDist[r.bristol] = (bristolDist[r.bristol] ?? 0) + 1;
      bristolSum += r.bristol; bristolN++;
    }
    if (r.has_blood) bloodCount++;
    if (r.has_pain) painCount++;
  }
  return {
    count: rows.length,
    uniqueDays: days.size,
    bristolDist,
    bloodCount, painCount,
    avgBristol: bristolN > 0 ? Math.round((bristolSum / bristolN) * 10) / 10 : null,
  };
}

// ===== Sleep =====

function dayKeyFromTs(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * 主睡的歸日：用「睡眠中點」決定，比起 wakeAt 更能正確處理夜班/早上睡晚上起。
 *
 * - 23:30 → 06:30：中點 03:00 → 起床日 ✓
 * - 04:00 → 12:00：中點 08:00 → 起床日 ✓（白天主睡）
 * - 07:00 (早) → 19:00 (晚)：中點 13:00 → 同一天（夜班正確）
 */
function assignedDayKeyForMain(bedtimeAt: number, wakeAt: number): string {
  const mid = Math.round((bedtimeAt + wakeAt) / 2);
  return dayKeyFromTs(mid);
}

/**
 * 主睡：同一個 assignedDayKey 已有主睡 → 視為同一筆覆寫；否則新增。
 * 同天可允許多筆主睡（用 source: 'addNew' 強制新增）。
 */
export async function upsertSleep(data: {
  userId: number; bedtimeAt: number; wakeAt: number;
  quality?: number;
  forceNew?: boolean;
}): Promise<number> {
  const adk = assignedDayKeyForMain(data.bedtimeAt, data.wakeAt);
  const durationMin = Math.max(0, Math.round((data.wakeAt - data.bedtimeAt) / 60000));
  if (!data.forceNew) {
    const existing = await sqliteDb.getFirstAsync<{ id: number }>(
      `SELECT id FROM sleep_logs WHERE user_id = ? AND kind = 'main' AND assigned_day_key = ?
       ORDER BY created_at DESC LIMIT 1`,
      [data.userId, adk],
    );
    if (existing) {
      await sqliteDb.runAsync(
        `UPDATE sleep_logs SET bedtime_at = ?, wake_at = ?, duration_min = ?, quality = ?, day_key = ?, assigned_day_key = ? WHERE id = ?`,
        [data.bedtimeAt, data.wakeAt, durationMin, data.quality ?? 3, dayKeyFromTs(data.wakeAt), adk, existing.id],
      );
      return existing.id;
    }
  }
  const now = Date.now();
  const r = await sqliteDb.runAsync(
    `INSERT INTO sleep_logs (user_id, bedtime_at, wake_at, duration_min, quality, day_key, kind, assigned_day_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'main', ?, ?)`,
    [data.userId, data.bedtimeAt, data.wakeAt, durationMin, data.quality ?? 3, dayKeyFromTs(data.wakeAt), adk, now],
  );
  return Number(r.lastInsertRowId);
}

/**
 * 小睡：永遠新增一筆，assignedDayKey = bedtime 的 dayKey。
 */
export async function addNap(data: {
  userId: number; bedtimeAt: number; wakeAt: number;
  quality?: number;
}): Promise<number> {
  const adk = dayKeyFromTs(data.bedtimeAt);
  const durationMin = Math.max(0, Math.round((data.wakeAt - data.bedtimeAt) / 60000));
  const now = Date.now();
  const r = await sqliteDb.runAsync(
    `INSERT INTO sleep_logs (user_id, bedtime_at, wake_at, duration_min, quality, day_key, kind, assigned_day_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'nap', ?, ?)`,
    [data.userId, data.bedtimeAt, data.wakeAt, durationMin, data.quality ?? 3, dayKeyFromTs(data.bedtimeAt), adk, now],
  );
  return Number(r.lastInsertRowId);
}

export async function listNapsByDay(userId: number, dayKey: string): Promise<SleepLog[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM sleep_logs WHERE user_id = ? AND kind = 'nap' AND assigned_day_key = ?
     ORDER BY bedtime_at ASC`,
    [userId, dayKey],
  );
  return rows.map(ROW2SLEEP);
}

export async function listMainSleepsByDay(userId: number, dayKey: string): Promise<SleepLog[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM sleep_logs WHERE user_id = ? AND kind = 'main' AND assigned_day_key = ?
     ORDER BY wake_at DESC`,
    [userId, dayKey],
  );
  return rows.map(ROW2SLEEP);
}

export async function getSleepLast(userId: number): Promise<SleepLog | null> {
  const r = await sqliteDb.getFirstAsync<any>(
    `SELECT * FROM sleep_logs WHERE user_id = ? AND kind = 'main' ORDER BY wake_at DESC LIMIT 1`,
    [userId],
  );
  return r ? ROW2SLEEP(r) : null;
}

export async function getSleepByDay(userId: number, dayKey: string): Promise<SleepLog | null> {
  // 取該 assignedDayKey 的最新主睡（同天可能多筆主睡，這個函式回主要那筆）
  const r = await sqliteDb.getFirstAsync<any>(
    `SELECT * FROM sleep_logs WHERE user_id = ? AND kind = 'main' AND assigned_day_key = ?
     ORDER BY wake_at DESC LIMIT 1`,
    [userId, dayKey],
  );
  return r ? ROW2SLEEP(r) : null;
}

export async function listSleepRecent(userId: number, days: number): Promise<SleepLog[]> {
  const cutoff = Date.now() - days * 86400_000;
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM sleep_logs WHERE user_id = ? AND wake_at >= ? ORDER BY wake_at DESC`,
    [userId, cutoff],
  );
  return rows.map(ROW2SLEEP);
}

export async function rangeSleepSummary(userId: number, startMs: number, endMs: number): Promise<{
  count: number; totalMin: number; avgMin: number | null;
  avgQuality: number | null;
  shortest: number | null; longest: number | null;
  napCount: number; napTotalMin: number;
}> {
  const r = await sqliteDb.getFirstAsync<any>(
    `SELECT COUNT(*) as c,
       COALESCE(SUM(duration_min), 0) as total,
       COALESCE(AVG(duration_min), 0) as avg,
       COALESCE(AVG(quality), 0) as q,
       MIN(duration_min) as mn,
       MAX(duration_min) as mx
     FROM sleep_logs WHERE user_id = ? AND kind = 'main' AND wake_at BETWEEN ? AND ?`,
    [userId, startMs, endMs],
  );
  const napR = await sqliteDb.getFirstAsync<any>(
    `SELECT COUNT(*) as c, COALESCE(SUM(duration_min), 0) as total
     FROM sleep_logs WHERE user_id = ? AND kind = 'nap' AND wake_at BETWEEN ? AND ?`,
    [userId, startMs, endMs],
  );
  const c = r?.c ?? 0;
  return {
    count: c,
    totalMin: r?.total ?? 0,
    avgMin: c > 0 ? Math.round(r?.avg ?? 0) : null,
    avgQuality: c > 0 ? Math.round((r?.q ?? 0) * 10) / 10 : null,
    shortest: c > 0 ? r?.mn ?? null : null,
    longest: c > 0 ? r?.mx ?? null : null,
    napCount: napR?.c ?? 0,
    napTotalMin: napR?.total ?? 0,
  };
}

export async function deleteSleep(id: number): Promise<void> {
  await enqueueRemoteDelete('sleep_logs', id);
  await sqliteDb.runAsync(`DELETE FROM sleep_logs WHERE id = ?`, [id]);
}

// ===== Period =====

export async function upsertPeriodDay(data: {
  userId: number; date: number; flow?: string;
  symptoms?: string[]; notes?: string; isCycleStart?: number;
}): Promise<number> {
  const dayKey = dayKeyFromTs(data.date);
  const existing = await sqliteDb.getFirstAsync<{ id: number }>(
    `SELECT id FROM period_days WHERE user_id = ? AND day_key = ?`,
    [data.userId, dayKey],
  );
  const symptomsJson = data.symptoms ? JSON.stringify(data.symptoms) : null;
  if (existing) {
    const fields: string[] = []; const values: any[] = [];
    if (data.flow !== undefined) { fields.push('flow = ?'); values.push(data.flow); }
    if (symptomsJson !== null) { fields.push('symptoms_json = ?'); values.push(symptomsJson); }
    if (data.notes !== undefined) { fields.push('notes = ?'); values.push(data.notes); }
    if (data.isCycleStart !== undefined) { fields.push('is_cycle_start = ?'); values.push(data.isCycleStart); }
    if (fields.length > 0) {
      values.push(existing.id);
      await sqliteDb.runAsync(`UPDATE period_days SET ${fields.join(', ')} WHERE id = ?`, values);
    }
    return existing.id;
  }
  const now = Date.now();
  const r = await sqliteDb.runAsync(
    `INSERT INTO period_days (user_id, date, day_key, flow, symptoms_json, notes, is_cycle_start, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.userId, data.date, dayKey, data.flow ?? 'medium', symptomsJson, data.notes ?? null, data.isCycleStart ?? 0, now],
  );
  return Number(r.lastInsertRowId);
}

export async function listPeriodDays(userId: number, limitDays: number = 90): Promise<PeriodDay[]> {
  const cutoff = Date.now() - limitDays * 86400_000;
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM period_days WHERE user_id = ? AND date >= ? ORDER BY date DESC`,
    [userId, cutoff],
  );
  return rows.map(ROW2PERIOD);
}

export async function getCurrentCycleDays(userId: number): Promise<PeriodDay[]> {
  const all = await listPeriodDays(userId, 90);
  // 找最近一次 isCycleStart=1，且該天起算之後連續日（最多 14 天，間隔 > 1 天就停）
  const sorted = all.sort((a, b) => a.date.getTime() - b.date.getTime());
  let lastStart = -1;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].isCycleStart) { lastStart = i; break; }
  }
  if (lastStart < 0) return [];
  const result: PeriodDay[] = [sorted[lastStart]];
  for (let i = lastStart + 1; i < sorted.length; i++) {
    const prevDay = result[result.length - 1].date.getTime();
    const cur = sorted[i].date.getTime();
    if (cur - prevDay > 86400_000 * 1.5) break;
    result.push(sorted[i]);
  }
  return result;
}

export async function deletePeriodDay(id: number): Promise<void> {
  await enqueueRemoteDelete('period_days', id);
  await sqliteDb.runAsync(`DELETE FROM period_days WHERE id = ?`, [id]);
}

// ===== Trinity / Inventory =====

export async function getTrinityToday(userId: number): Promise<any | null> {
  const today = new Date();
  const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const r = await sqliteDb.getFirstAsync<any>(
    `SELECT * FROM trinity_completions WHERE user_id = ? AND day_key = ?`,
    [userId, dayKey],
  );
  return r;
}

export async function recordTrinityCompletion(data: {
  userId: number;
  rewardId: string;
  rewardLabel: string;
  rewardRarity: string;
  consecutiveDays: number;
}): Promise<number> {
  const today = new Date();
  const dayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const r = await sqliteDb.runAsync(
    `INSERT INTO trinity_completions (user_id, day_key, reward_id, reward_label, reward_rarity, consecutive_days, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.userId, dayKey, data.rewardId, data.rewardLabel, data.rewardRarity, data.consecutiveDays, Date.now()],
  );
  return Number(r.lastInsertRowId);
}

export async function countTrinityConsecutive(userId: number): Promise<number> {
  // 從今天往回數連續 dayKey
  const rows = await sqliteDb.getAllAsync<{ day_key: string }>(
    `SELECT day_key FROM trinity_completions WHERE user_id = ? ORDER BY day_key DESC LIMIT 30`,
    [userId],
  );
  if (rows.length === 0) return 0;
  let count = 0;
  const expected = new Date();
  for (const row of rows) {
    const ek = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, '0')}-${String(expected.getDate()).padStart(2, '0')}`;
    if (row.day_key !== ek) break;
    count++;
    expected.setDate(expected.getDate() - 1);
  }
  return count;
}

export async function addInventoryItem(data: {
  userId: number; itemId: string; itemLabel: string; rarity: string; source?: string;
}): Promise<number> {
  const r = await sqliteDb.runAsync(
    `INSERT INTO pet_inventory (user_id, item_id, item_label, rarity, acquired_at, source) VALUES (?, ?, ?, ?, ?, ?)`,
    [data.userId, data.itemId, data.itemLabel, data.rarity, Date.now(), data.source ?? null],
  );
  return Number(r.lastInsertRowId);
}

export async function listInventory(userId: number): Promise<any[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM pet_inventory WHERE user_id = ? ORDER BY acquired_at DESC`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id, userId: r.user_id, itemId: r.item_id, itemLabel: r.item_label,
    rarity: r.rarity, acquiredAt: new Date(r.acquired_at), source: r.source,
  }));
}

// ===== Pet Messages =====

export async function addPetMessage(data: NewPetMessage): Promise<number> {
  const r = await sqliteDb.runAsync(
    `INSERT INTO pet_messages (user_id, pet_id, generated_at, category, text, read, trigger_data) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.userId, data.petId ?? null, +data.generatedAt, data.category, data.text, data.read ?? 0, data.triggerData ?? null],
  );
  return Number(r.lastInsertRowId);
}

export async function listPetMessages(userId: number, limit: number = 30): Promise<PetMessage[]> {
  const rows = await sqliteDb.getAllAsync<any>(
    `SELECT * FROM pet_messages WHERE user_id = ? ORDER BY generated_at DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(ROW2PETMSG);
}

export async function markPetMessageRead(id: number): Promise<void> {
  await sqliteDb.runAsync(`UPDATE pet_messages SET read = 1 WHERE id = ?`, [id]);
}

export async function markAllPetMessagesRead(userId: number): Promise<void> {
  await sqliteDb.runAsync(`UPDATE pet_messages SET read = 1 WHERE user_id = ?`, [userId]);
}

// ===== users JSON 設定欄 =====

export async function getHealthSettings(userId: number): Promise<string | null> {
  const r = await sqliteDb.getFirstAsync<{ health_settings: string | null }>(
    `SELECT health_settings FROM users WHERE id = ?`,
    [userId],
  );
  return r?.health_settings ?? null;
}

export async function setHealthSettings(userId: number, json: string): Promise<void> {
  await sqliteDb.runAsync(`UPDATE users SET health_settings = ? WHERE id = ?`, [json, userId]);
}

export async function getDashboardLayout(userId: number): Promise<string | null> {
  const r = await sqliteDb.getFirstAsync<{ dashboard_layout: string | null }>(
    `SELECT dashboard_layout FROM users WHERE id = ?`,
    [userId],
  );
  return r?.dashboard_layout ?? null;
}

export async function setDashboardLayout(userId: number, json: string): Promise<void> {
  await sqliteDb.runAsync(`UPDATE users SET dashboard_layout = ? WHERE id = ?`, [json, userId]);
}

export async function getStreakFreezeTokens(userId: number): Promise<number> {
  const r = await sqliteDb.getFirstAsync<{ streak_freeze_tokens: number }>(
    `SELECT streak_freeze_tokens FROM users WHERE id = ?`,
    [userId],
  );
  return r?.streak_freeze_tokens ?? 0;
}

export async function updateStreakFreezeTokens(userId: number, delta: number): Promise<number> {
  await sqliteDb.runAsync(
    `UPDATE users SET streak_freeze_tokens = MAX(0, MIN(3, streak_freeze_tokens + ?)) WHERE id = ?`,
    [delta, userId],
  );
  return getStreakFreezeTokens(userId);
}

export async function setOnboardingCompleted(userId: number): Promise<void> {
  await sqliteDb.runAsync(`UPDATE users SET onboarding_completed_at = ? WHERE id = ?`, [Date.now(), userId]);
}
