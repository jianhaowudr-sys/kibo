// meal_verify 純函數斷言腳本。執行：npx -y tsx scripts/verify_meal_logic.ts
// 不依賴測試框架；全過輸出 ALL PASS。
import {
  diffReadings,
  snapshotOf,
  mergeVerifiedIntoForm,
  formatDiffSummary,
  type MealFormValues,
} from '../src/lib/meal_verify';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok - ${name}`);
}

const item = (name: string, calories: number) => ({ name, calories, protein: 10, carb: 20, fat: 5 });

const prelim = {
  title: '午餐｜滷肉飯套餐',
  items: [item('滷肉飯', 600), item('燙青菜', 50)],
  totalCalories: 730,
  totalProtein: 24,
  totalCarb: 92,
  totalFat: 26,
};

// --- diffReadings ---
{
  const d = diffReadings(prelim, { ...prelim });
  check('無差異 → 不顯著', !d.significant && d.calorieDeltaPct === 0 && d.addedItems.length === 0);
}
{
  const verified = { ...prelim, items: [...prelim.items, item('滷蛋', 80)], totalCalories: 810 };
  const d = diffReadings(prelim, verified);
  check('新增品項 → 顯著且列名', d.significant && d.addedItems.join() === '滷蛋' && d.removedItems.length === 0);
}
{
  const verified = { ...prelim, items: [prelim.items[0]], totalCalories: 680 };
  const d = diffReadings(prelim, verified);
  check('移除品項 → 顯著且列名', d.significant && d.removedItems.join() === '燙青菜');
}
{
  const d = diffReadings(prelim, { ...prelim, totalCalories: 650 });
  check('熱量 −11% 且品項相同 → 不顯著', !d.significant && d.calorieDeltaPct === -11);
}
{
  const d = diffReadings(prelim, { ...prelim, totalCalories: 580 });
  check('熱量 −21% → 顯著', d.significant && d.calorieDeltaPct === -21);
}

// --- snapshot / mergeVerifiedIntoForm ---
const applied: MealFormValues = {
  title: prelim.title,
  items: prelim.items,
  calories: '730',
  protein: '24',
  carb: '92',
  fat: '26',
};
const snap = snapshotOf(applied);
const verified = {
  title: '午餐｜滷肉飯套餐',
  items: [item('滷肉飯', 520), item('燙青菜', 50), item('滷蛋', 80)],
  totalCalories: 650,
  totalProtein: 31,
  totalCarb: 93,
  totalFat: 28,
};
{
  const next = mergeVerifiedIntoForm(applied, snap, verified);
  check('未動過 → 全部套用', next.calories === '650' && next.items.length === 3 && next.protein === '31');
}
{
  const edited: MealFormValues = { ...applied, calories: '700' }; // 使用者改過熱量
  const next = mergeVerifiedIntoForm(edited, snap, verified);
  check('改過的欄位保留', next.calories === '700');
  check('沒改的欄位仍套用', next.fat === '28' && next.items.length === 3);
}
{
  const edited: MealFormValues = { ...applied, items: [applied.items[0]] }; // 使用者刪過品項
  const next = mergeVerifiedIntoForm(edited, snap, verified);
  check('items 動過 → items 保留使用者版本', next.items.length === 1);
  check('items 動過但 totals 沒動 → totals 仍套用', next.calories === '650');
}

// --- formatDiffSummary ---
{
  const d = diffReadings(prelim, verified);
  const s = formatDiffSummary(730, verified, d);
  check('摘要含熱量變化', s.includes('730→650'));
  check('摘要含新增品項', s.includes('滷蛋'));
}

console.log(`ALL PASS (${passed} checks)`);
