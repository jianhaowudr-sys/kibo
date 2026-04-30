/**
 * 解放健力百分比引擎（v1.0.2）
 *
 * 設計目標：
 * - 生活紀錄為主，沒運動只記錄也能 60-70% 一週
 * - 完整 4 天紀錄 → 一週孵一顆蛋
 * - 運動是 bonus 加速到 80-100%
 *
 * 加分公式（每天上限）：
 *   meal +3% / 餐 (上限 9% / 天)
 *   sleep +5% / 主睡 (上限 5% / 天)
 *   nap +1% / 小睡 (上限 2% / 天)
 *   body +6% (上限 6% / 天)
 *   water +3%（達標才給）(上限 3% / 天)
 *   bowel +2% (上限 2% / 天)
 *   workout：重訓 +10% / 有氧 +8% / 柔軟 +5%（不限上限，bonus）
 *
 * 連續簽到 (one-shot)：
 *   7 天 +3%、14 天 +5%、30 天 +10%（保底下顆稀有度）
 */

import { sqliteDb } from '@/db/client';
import type { ScoreSource, EggRarity } from '@/db/schema';

// ===== 加分上限 =====
const PER_DAY_CAP: Record<ScoreSource, number> = {
  meal: 9,
  workout: 999,    // 不限
  sleep: 5,
  body: 6,
  water: 3,
  bowel: 2,
  nap: 2,
  streak: 999,
};

const PER_EVENT: Record<ScoreSource, number> = {
  meal: 3,
  workout: 0,      // 由 workout subtype 決定
  sleep: 5,
  body: 6,
  water: 3,        // 達標才給；外部判斷後直接送 3
  bowel: 2,
  nap: 1,
  streak: 0,       // 由連續天數決定
};

export type WorkoutKind = 'strength' | 'cardio' | 'flex';

const WORKOUT_BONUS: Record<WorkoutKind, number> = {
  strength: 10,
  cardio: 8,
  flex: 5,
};

const STREAK_REWARDS: { days: number; pct: number; rarityFloor?: EggRarity }[] = [
  { days: 7, pct: 3 },
  { days: 14, pct: 5 },
  { days: 30, pct: 10, rarityFloor: 'rare' },
];

