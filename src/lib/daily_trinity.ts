/**
 * Daily Trinity（plan v2 §4.2 Hook 2）— 動 / 食 / 息 三件事完成判定。
 */

import type { Workout, WaterLog, BowelLog, SleepLog, PeriodDay, Meal } from '@/db/schema';

export type TrinityState = {
  /** 動：今天有運動 */
  move: boolean;
  /** 食：今天有記餐 OR 喝水達 80% */
  eat: boolean;
  /** 息：今天有記睡眠/排便/月經紀錄 */
  rest: boolean;
  /** 全部完成 */
  complete: boolean;
};

export function evaluateTrinity(input: {
  todayWorkouts: Workout[];
  todayMeals: Meal[];
  todayWater: WaterLog[];
  waterGoalMl: number;
  todayBowel: BowelLog[];
  sleepLast: SleepLog | null;
  todayPeriodDays: PeriodDay[];
}): TrinityState {
  const move = input.todayWorkouts.length > 0;

  const todayWaterMl = input.todayWater.reduce((s, w) => s + w.amountMl, 0);
  const eat = input.todayMeals.length > 0 || todayWaterMl >= input.waterGoalMl * 0.8;

  // 睡眠記錄屬於今天的條件：sleepLast.dayKey == today
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const sleepDoneToday = input.sleepLast?.dayKey === todayKey;
  const rest = sleepDoneToday || input.todayBowel.length > 0 || input.todayPeriodDays.length > 0;

  return {
    move, eat, rest,
    complete: move && eat && rest,
  };
}

/** Surprise Box 獎品池 */
export const REWARD_POOL = [
  { id: 'sticker', label: '🌟 貼紙', rarity: 'common' },
  { id: 'emoji', label: '😊 表情包', rarity: 'common' },
  { id: 'exp-boost', label: '⚡ EXP +50% 加成卡', rarity: 'rare' },
  { id: 'recipe', label: '📖 食譜卡', rarity: 'common' },
  { id: 'freeze-token', label: '🛡 補課券', rarity: 'rare' },
  { id: 'pet-outfit', label: '👕 寵物服飾', rarity: 'epic' },
];

export function rollSurpriseBox(consecutiveDays: number = 0): typeof REWARD_POOL[number] {
  // 連續 7 天保底 epic
  if (consecutiveDays > 0 && consecutiveDays % 7 === 0) {
    const epics = REWARD_POOL.filter((r) => r.rarity === 'epic');
    return epics[Math.floor(Math.random() * epics.length)];
  }
  const r = Math.random();
  if (r < 0.05) {
    const epics = REWARD_POOL.filter((r) => r.rarity === 'epic');
    return epics[Math.floor(Math.random() * epics.length)] ?? REWARD_POOL[0];
  }
  if (r < 0.30) {
    const rares = REWARD_POOL.filter((r) => r.rarity === 'rare');
    return rares[Math.floor(Math.random() * rares.length)] ?? REWARD_POOL[0];
  }
  const commons = REWARD_POOL.filter((r) => r.rarity === 'common');
  return commons[Math.floor(Math.random() * commons.length)];
}
