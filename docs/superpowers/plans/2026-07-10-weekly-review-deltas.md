# 每週回顧 週對週 Δ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每週回顧卡在每格顯示與上一週相比的 ↑/↓/→ 與變化量。

**Architecture:** 純函數 `computeWeeklyDeltas`/`isEmptyWeek` 加進零-import 的 `weekly_review_core.ts`（node 斷言驗）。`weekly_review.ts` 生成時多撈前一週摘要、算 Δ、存入 `triggerData`。`WeeklyReviewBlock` 的 `Tile` 讀 `data.deltas` 畫箭頭。向後相容：舊 `triggerData` 無 `deltas` → 不畫箭頭。

**Tech Stack:** TypeScript strict、date-fns、`npx -y tsx` 斷言、`npx tsc --noEmit`。

## Global Constraints

- TypeScript strict；每 task 結束 `npx tsc --noEmit` 乾淨（OOM 時 `node --max-old-space-size=2048 ./node_modules/typescript/bin/tsc --noEmit`）。
- `weekly_review_core.ts` 維持零 runtime import（node 可直接跑）。
- `deltas` 為**選填**欄位；缺失時卡片正常渲染（不畫箭頭）——不得破壞既有 `triggerData` 卡片。
- Δ 一律中性色（`palette.mute`），不做好壞配色。

---

### Task 1: core Δ 純函數 + 斷言

**Files:**
- Modify: `src/lib/weekly_review_core.ts`
- Modify: `scripts/verify_weekly_review.ts`

**Interfaces:**
- Produces:
  - `type MetricDelta = { diff: number; dir: 'up' | 'down' | 'flat' }`
  - `type WeeklyDeltas = { workoutCount?: MetricDelta; calorieAvg?: MetricDelta; proteinAvg?: MetricDelta; sleepHoursAvg?: MetricDelta; waterDailyAvgMl?: MetricDelta; mealDays?: MetricDelta }`
  - `WeeklyReviewData` 新增選填 `deltas?: WeeklyDeltas`
  - `computeWeeklyDeltas(cur: WeeklyReviewData, prev: WeeklyReviewData | null): WeeklyDeltas`
  - `isEmptyWeek(d: WeeklyReviewData): boolean`

- [ ] **Step 1: 在 `weekly_review_core.ts` 的 `export type WeeklyReviewData = {` 上方，插入兩個新型別**

```ts
export type MetricDelta = { diff: number; dir: 'up' | 'down' | 'flat' };

export type WeeklyDeltas = {
  workoutCount?: MetricDelta;
  calorieAvg?: MetricDelta;
  proteinAvg?: MetricDelta;
  sleepHoursAvg?: MetricDelta;
  waterDailyAvgMl?: MetricDelta;
  mealDays?: MetricDelta;
};
```

- [ ] **Step 2: 在 `WeeklyReviewData` 型別內最後一欄 `waterDailyAvgMl: number;` 之後，加一行選填欄位**

```ts
  waterDailyAvgMl: number;
  deltas?: WeeklyDeltas;
```

（只加 `deltas?` 那行；其餘欄位不動。）

- [ ] **Step 3: 在檔案末端（`pickHighlight` 之後）追加三個函數**

```ts
function metricDelta(cur: number, prev: number): MetricDelta {
  const diff = Math.round((cur - prev) * 10) / 10; // 清浮點誤差；整數項維持整數
  const dir: MetricDelta['dir'] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  return { diff, dir };
}

/** 本週 vs 前一週每項 Δ。prev 為 null（無基準）→ 回 {}。 */
export function computeWeeklyDeltas(cur: WeeklyReviewData, prev: WeeklyReviewData | null): WeeklyDeltas {
  if (!prev) return {};
  return {
    workoutCount: metricDelta(cur.workoutCount, prev.workoutCount),
    calorieAvg: metricDelta(cur.calorieAvg, prev.calorieAvg),
    proteinAvg: metricDelta(cur.proteinAvg, prev.proteinAvg),
    sleepHoursAvg: metricDelta(cur.sleepHoursAvg, prev.sleepHoursAvg),
    waterDailyAvgMl: metricDelta(cur.waterDailyAvgMl, prev.waterDailyAvgMl),
    mealDays: metricDelta(cur.mealDays, prev.mealDays),
  };
}

/** 空週：全無活動（＝生成守衛條件）。 */
export function isEmptyWeek(d: WeeklyReviewData): boolean {
  return d.workoutCount === 0 && d.mealDays === 0 && d.sleepNights === 0 && d.waterDailyAvgMl === 0;
}
```

