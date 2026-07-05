// 條碼查找純函數：無 runtime import（node 可直接跑，見 scripts/verify_food_lookup.ts）。
import type { MealReading } from './ocr';

/** EAN-8(8)/UPC-E(6-8)/UPC-A(12)/EAN-13(13)：純數字且長度合法。 */
export function isValidBarcode(code: string): boolean {
  return /^\d+$/.test(code) && [6, 7, 8, 12, 13].includes(code.length);
}

type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
};

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** 把 OFF product 映射成單一 item 的 MealReading；優先每份、否則每 100g；無熱量回 null。 */
export function mapOffProductToReading(off: OffProduct | null | undefined): MealReading | null {
  if (!off || !off.nutriments) return null;
  const nut = off.nutriments;
  // 每份熱量 >0 才用每份，否則退回每 100g（避免 energy-kcal_serving 為 0 卻誤棄有效的每 100g 資料）。
  // 每份與每 100g 不混用同一 item——缺 serving_size 公克數無法正確 scale，混用會單位錯誤。
  const servingCal = num(nut['energy-kcal_serving']);
  const hasServing = servingCal > 0;
  const suffix = hasServing ? '_serving' : '_100g';
  const cal = hasServing ? servingCal : num(nut['energy-kcal_100g']);
  if (cal <= 0) return null; // 每份與每 100g 都無熱量 → 視為查無
  const name = (off.product_name || off.brands || '未命名產品').trim();
  const item = {
    name,
    portion: hasServing ? (off.serving_size || '每份') : '每 100g',
    calories: Math.round(cal),
    protein: Math.round(num(nut[`proteins${suffix}`])),
    carb: Math.round(num(nut[`carbohydrates${suffix}`])),
    fat: Math.round(num(nut[`fat${suffix}`])),
  };
  return {
    title: name,
    items: [item],
    totalCalories: item.calories,
    totalProtein: item.protein,
    totalCarb: item.carb,
    totalFat: item.fat,
  };
}