function dayKeyFromTs(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function todayKey(): string {
  return dayKeyFromTs(Date.now());
}

export async function pointsAddedToday(userId: number, source: ScoreSource): Promise<number> {
  const dk = todayKey();
  const r = await sqliteDb.getFirstAsync<{ p: number | null }>(
    `SELECT COALESCE(SUM(points), 0) as p FROM daily_scores
     WHERE user_id = ? AND day_key = ? AND source = ?`,
    [userId, dk, source],
  );
  return r?.p ?? 0;
}

export async function totalPointsToday(userId: number): Promise<number> {
  const dk = todayKey();
  const r = await sqliteDb.getFirstAsync<{ p: number | null }>(
    `SELECT COALESCE(SUM(points), 0) as p FROM daily_scores
     WHERE user_id = ? AND day_key = ?`,
    [userId, dk],
  );
  return r?.p ?? 0;
}

export type GrantResult = {
  pointsGranted: number;     // 實際加到蛋的分數（已扣上限）
  capHit: boolean;           // 該 source 今日是否已達上限
  newLiberationPct: number;  // 蛋的新進度
  hatched: boolean;          // 是否孵化
  hatchEggId?: number;
};

/**
 * 對當前活躍蛋加分。回傳實際加到的分數（被上限截斷的不算）。
 */
export async function addLiberationPoints(
  userId: number,
  source: ScoreSource,
  basePoints: number,
  sourceId?: number | null,
): Promise<GrantResult> {
  const cap = PER_DAY_CAP[source];
  const already = source === 'workout' || source === 'streak' ? 0 : await pointsAddedToday(userId, source);
  const remaining = Math.max(0, cap - already);
  const granted = Math.min(basePoints, remaining);
  const capHit = granted < basePoints;

  const dk = todayKey();
  const now = Date.now();

  if (granted > 0) {
    await sqliteDb.runAsync(
      `INSERT INTO daily_scores (user_id, day_key, source, source_id, points, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, dk, source, sourceId ?? null, granted, now],
    );
  }

  // 找當前活躍蛋（liberation_pct < 100 且未 hatch）
  const activeEgg = await sqliteDb.getFirstAsync<{ id: number; liberation_pct: number; target_pct: number }>(
    `SELECT id, liberation_pct, target_pct FROM eggs
     WHERE user_id = ? AND hatched_at IS NULL AND is_legacy = 0
     ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );

  if (!activeEgg) {
    return {
      pointsGranted: granted,
      capHit,
      newLiberationPct: 0,
      hatched: false,
    };
  }

  const newPct = Math.min(activeEgg.target_pct, activeEgg.liberation_pct + granted);
  const hatched = newPct >= activeEgg.target_pct;

  await sqliteDb.runAsync(
    `UPDATE eggs SET liberation_pct = ? WHERE id = ?`,
    [newPct, activeEgg.id],
  );

  return {
    pointsGranted: granted,
    capHit,
    newLiberationPct: newPct,
    hatched,
    hatchEggId: hatched ? activeEgg.id : undefined,
  };
}

export function workoutPointsFor(kind: WorkoutKind): number {
  return WORKOUT_BONUS[kind];
}

export const LIBERATION_PER_EVENT = PER_EVENT;
export const LIBERATION_PER_DAY_CAP = PER_DAY_CAP;

/**
 * 更新「連續簽到」: 任何紀錄都會呼叫，內部會處理當日去重。
 * - 跟昨天相比 +1，跟今天相比保持不變
 * - 隔超過 1 天 → 歸 0
 * 然後達 7/14/30 天門檻會以 streak source 加 bonus 並設下顆蛋稀有度保底。
 */
export async function tickConsecutiveDay(userId: number): Promise<{
  consecutive: number;
  streakBonusGranted: number;
  rarityFloor: EggRarity | null;
}> {
  const today = todayKey();

  const u = await sqliteDb.getFirstAsync<{ consecutive_days: number; last_active_day: string | null; next_egg_rarity_floor: string | null }>(
    `SELECT consecutive_days, last_active_day, next_egg_rarity_floor FROM users WHERE id = ?`,
    [userId],
  );

  if (!u) return { consecutive: 0, streakBonusGranted: 0, rarityFloor: null };

  if (u.last_active_day === today) {
    return { consecutive: u.consecutive_days, streakBonusGranted: 0, rarityFloor: (u.next_egg_rarity_floor as EggRarity | null) };
  }

  let newConsecutive: number;
  if (u.last_active_day) {
    const last = new Date(u.last_active_day);
    const now = new Date(today);
    const diff = Math.round((now.getTime() - last.getTime()) / 86400_000);
    newConsecutive = diff === 1 ? u.consecutive_days + 1 : 1;
  } else {
    newConsecutive = 1;
  }

  let bonusGranted = 0;
  let rarityFloor: EggRarity | null = (u.next_egg_rarity_floor as EggRarity | null);

  // 觸發里程碑（同一連續週期，每階段只觸發一次）
  for (const r of STREAK_REWARDS) {
    if (newConsecutive === r.days) {
      const grant = await addLiberationPoints(userId, 'streak', r.pct, r.days);
      bonusGranted += grant.pointsGranted;
      if (r.rarityFloor) {
        rarityFloor = r.rarityFloor;
      }
    }
  }

  await sqliteDb.runAsync(
    `UPDATE users SET consecutive_days = ?, last_active_day = ?, next_egg_rarity_floor = ? WHERE id = ?`,
    [newConsecutive, today, rarityFloor, userId],
  );

  return { consecutive: newConsecutive, streakBonusGranted: bonusGranted, rarityFloor };
}
