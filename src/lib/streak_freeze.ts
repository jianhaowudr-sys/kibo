/**
 * Streak 2.0 補課券自動消耗（plan v2 §4.2 Hook 3）。
 *
 * 在 App bootstrap 後執行，檢查使用者上次運動是否已超過 1 天 +：
 *  - 若 lastWorkoutDate < yesterday，且 streakFreezeTokens > 0：
 *    - 「補課」把 lastWorkoutDate 推到昨天，token -1，streak 不變
 *  - 否則：streak 自然斷掉（不在這裡處理，現有邏輯下次運動才更新）
 */

import * as repo from '@/db/repo';
import * as healthRepo from '@/db/health_repo';
import type { User } from '@/db/schema';

function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function diffDays(aIso: string, b: Date): number {
  const a = new Date(aIso + 'T00:00:00');
  const b0 = new Date(b); b0.setHours(0, 0, 0, 0);
  return Math.floor((b0.getTime() - a.getTime()) / 86400_000);
}

export type FreezeResult =
  | { used: false; reason: 'no-streak' | 'recent' | 'no-tokens' | 'too-old' }
  | { used: true; tokensLeft: number; newLastWorkoutDate: string };

/**
 * 檢查並使用補課券。回傳 used=true 表示確實救了 streak 一天。
 */
export async function tryAutoFreeze(user: User): Promise<FreezeResult> {
  if (user.streak === 0 || !user.lastWorkoutDate) return { used: false, reason: 'no-streak' };

  const today = new Date();
  const todayKey = dayKeyFromDate(today);

  // 已經是今天或昨天，不需要救
  const days = diffDays(user.lastWorkoutDate, today);
  if (days <= 1) return { used: false, reason: 'recent' };

  const tokens = await healthRepo.getStreakFreezeTokens(user.id);
  if (tokens <= 0) return { used: false, reason: 'no-tokens' };

  // 漏太多天救不回（補課券一天只能救一天）— streak 真的要斷
  if (days > 2) return { used: false, reason: 'too-old' };

  // 救援：把 lastWorkoutDate 推到昨天
  const y = new Date(today); y.setDate(y.getDate() - 1);
  const yKey = dayKeyFromDate(y);
  await repo.updateUser(user.id, { lastWorkoutDate: yKey });
  const newTokens = await healthRepo.updateStreakFreezeTokens(user.id, -1);
  return { used: true, tokensLeft: newTokens, newLastWorkoutDate: yKey };
}
