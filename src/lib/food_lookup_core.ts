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
  const hasServing = nut['energy-kcal_serving'] != null;
  const suffix = hasServing ? '_serving' : '_100g';
  const cal = num(nut[`energy-kcal${suffix}`]);
  if (cal <= 0) return null; // 無熱量 → 視為查無
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