- [ ] **Step 4: 在 `scripts/verify_weekly_review.ts` 更新 import（第 2 行）加入兩個新函數**

把：
```ts
import { computeWeeklySummary, pickHighlight, type WeeklySummaryInput } from '../src/lib/weekly_review_core';
```
改成：
```ts
import { computeWeeklySummary, pickHighlight, computeWeeklyDeltas, isEmptyWeek, type WeeklySummaryInput } from '../src/lib/weekly_review_core';
```

- [ ] **Step 5: 在 `scripts/verify_weekly_review.ts` 的最後一行 `console.log(\`ALL PASS ...\`)` 之前，追加斷言**

（重用檔案既有的 `dataFor` 輔助函數，位於 pickHighlight 區塊上方，作用域可用。）

```ts
// ---- computeWeeklyDeltas ----
check('Δ: prev null → {}', JSON.stringify(computeWeeklyDeltas(dataFor({ workoutCount: 3 }), null)) === '{}');
{
  const d = computeWeeklyDeltas(dataFor({ workoutCount: 5, calorieAvg: 1800, mealDays: 6 }), dataFor({ workoutCount: 3, calorieAvg: 2000, mealDays: 6 }));
  check('Δ: 訓練 up +2', d.workoutCount?.dir === 'up' && d.workoutCount?.diff === 2);
  check('Δ: 熱量 down -200', d.calorieAvg?.dir === 'down' && d.calorieAvg?.diff === -200);
  check('Δ: 飲食天數 flat 0', d.mealDays?.dir === 'flat' && d.mealDays?.diff === 0);
}
{
  const d = computeWeeklyDeltas(dataFor({ sleepHoursAvg: 7.2 }), dataFor({ sleepHoursAvg: 6.8 }));
  check('Δ: 睡眠浮點清理 +0.4', d.sleepHoursAvg?.dir === 'up' && d.sleepHoursAvg?.diff === 0.4);
}
{
  const d = computeWeeklyDeltas(dataFor({ waterDailyAvgMl: 2300 }), dataFor({ waterDailyAvgMl: 2000 }));
  check('Δ: 喝水 up +300', d.waterDailyAvgMl?.dir === 'up' && d.waterDailyAvgMl?.diff === 300);
}
// ---- isEmptyWeek ----
check('空週: 全 0 → true', isEmptyWeek(dataFor({})) === true);
check('空週: 有訓練 → false', isEmptyWeek(dataFor({ workoutCount: 1 })) === false);
check('空週: 只有喝水 → false', isEmptyWeek(dataFor({ waterDailyAvgMl: 500 })) === false);
check('空週: 只有睡眠夜數 → false', isEmptyWeek(dataFor({ sleepNights: 1 })) === false);
```

- [ ] **Step 6: 跑斷言**

Run: `npx -y tsx scripts/verify_weekly_review.ts`
Expected: 尾行 `ALL PASS (24 checks)`（原 14 + 新增 10）

- [ ] **Step 7: 型別檢查** — Run `npx tsc --noEmit` → 乾淨

- [ ] **Step 8: Commit**

```bash
git add src/lib/weekly_review_core.ts scripts/verify_weekly_review.ts
git commit -m "feat(weekly): computeWeeklyDeltas/isEmptyWeek 純函數 + 斷言（主線批次①）"
```

---

### Task 2: weekly_review.ts 撈前一週 + 算 Δ 存入

**Files:**
- Modify: `src/lib/weekly_review.ts`

