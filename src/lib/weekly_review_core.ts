// 每週回顧純函數：零 import（node 可直接跑，見 scripts/verify_weekly_review.ts）。

export type WeeklyReviewData = {
  weekStartKey: string;
  weekEndKey: string;
  workoutCount: number;
  workoutDays: number;
  calorieAvg: number;
  proteinAvg: number;
  mealDays: number;
  sleepHoursAvg: number;
  sleepNights: number;
  waterDailyAvgMl: number;
};

export type WeeklySummaryInput = {
  weekStartKey: string;
  weekEndKey: string;
  /** 該週每筆訓練的 dayKey（可重複） */
  workoutDayKeys: string[];
  /** 該週每筆飲食的 dayKey（可重複） */
  mealDayKeys: string[];
  /** 該週每筆飲食的熱量（與 mealDayKeys 同源，不需對齊，只取總和） */
  mealCalories: number[];
  mealProtein: number[];
  /** 該週每個「有主睡的夜」的當夜總分鐘（分段睡已加總，一夜一筆） */
  sleepNightMinutes: number[];
  /** 該週每筆喝水的 ml */
  waterMl: number[];
};

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

export function computeWeeklySummary(input: WeeklySummaryInput): WeeklyReviewData {
  const mealDays = new Set(input.mealDayKeys).size;
  const sleepNights = input.sleepNightMinutes.length;
  return {
    weekStartKey: input.weekStartKey,
    weekEndKey: input.weekEndKey,
    workoutCount: input.workoutDayKeys.length,
    workoutDays: new Set(input.workoutDayKeys).size,
    calorieAvg: mealDays > 0 ? Math.round(sum(input.mealCalories) / mealDays) : 0,
    proteinAvg: mealDays > 0 ? Math.round(sum(input.mealProtein) / mealDays) : 0,
    mealDays,
    sleepHoursAvg: sleepNights > 0 ? Math.round((sum(input.sleepNightMinutes) / sleepNights / 60) * 10) / 10 : 0,
    sleepNights,
    waterDailyAvgMl: Math.round(sum(input.waterMl) / 7),
  };
}

/** 寵物口吻亮點標題（依序第一個命中）。回傳純文字，不含 emoji（避免與 📊 重複）。 */
export function pickHighlight(d: WeeklyReviewData): string {
  if (d.workoutDays >= 5) return `這週訓練 ${d.workoutDays} 天，超猛的！`;
  if (d.workoutCount >= 3) return `這週練了 ${d.workoutCount} 次，很穩！`;
  if (d.sleepNights >= 4 && d.sleepHoursAvg >= 7) return `睡眠均 ${d.sleepHoursAvg}h，作息顧得很好～`;
  if (d.mealDays >= 6) return `飲食 ${d.mealDays} 天都有記，超自律！`;
  if (d.waterDailyAvgMl >= 2000) return `喝水達標，${(d.waterDailyAvgMl / 1000).toFixed(1)} L／天！`;
  return '這週有動有記，繼續保持！';
}
