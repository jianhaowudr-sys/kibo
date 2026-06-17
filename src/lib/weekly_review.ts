import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';
import type { Pet } from '@/db/schema';
import * as repo from '@/db/repo';
import * as healthRepo from '@/db/health_repo';
import { dateKey } from '@/lib/date';
import { computeWeeklySummary, pickHighlight, type WeeklyReviewData } from '@/lib/weekly_review_core';

export type { WeeklyReviewData } from '@/lib/weekly_review_core';

const WEEK_OPTS = { weekStartsOn: 1 as const }; // 週一為週首

function weekDayKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
}

/** 撈該週原始資料，交給純函數彙整。weekStart=週一 00:00、weekEnd=週日 23:59:59.999。 */
export async function gatherWeeklyReview(userId: number, weekStart: Date, weekEnd: Date): Promise<WeeklyReviewData> {
  const startMs = +weekStart;
  const nextWeekStartMs = +addDays(weekStart, 7); // 半開區間上界

  // 訓練：ms 半開區間（避免 fetch-N-then-filter 的隱含上限）
  const weekWorkouts = await repo.listWorkoutsBetween(userId, startMs, nextWeekStartMs);
  const workoutDayKeys = weekWorkouts.map((w) => dateKey(w.startedAt));

  // 飲食：ms 半開區間
  const meals = await repo.listMealsBetween(userId, startMs, nextWeekStartMs);
  const mealDayKeys = meals.map((m) => dateKey(m.loggedAt));
  const mealCalories = meals.map((m) => m.caloriesKcal ?? 0);
  const mealProtein = meals.map((m) => m.proteinG ?? 0);

  // 睡眠：跑該週 7 個 dayKey，每天主睡分段加總，一夜一筆
  const sleepNightMinutes: number[] = [];
  for (const k of weekDayKeys(weekStart)) {
    const mains = await healthRepo.listMainSleepsByDay(userId, k);
    if (mains.length > 0) sleepNightMinutes.push(mains.reduce((s, x) => s + x.durationMin, 0));
  }

  // 喝水：ms 半開區間
  const waters = await healthRepo.listWaterBetween(userId, startMs, nextWeekStartMs);
  const waterMl = waters.map((w) => w.amountMl);

  return computeWeeklySummary({
    weekStartKey: format(weekStart, 'yyyy-MM-dd'),
    weekEndKey: format(weekEnd, 'yyyy-MM-dd'),
    workoutDayKeys,
    mealDayKeys,
    mealCalories,
    mealProtein,
    sleepNightMinutes,
    waterMl,
  });
}

/**
 * 若「上一個完整週」尚未生成回顧、且該週有活動，則生成並寫入一則 'weekly' 寵物訊息。
 * 整體 try/catch → console.warn，永不擋啟動。同週重入會被去重擋掉（冪等）。
 */
export async function maybeGenerateWeeklyReview(userId: number, pet: Pet | null): Promise<void> {
  try {
    const now = new Date();
    const weekStart = startOfWeek(subWeeks(now, 1), WEEK_OPTS);
    const weekEnd = endOfWeek(weekStart, WEEK_OPTS);
    const weekStartKey = format(weekStart, 'yyyy-MM-dd');

    // 去重：已有該週 weekly 訊息 → 跳過（category 限定查詢，不受每日/PR 訊息量影響）
    const existingWeekly = await healthRepo.listPetMessagesByCategory(userId, 'weekly', 8);
    const dupe = existingWeekly.some((m) => {
      if (!m.triggerData) return false;
      try {
        return (JSON.parse(m.triggerData) as WeeklyReviewData).weekStartKey === weekStartKey;
      } catch {
        return false;
      }
    });
    if (dupe) return;

    const data = await gatherWeeklyReview(userId, weekStart, weekEnd);

    // 空週守衛：全無活動 → 不生
    if (data.workoutCount === 0 && data.mealDays === 0 && data.sleepNights === 0 && data.waterDailyAvgMl === 0) {
      return;
    }

    await healthRepo.addPetMessage({
      userId,
      petId: pet?.id ?? null,
      generatedAt: now,
      category: 'weekly',
      text: pickHighlight(data),
      read: 0,
      triggerData: JSON.stringify(data),
    });
  } catch (e) {
    console.warn('[weekly] 生成失敗', e);
  }
}
