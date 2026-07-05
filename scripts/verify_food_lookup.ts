// food_lookup_core 純函數斷言。執行：npx -y tsx scripts/verify_food_lookup.ts
import { isValidBarcode, mapOffProductToReading } from '../src/lib/food_lookup_core';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok - ${name}`);
}

// isValidBarcode
check('EAN-13 有效', isValidBarcode('4710088410112'));
check('EAN-8 有效', isValidBarcode('12345678'));
check('UPC-A(12) 有效', isValidBarcode('123456789012'));
check('UPC-E(6) 有效', isValidBarcode('123456'));
check('含字母無效', !isValidBarcode('471008841011a'));
check('長度 9 無效', !isValidBarcode('123456789'));
check('空字串無效', !isValidBarcode(''));

// mapOffProductToReading
check('null → null', mapOffProductToReading(null) === null);
check('無 nutriments → null', mapOffProductToReading({ product_name: 'x' }) === null);

{
  const r = mapOffProductToReading({
    product_name: '蛋白棒',
    serving_size: '60g',
    nutriments: { 'energy-kcal_serving': 220, proteins_serving: 20, carbohydrates_serving: 18, fat_serving: 7, 'energy-kcal_100g': 367 },
  });
  check('有每份 → 用每份值', r != null && r.totalCalories === 220 && r.items[0].portion === '60g' && r.items[0].protein === 20);
  check('每份 totals = item', r != null && r.totalProtein === 20 && r.totalCarb === 18 && r.totalFat === 7 && r.title === '蛋白棒');
}
{
  const r = mapOffProductToReading({
    product_name: '餅乾',
    nutriments: { 'energy-kcal_100g': 480, proteins_100g: 6, carbohydrates_100g: 64, fat_100g: 22 },
  });
  check('無每份 → 用每100g + portion 每100g', r != null && r.totalCalories === 480 && r.items[0].portion === '每 100g');
}
{
  const r = mapOffProductToReading({ brands: '某品牌', nutriments: { 'energy-kcal_100g': 100 } });
  check('無 product_name → 用 brands', r != null && r.title === '某品牌');
}
check('有 nutriments 但無熱量 → null', mapOffProductToReading({ product_name: 'x', nutriments: { proteins_100g: 5 } }) === null);

console.log(`ALL PASS (${passed} checks)`);