**Interfaces:**
- Consumes: `computeWeeklyDeltas`, `isEmptyWeek` from `@/lib/weekly_review_core`（Task 1）。
- Produces: 無新對外介面（`maybeGenerateWeeklyReview` 簽名不變；`triggerData` 內容多一個 `deltas` 欄）。

**Context:** `maybeGenerateWeeklyReview` 目前算本週 `data`、空週守衛（手寫 4 條件）、存 `triggerData: JSON.stringify(data)`。本 task：改用 `isEmptyWeek`、多撈前一週、算 `deltas`、存 `{ ...data, deltas }`。`date-fns` 的 `subWeeks`/`endOfWeek`/`WEEK_OPTS` 皆已在檔案內。

- [ ] **Step 1: 更新 import（第 6 行）加入兩個新函數**

把：
```ts
import { computeWeeklySummary, pickHighlight, type WeeklyReviewData } from '@/lib/weekly_review_core';
```
改成：
```ts
import { computeWeeklySummary, pickHighlight, computeWeeklyDeltas, isEmptyWeek, type WeeklyReviewData } from '@/lib/weekly_review_core';
```

- [ ] **Step 2: 取代「算本週 data → 空週守衛 → addPetMessage」整段**

把現有這段：
```ts
    const data = await gatherWeeklyReview(userId, weekStart, weekEnd);

    // 空週守衛：全無活動 → 不生
    if (data.workoutCount === 0 && data.mealDays === 0 && data.sleepNights === 0 && data.waterDailyAvgMl === 0) {
      return;
    }

    await healthRepo.addPetMessage({
      userId,
      petId: pet?.id ?? null,
      generatedAt: now,
      category: 'weekly',
      text: pickHighlight(data),
      read: 0,
      triggerData: JSON.stringify(data),
    });
```
改成：
```ts
    const data = await gatherWeeklyReview(userId, weekStart, weekEnd);

    // 空週守衛：全無活動 → 不生
    if (isEmptyWeek(data)) {
      return;
    }

    // 前一週摘要 → 週對週 Δ（前一週空 → 無基準、不顯示箭頭）
    const prevStart = subWeeks(weekStart, 1);
    const prevEnd = endOfWeek(prevStart, WEEK_OPTS);
    const prevData = await gatherWeeklyReview(userId, prevStart, prevEnd);
    const deltas = computeWeeklyDeltas(data, isEmptyWeek(prevData) ? null : prevData);

    await healthRepo.addPetMessage({
      userId,
      petId: pet?.id ?? null,
      generatedAt: now,
      category: 'weekly',
      text: pickHighlight(data),
      read: 0,
      triggerData: JSON.stringify({ ...data, deltas }),
    });
```

- [ ] **Step 3: 型別檢查** — Run `npx tsc --noEmit` → 乾淨

- [ ] **Step 4: Commit**

```bash
git add src/lib/weekly_review.ts
git commit -m "feat(weekly): 生成時撈前一週算 Δ 並存入 triggerData（主線批次①）"
```

---

### Task 3: WeeklyReviewBlock 卡片箭頭

**Files:**
- Modify: `src/components/pet/WeeklyReviewBlock.tsx`

**Interfaces:**
- Consumes: `data.deltas`（`WeeklyDeltas`）、`MetricDelta`（Task 1）。

**Context:** `Tile` 目前是 `{ label, value, color?, palette }`。加選填 `delta?: MetricDelta` 與 `format?: (n:number)=>string`，在 value 下方顯示一行 ↑/↓/→ + 變化量（中性 `palette.mute`）。`row1`/`row2` 每格帶上對應的 delta 與單位格式。缺 `delta` → 不顯示該行（舊卡相容）。

- [ ] **Step 1: 更新 import（第 6 行）加入 `MetricDelta` 型別**

把：
```ts
import type { WeeklyReviewData } from '@/lib/weekly_review_core';
```
改成：
```ts
import type { WeeklyReviewData, MetricDelta } from '@/lib/weekly_review_core';
```

