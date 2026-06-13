// 複核差異比對與套用合併：純函數、零 runtime 依賴（node 可直接跑，見 scripts/verify_meal_logic.ts）。
import type { MealReading } from './ocr';
import type { MealItem } from '@/db/schema';

export type MealDiff = {
  significant: boolean;
  /** (verified - prelim) / max(prelim, 1)，四捨五入百分比 */
  calorieDeltaPct: number;
  addedItems: string[];
  removedItems: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** 顯著差異門檻：總熱量差 >15% 或品項有增刪（spec 核可值） */
export function diffReadings(prelim: MealReading, verified: MealReading): MealDiff {
  const prelimNames = new Set((prelim.items ?? []).map((i) => norm(i.name)));
  const verifiedNames = new Set((verified.items ?? []).map((i) => norm(i.name)));
  const addedItems = (verified.items ?? []).filter((i) => !prelimNames.has(norm(i.name))).map((i) => i.name);
  const removedItems = (prelim.items ?? []).filter((i) => !verifiedNames.has(norm(i.name))).map((i) => i.name);
  const base = Math.max(prelim.totalCalories || 0, 1);
  const calorieDeltaPct = Math.round((((verified.totalCalories || 0) - (prelim.totalCalories || 0)) / base) * 100);
  return {
    significant: Math.abs(calorieDeltaPct) > 15 || addedItems.length > 0 || removedItems.length > 0,
    calorieDeltaPct,
    addedItems,
    removedItems,
  };
}

/** diet/new 表單目前值（totals 以畫面字串為準，比對才不受格式化干擾） */
export type MealFormValues = {
  title: string;
  items: MealItem[];
  calories: string;
  protein: string;
  carb: string;
  fat: string;
};

/** AI 套用當下的表單快照：欄位值與快照相同 = 使用者沒動過 */
export type AppliedSnapshot = {
  title: string;
  itemsJson: string;
  calories: string;
  protein: string;
  carb: string;
  fat: string;
};

export function snapshotOf(v: MealFormValues): AppliedSnapshot {
  return {
    title: v.title,
    itemsJson: JSON.stringify(v.items),
    calories: v.calories,
    protein: v.protein,
    carb: v.carb,
    fat: v.fat,
  };
}

/**
 * 把複核結果套進表單：只覆蓋「使用者沒動過」的欄位（與快照逐欄比對）。
 * items 整組比對（明細列表 UI 只能刪不能改，使用者刪過就整組尊重使用者）。
 */
export function mergeVerifiedIntoForm(
  current: MealFormValues,
  snapshot: AppliedSnapshot,
  verified: MealReading,
): MealFormValues {
  const next: MealFormValues = { ...current };
  if (JSON.stringify(current.items) === snapshot.itemsJson) next.items = verified.items ?? [];
  if (current.title === snapshot.title && verified.title) next.title = verified.title;
  if (current.calories === snapshot.calories) next.calories = String(verified.totalCalories);
  if (current.protein === snapshot.protein) next.protein = String(verified.totalProtein);
  if (current.carb === snapshot.carb) next.carb = String(verified.totalCarb);
  if (current.fat === snapshot.fat) next.fat = String(verified.totalFat);
  return next;
}

/** 差異橫幅文案，例：「總熱量 730→650 kcal（-11%）；新增：滷蛋」 */
export function formatDiffSummary(fromCalories: number, verified: MealReading, diff: MealDiff): string {
  const parts: string[] = [];
  if ((verified.totalCalories || 0) !== fromCalories) {
    const sign = diff.calorieDeltaPct > 0 ? '+' : '';
    parts.push(`總熱量 ${fromCalories}→${verified.totalCalories} kcal（${sign}${diff.calorieDeltaPct}%）`);
  }
  if (diff.addedItems.length > 0) parts.push(`新增：${diff.addedItems.join('、')}`);
  if (diff.removedItems.length > 0) parts.push(`移除：${diff.removedItems.join('、')}`);
  return parts.length > 0 ? parts.join('；') : '內容微調';
}
