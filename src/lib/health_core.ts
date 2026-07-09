// HealthKit 樣本對應純函數（零 import）。見 scripts/verify_health_widget.ts。

export type HKQuantityInput = { identifier: string; unit: string; value: number };

export const HK_ID = {
  dietaryEnergy: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  protein: 'HKQuantityTypeIdentifierDietaryProtein',
  carb: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
  fat: 'HKQuantityTypeIdentifierDietaryFatTotal',
  water: 'HKQuantityTypeIdentifierDietaryWater',
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  stepCount: 'HKQuantityTypeIdentifierStepCount',
  activeEnergy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
} as const;

function pos(n: number | undefined | null): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 飲食營養素 → HK 樣本；略過缺/≤0/非有限。 */
export function nutritionSamples(m: { calories?: number; protein?: number; carb?: number; fat?: number }): HKQuantityInput[] {
  const out: HKQuantityInput[] = [];
  if (pos(m.calories)) out.push({ identifier: HK_ID.dietaryEnergy, unit: 'kcal', value: m.calories });
  if (pos(m.protein)) out.push({ identifier: HK_ID.protein, unit: 'g', value: m.protein });
  if (pos(m.carb)) out.push({ identifier: HK_ID.carb, unit: 'g', value: m.carb });
  if (pos(m.fat)) out.push({ identifier: HK_ID.fat, unit: 'g', value: m.fat });
  return out;
}

/** 喝水 → HK 樣本（mL）；ml≤0/非有限 → null。 */
export function waterSample(ml: number): HKQuantityInput | null {
  return pos(ml) ? { identifier: HK_ID.water, unit: 'mL', value: ml } : null;
}

/** 體重 → HK 樣本（kg）；0<kg<500，否則 null。 */
export function weightSample(kg: number): HKQuantityInput | null {
  return pos(kg) && kg < 500 ? { identifier: HK_ID.bodyMass, unit: 'kg', value: kg } : null;
}