- [ ] **Step 2: 取代 `Tile` 元件**

```tsx
function Tile({ label, value, color, palette, delta, format }: { label: string; value: string; color?: string; palette: any; delta?: MetricDelta; format?: (n: number) => string }) {
  const arrow = delta ? (delta.dir === 'up' ? '↑' : delta.dir === 'down' ? '↓' : '→') : null;
  const deltaText = delta
    ? delta.dir === 'flat'
      ? '→ 持平'
      : `${arrow} ${format ? format(Math.abs(delta.diff)) : Math.abs(delta.diff)}`
    : null;
  return (
    <View style={{ flex: 1, backgroundColor: palette.card, borderRadius: 8, padding: 8 }}>
      <Text style={{ color: palette.mute, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: color ?? palette.text, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{value}</Text>
      {deltaText != null && (
        <Text style={{ color: palette.mute, fontSize: 10, marginTop: 1 }}>{deltaText}</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 3: 取代 `row1` / `row2` 定義（帶上 delta + format）**

把現有的 `const row1 = [...]` 與 `const row2 = [...]` 兩段改成：
```tsx
  const d = data.deltas;
  const row1 = [
    { label: '訓練', value: `${data.workoutCount} 次`, color: palette.success, delta: d?.workoutCount, format: (n: number) => `${n} 次` },
    { label: '睡眠均', value: `${data.sleepHoursAvg}h`, color: palette.primary, delta: d?.sleepHoursAvg, format: (n: number) => `${n.toFixed(1)}h` },
    { label: '熱量均', value: `${data.calorieAvg}`, delta: d?.calorieAvg, format: (n: number) => `${n}` },
  ];
  const row2 = [
    { label: '蛋白質均', value: `${data.proteinAvg}g`, delta: d?.proteinAvg, format: (n: number) => `${n}g` },
    { label: '喝水均', value: `${waterL}L`, delta: d?.waterDailyAvgMl, format: (n: number) => `${(n / 1000).toFixed(1)}L` },
    { label: '飲食天數', value: `${data.mealDays} 天`, delta: d?.mealDays, format: (n: number) => `${n} 天` },
  ];
```

（`row1.map(... <Tile key={i} {...t} palette={palette} />)` 不動——spread 會帶入新的 `delta`/`format`。）

- [ ] **Step 4: 型別檢查** — Run `npx tsc --noEmit` → 乾淨

- [ ] **Step 5: 全套斷言回歸** — Run `npx -y tsx scripts/verify_weekly_review.ts` → `ALL PASS (24 checks)`

- [ ] **Step 6: Commit**

```bash
git add src/components/pet/WeeklyReviewBlock.tsx
git commit -m "feat(weekly): 回顧卡每格顯示 ↑/↓/→ 週對週變化（中性色）（主線批次①）"
```

---

## Self-Review

**Spec coverage:**
- 純函數 Δ + isEmptyWeek + 斷言 → Task 1 ✓
- 撈前一週 + 算 Δ + 存 triggerData + 空週守衛改 isEmptyWeek → Task 2 ✓
- 卡片 ↑/↓/→ 中性色 + 舊卡相容 → Task 3 ✓
- prev 空 → 無箭頭 → Task 2（`isEmptyWeek(prevData) ? null : prevData`）✓
- 不做好壞配色 → Task 3 用 `palette.mute` ✓

**Placeholder scan:** 無 TBD；每 code step 完整。

**Type consistency:** `MetricDelta`/`WeeklyDeltas`/`deltas?` 於 Task 1 定義；Task 2 用 `computeWeeklyDeltas(data, ...)` 存 `{ ...data, deltas }`；Task 3 讀 `data.deltas?.<key>: MetricDelta | undefined` 傳 `Tile.delta?: MetricDelta`。key 名（workoutCount/calorieAvg/proteinAvg/sleepHoursAvg/waterDailyAvgMl/mealDays）三處一致。

**驗收：** Task 1/3 斷言 24；各 task tsc 乾淨；裝置驗收見 spec。
