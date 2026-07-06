// rest_timer_core 純函數斷言。執行：npx -y tsx scripts/verify_rest_timer.ts
import { clampDuration, parseDurations, computeRemaining, swapAdjacent, DEFAULT_DURATIONS } from '../src/lib/rest_timer_core';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok - ${name}`);
}
const eq = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

// clampDuration
check('clamp 正常值', clampDuration(30) === 30);
check('clamp 低於下限 → 5', clampDuration(3) === 5);
check('clamp 高於上限 → 900', clampDuration(1000) === 900);
check('clamp NaN → 60', clampDuration(NaN) === 60);
check('clamp 負數 → 5', clampDuration(-5) === 5);
check('clamp 四捨五入', clampDuration(62.4) === 62);

// parseDurations
check('parse null → DEFAULT', eq(parseDurations(null), DEFAULT_DURATIONS));
check('parse 正常', eq(parseDurations('[10,20,30,40]'), [10, 20, 30, 40]));
check('parse 非 4 元素 → DEFAULT', eq(parseDurations('[10,20,30]'), DEFAULT_DURATIONS));
check('parse 壞 JSON → DEFAULT', eq(parseDurations('not json'), DEFAULT_DURATIONS));
check('parse 元素 clamp', eq(parseDurations('[1,2,3,4]'), [5, 5, 5, 5]));
check('parse 字串數字', eq(parseDurations('["10","20","30","40"]'), [10, 20, 30, 40]));

// computeRemaining
check('remaining 未到', computeRemaining(1000 + 3000, 1000) === 3);
check('remaining 剛好 → 0', computeRemaining(1000, 1000) === 0);
check('remaining 已過 → 0', computeRemaining(1000, 6000) === 0);
check('remaining 無條件進位', computeRemaining(1000 + 1500, 1000) === 2);

// swapAdjacent
const L = [{ id: 1 }, { id: 2 }, { id: 3 }];
check('swap 中間項上移', eq(swapAdjacent(L, 2, 'up').map((x) => x.id), [2, 1, 3]));
check('swap 中間項下移', eq(swapAdjacent(L, 2, 'down').map((x) => x.id), [1, 3, 2]));
check('swap 首項上移 → 不變', eq(swapAdjacent(L, 1, 'up').map((x) => x.id), [1, 2, 3]));
check('swap 末項下移 → 不變', eq(swapAdjacent(L, 3, 'down').map((x) => x.id), [1, 2, 3]));
check('swap 找不到 → 不變', eq(swapAdjacent(L, 99, 'up').map((x) => x.id), [1, 2, 3]));

console.log(`ALL PASS (${passed} checks)`);
