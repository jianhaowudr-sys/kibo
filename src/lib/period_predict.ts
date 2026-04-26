/**
 * 月經週期預測（plan v2 §4.1）。純函數，無副作用。
 */

import type { PeriodDay } from '@/db/schema';

export type CyclePrediction = {
  /** 目前是否在經期中（最近一次 cycle start + avgPeriodDays 內） */
  isOnPeriod: boolean;
  /** 經期中的話，是第幾天（1-based）；不在則 null */
  dayOfPeriod: number | null;
  /** 上次 cycle start 是哪天 ms；無則 null */
  lastStartMs: number | null;
  /** 下次經期預估開始日 ms；資料不足則 null */
  predictedNextMs: number | null;
  /** 下次經期還有幾天；資料不足則 null */
  daysUntilNext: number | null;
  /** 距離預估期前 PMS 視窗（< 2 天）內 */
  isPmsWindow: boolean;
  /** 累積已知週期數（決定預測信心） */
  cyclesKnown: number;
  /** 平均週期天數（cyclesKnown >= 3 才用實際；否則用預設） */
  avgCycleDays: number;
};

export function computeCyclePrediction(
  days: PeriodDay[],
  defaults: { avgCycleDays: number; avgPeriodDays: number },
): CyclePrediction {
  // 找所有 cycle start 並依時間排
  const starts = days
    .filter((d) => d.isCycleStart)
    .map((d) => d.date.getTime())
    .sort((a, b) => a - b);

  if (starts.length === 0) {
    return {
      isOnPeriod: false,
      dayOfPeriod: null,
      lastStartMs: null,
      predictedNextMs: null,
      daysUntilNext: null,
      isPmsWindow: false,
      cyclesKnown: 0,
      avgCycleDays: defaults.avgCycleDays,
    };
  }

  const cyclesKnown = Math.max(0, starts.length - 1);
  // 累積 3+ 完整週期才用實測
  let avgCycle = defaults.avgCycleDays;
  if (cyclesKnown >= 3) {
    const intervals: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      intervals.push((starts[i] - starts[i - 1]) / 86400_000);
    }
    intervals.sort((a, b) => a - b);
    const median = intervals[Math.floor(intervals.length / 2)];
    if (median >= 21 && median <= 45) avgCycle = Math.round(median);
  }

  const lastStartMs = starts[starts.length - 1];
  const now = Date.now();
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);

  // 是否在經期中
  const dayOfPeriod = Math.floor((today0.getTime() - lastStartMs) / 86400_000) + 1;
  const isOnPeriod = dayOfPeriod >= 1 && dayOfPeriod <= defaults.avgPeriodDays;

  const predictedNextMs = lastStartMs + avgCycle * 86400_000;
  const daysUntilNext = Math.ceil((predictedNextMs - now) / 86400_000);
  const isPmsWindow = daysUntilNext > 0 && daysUntilNext <= 2;

  return {
    isOnPeriod,
    dayOfPeriod: isOnPeriod ? dayOfPeriod : null,
    lastStartMs,
    predictedNextMs,
    daysUntilNext,
    isPmsWindow,
    cyclesKnown,
    avgCycleDays: avgCycle,
  };
}
