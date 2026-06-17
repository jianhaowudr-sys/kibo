// weekly_review_core 純函數斷言。執行：npx -y tsx scripts/verify_weekly_review.ts
import { computeWeeklySummary, pickHighlight, type WeeklySummaryInput } from '../src/lib/weekly_review_core';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok - ${name}`);
}

const base: WeeklySummaryInput = {
  weekStartKey: '2026-06-08', weekEndKey: '2026-06-14',
  workoutDayKeys: [], mealDayKeys: [], mealCalories: [], mealProtein: [],
  sleepNightMinutes: [], waterMl: [],
};

// computeWeeklySummary
{
  const r = computeWeeklySummary(base);
  check('空輸入 → 全 0 且保留 keys',
    r.workoutCount === 0 && r.workoutDays === 0 && r.calorieAvg === 0 && r.proteinAvg === 0 &&
    r.mealDays === 0 && r.sleepHoursAvg === 0 && r.sleepNights === 0 && r.waterDailyAvgMl === 0 &&
    r.weekStartKey === '2026-06-08' && r.weekEndKey === '2026-06-14');
}
{
  const r = computeWeeklySummary({ ...base, workoutDayKeys: ['2026-06-09', '2026-06-09', '2026-06-11'] });
  check('訓練 → count=次數, days=不重複天', r.workoutCount === 3 && r.workoutDays === 2);
}
{
  const r = computeWeeklySummary({ ...base, mealDayKeys: ['d1', 'd1', 'd2'], mealCalories: [600, 300, 800], mealProtein: [20, 10, 30] });
  check('熱量均 ÷ 有記錄天數', r.mealDays === 2 && r.calorieAvg === 850 && r.proteinAvg === 30);
}
{
  const r = computeWeeklySummary({ ...base, mealDayKeys: [], mealCalories: [], mealProtein: [] });
  check('mealDays=0 → 不除零', r.calorieAvg === 0 && r.proteinAvg === 0);
}
{
  const r = computeWeeklySummary({ ...base, sleepNightMinutes: [420, 480] });
  check('睡眠均 = 各夜時數平均', r.sleepNights === 2 && r.sleepHoursAvg === 7.5);
}
{
  const r = computeWeeklySummary({ ...base, sleepNightMinutes: [] });
  check('sleepNights=0 → sleepHoursAvg 0', r.sleepHoursAvg === 0);
}
{
  const r = computeWeeklySummary({ ...base, waterMl: [2000, 2000, 3000] });
  check('喝水均 = 總量 ÷ 7', r.waterDailyAvgMl === 1000);
}

// pickHighlight（依序第一個命中）
const dataFor = (over: Partial<ReturnType<typeof computeWeeklySummary>>) =>
  ({ weekStartKey: 'a', weekEndKey: 'b', workoutCount: 0, workoutDays: 0, calorieAvg: 0, proteinAvg: 0, mealDays: 0, sleepHoursAvg: 0, sleepNights: 0, waterDailyAvgMl: 0, ...over });

check('亮點: 訓練天 ≥5', pickHighlight(dataFor({ workoutDays: 5, workoutCount: 6 })) === '這週訓練 5 天，超猛的！');
check('亮點: 訓練 ≥3 次', pickHighlight(dataFor({ workoutCount: 3 })) === '這週練了 3 次，很穩！');
check('亮點: 睡眠', pickHighlight(dataFor({ sleepNights: 4, sleepHoursAvg: 7 })).includes('作息顧得很好'));
check('亮點: 飲食自律', pickHighlight(dataFor({ mealDays: 6 })).includes('超自律'));
check('亮點: 喝水達標', pickHighlight(dataFor({ waterDailyAvgMl: 2000 })).includes('喝水達標'));
check('亮點: fallback', pickHighlight(dataFor({ mealDays: 1 })) === '這週有動有記，繼續保持！');

console.log(`ALL PASS (${passed} checks)`);
