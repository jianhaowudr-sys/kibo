import { nutritionSamples, waterSample, weightSample, HK_ID } from '../src/lib/health_core';
import { buildWidgetPayload } from '../src/lib/widget_core';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

// ---- nutritionSamples ----
{
  const s = nutritionSamples({ calories: 600, protein: 20, carb: 80, fat: 15 });
  ok(s.length === 4, 'full → 4 samples');
  ok(s[0].identifier === HK_ID.dietaryEnergy && s[0].unit === 'kcal' && s[0].value === 600, 'energy sample');
  ok(s[1].identifier === HK_ID.protein && s[1].unit === 'g', 'protein g');
}
{
  const s = nutritionSamples({ calories: 600, protein: 0, fat: -5 });
  ok(s.length === 1 && s[0].identifier === HK_ID.dietaryEnergy, 'skip 0/neg, keep energy');
}
ok(nutritionSamples({}).length === 0, 'empty → []');
ok(nutritionSamples({ calories: NaN }).length === 0, 'NaN skipped');
ok(nutritionSamples({ calories: 600 }).length === 1, 'only calories → 1 sample');

// ---- workout 授權識別碼（saveWorkoutSample 需要 HKWorkoutType share 權限）----
ok(HK_ID.workout === 'HKWorkoutTypeIdentifier', 'workout share identifier present');

// ---- waterSample ----
ok(waterSample(500)?.identifier === HK_ID.water && waterSample(500)?.unit === 'mL', 'water sample mL');
ok(waterSample(0) === null, 'water 0 → null');
ok(waterSample(-10) === null, 'water neg → null');
ok(waterSample(NaN) === null, 'water NaN → null');

// ---- weightSample ----
ok(weightSample(70)?.identifier === HK_ID.bodyMass && weightSample(70)?.unit === 'kg', 'weight sample kg');
ok(weightSample(0) === null, 'weight 0 → null');
ok(weightSample(600) === null, 'weight >=500 → null');
ok(weightSample(NaN) === null, 'weight NaN → null');

// ---- buildWidgetPayload ----
{
  const p = buildWidgetPayload({ dateKey: '2026-07-10', caloriesEaten: 1200.6, caloriesTarget: 2000, workouts: 1, waterMl: 1500, waterTargetMl: 2000 });
  ok(p.caloriesEaten === 1201 && p.caloriesTarget === 2000, 'rounds/keeps values');
  ok(p.dateKey === '2026-07-10' && p.workouts === 1 && p.waterMl === 1500, 'passthrough fields');
}
{
  const p = buildWidgetPayload({ dateKey: 'x' });
  ok(p.caloriesEaten === 0 && p.caloriesTarget === 0 && p.workouts === 0 && p.waterMl === 0 && p.waterTargetMl === 0, 'missing → 0');
}
{
  const p = buildWidgetPayload({ dateKey: 'x', caloriesEaten: -5, waterMl: NaN });
  ok(p.caloriesEaten === 0 && p.waterMl === 0, 'neg/NaN → 0');
}
ok(buildWidgetPayload({ dateKey: 123 as any }).dateKey === '', 'non-string dateKey → ""');

console.log(`ALL PASS (${pass} checks)`);
