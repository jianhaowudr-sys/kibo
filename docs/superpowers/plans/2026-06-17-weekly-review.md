# 每週回顧卡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每週生成一張「回顧」，彙整上一個完整週的訓練/飲食/睡眠/喝水數據，存成特殊寵物訊息（category `'weekly'`），首頁 teaser 入口、訊息頁 rich 數據磚呈現。

**Architecture:** 純函數（`computeWeeklySummary` / `pickHighlight`）放零依賴的 `weekly_review_core.ts`，用 node 斷言腳本驗證；I/O 與編排（`gatherWeeklyReview` / `maybeGenerateWeeklyReview`）放 `weekly_review.ts`，搭現有 `runBackgroundStartup` 背景觸發；渲染用新元件 `WeeklyReviewBlock`。零 DB migration（重用 `pet_messages.triggerData`）。

**Tech Stack:** Expo 54 / RN 0.81 / TypeScript strict / Zustand / expo-sqlite / date-fns / NativeWind。無測試框架——純函數用 `npx -y tsx` 斷言腳本，其餘 `npx tsc --noEmit` ＋手動煙測。

**Spec:** `docs/superpowers/specs/2026-06-17-weekly-review-design.md`（已核可）

---

## 檔案結構總覽

| 動作 | 檔案 | 職責 |
|---|---|---|
| Create | `src/lib/weekly_review_core.ts` | 純函數：`WeeklyReviewData`/`WeeklySummaryInput` 型別、`computeWeeklySummary`、`pickHighlight`。**零 import**（node 可跑） |
| Create | `src/lib/weekly_review.ts` | I/O：`gatherWeeklyReview`（撈 DB→ core）、`maybeGenerateWeeklyReview`（算週/去重/空週守衛/生成） |
| Create | `scripts/verify_weekly_review.ts` | core 斷言腳本（`npx -y tsx`） |
| Create | `src/components/pet/WeeklyReviewBlock.tsx` | 由 weekly 訊息渲染數據磚 |
| Modify | `src/db/repo.ts` | 加 `listMealsBetween` |
| Modify | `src/db/schema.ts` | `PetMessageCategory` 加 `'weekly'` + 註解 |
| Modify | `src/components/dashboard/PetMessageCard.tsx` | teaser 加 `weekly: '📊'` icon |
| Modify | `app/pet/messages.tsx` | 加 weekly icon/label + 渲染分支 → `WeeklyReviewBlock` |
| Modify | `src/lib/startup.ts` | `runBackgroundStartup` 呼叫 `maybeGenerateWeeklyReview` |

---

### Task 1: 基礎管線（listMealsBetween + 'weekly' 類別 + icon）

**Files:**
- Modify: `src/db/repo.ts`（在 `listMealsByDate` 之後，約 line 793）
- Modify: `src/db/schema.ts:369`
- Modify: `src/lib/pet_messages.ts:20`（union 擴張後修 `Record<PetMessageCategory,…>` 消費端）
- Modify: `src/components/dashboard/PetMessageCard.tsx:10-15`
- Modify: `app/pet/messages.tsx:9-21`

無行為變更：只是加一個查詢、把 `'weekly'` 納入型別、讓 icon/label 查得到（渲染分支在 Task 5）。

- [ ] **Step 1: `src/db/repo.ts` 加 `listMealsBetween`**

在 `listMealsByDate`（line 784-793）之後插入。`rowToMeal`（line 69）與 `sqliteDb`/`Row` 已在檔案作用域：

```ts
export async function listMealsBetween(userId: number, fromMs: number, toMs: number): Promise<Meal[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    `SELECT * FROM meals WHERE user_id = ? AND logged_at >= ? AND logged_at < ? ORDER BY logged_at ASC`,
    [userId, fromMs, toMs],
  );
  return rs.map(rowToMeal);
}
```

- [ ] **Step 2: `src/db/schema.ts` 加 `'weekly'` 類別**

line 369 改為：

```ts
export type PetMessageCategory = 'greeting' | 'concern' | 'celebration' | 'reminder' | 'weekly';
```

並把 line 297 的欄位註解改為：

```ts
  category: text('category').notNull(),  // greeting | concern | celebration | reminder | weekly
```

- [ ] **Step 3: 修 `src/lib/pet_messages.ts` 的 Record 消費端**

`pet_messages.ts:20` 的 `TEMPLATES` 是 `Record<PetMessageCategory, …>`，union 加了 `'weekly'` 後 `Record` 會要求補 `weekly` key → tsc 報錯。把型別改成排除 weekly（每日模板本就不含週回顧）。line 20 改為：

```ts
const TEMPLATES: Record<Exclude<PetMessageCategory, 'weekly'>, ((data: any) => string)[]> = {
```

（`generateDailyMessages` 內 `const cats: PetMessageCategory[] = ['greeting', 'concern', 'celebration', 'reminder']` 為字面子集，合法、不受影響。`addPetMessage` 的 `category` 參數是 text 欄即 `string`，`'weekly'` 字面值相容、無 exhaustiveness 問題。）

- [ ] **Step 4: `src/components/dashboard/PetMessageCard.tsx` teaser icon**

`CATEGORY_ICON`（line 10-15）加一行 `weekly`：

```tsx
const CATEGORY_ICON: Record<string, string> = {
  greeting: '👋',
  concern: '🥺',
  celebration: '🎉',
  reminder: '💡',
  weekly: '📊',
};
```

- [ ] **Step 5: `app/pet/messages.tsx` icon + label**

`CATEGORY_ICON`（line 9-14）加 `weekly: '📊',`；`CATEGORY_LABEL`（line 16-21）加 `weekly: '週回顧',`：

```tsx
const CATEGORY_ICON: Record<string, string> = {
  greeting: '👋',
  concern: '🥺',
  celebration: '🎉',
  reminder: '💡',
  weekly: '📊',
};

const CATEGORY_LABEL: Record<string, string> = {
  greeting: '問候',
  concern: '關心',
  celebration: '慶祝',
  reminder: '提醒',
  weekly: '週回顧',
};
```

- [ ] **Step 6: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 7: Commit**

```bash
git add src/db/repo.ts src/db/schema.ts src/lib/pet_messages.ts src/components/dashboard/PetMessageCard.tsx app/pet/messages.tsx
git commit -m "feat(weekly): 基礎管線——listMealsBetween + 'weekly' 類別 + teaser icon"
```

---

### Task 2: 純函數 core + 斷言腳本

**Files:**
- Create: `src/lib/weekly_review_core.ts`
- Create: `scripts/verify_weekly_review.ts`

`weekly_review_core.ts` **不得有任何 import**（型別與純運算自足）——這樣斷言腳本在 node 下不會拉進 RN 模組。

- [ ] **Step 1: 先寫斷言腳本（此時必然失敗）**

建立 `scripts/verify_weekly_review.ts`：

```ts
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
```

- [ ] **Step 2: 跑腳本確認失敗**

Run: `npx -y tsx scripts/verify_weekly_review.ts`
Expected: FAIL — `Cannot find module '../src/lib/weekly_review_core'`

- [ ] **Step 3: 建立 `src/lib/weekly_review_core.ts`**

```ts
// 每週回顧純函數：零 import（node 可直接跑，見 scripts/verify_weekly_review.ts）。

export type WeeklyReviewData = {
  weekStartKey: string;
  weekEndKey: string;
  workoutCount: number;
  workoutDays: number;
  calorieAvg: number;
  proteinAvg: number;
  mealDays: number;
  sleepHoursAvg: number;
  sleepNights: number;
  waterDailyAvgMl: number;
};

export type WeeklySummaryInput = {
  weekStartKey: string;
  weekEndKey: string;
  /** 該週每筆訓練的 dayKey（可重複） */
  workoutDayKeys: string[];
  /** 該週每筆飲食的 dayKey（可重複） */
  mealDayKeys: string[];
  /** 該週每筆飲食的熱量（與 mealDayKeys 同源，不需對齊，只取總和） */
  mealCalories: number[];
  mealProtein: number[];
  /** 該週每個「有主睡的夜」的當夜總分鐘（分段睡已加總，一夜一筆） */
  sleepNightMinutes: number[];
  /** 該週每筆喝水的 ml */
  waterMl: number[];
};

const sum = (xs: number[]): number => xs.reduce((s, x) => s + x, 0);

export function computeWeeklySummary(input: WeeklySummaryInput): WeeklyReviewData {
  const mealDays = new Set(input.mealDayKeys).size;
  const sleepNights = input.sleepNightMinutes.length;
  return {
    weekStartKey: input.weekStartKey,
    weekEndKey: input.weekEndKey,
    workoutCount: input.workoutDayKeys.length,
    workoutDays: new Set(input.workoutDayKeys).size,
    calorieAvg: mealDays > 0 ? Math.round(sum(input.mealCalories) / mealDays) : 0,
    proteinAvg: mealDays > 0 ? Math.round(sum(input.mealProtein) / mealDays) : 0,
    mealDays,
    sleepHoursAvg: sleepNights > 0 ? Math.round((sum(input.sleepNightMinutes) / sleepNights / 60) * 10) / 10 : 0,
    sleepNights,
    waterDailyAvgMl: Math.round(sum(input.waterMl) / 7),
  };
}

/** 寵物口吻亮點標題（依序第一個命中）。回傳純文字，不含 emoji（避免與 📊 重複）。 */
export function pickHighlight(d: WeeklyReviewData): string {
  if (d.workoutDays >= 5) return `這週訓練 ${d.workoutDays} 天，超猛的！`;
  if (d.workoutCount >= 3) return `這週練了 ${d.workoutCount} 次，很穩！`;
  if (d.sleepNights >= 4 && d.sleepHoursAvg >= 7) return `睡眠均 ${d.sleepHoursAvg}h，作息顧得很好～`;
  if (d.mealDays >= 6) return `飲食 ${d.mealDays} 天都有記，超自律！`;
  if (d.waterDailyAvgMl >= 2000) return `喝水達標，${Math.round(d.waterDailyAvgMl / 100) / 10} L／天！`;
  return '這週有動有記，繼續保持！';
}
```

- [ ] **Step 4: 跑腳本確認全過**

Run: `npx -y tsx scripts/verify_weekly_review.ts`
Expected: 逐行 `ok - ...`，最後 `ALL PASS (13 checks)`

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 6: Commit**

```bash
git add src/lib/weekly_review_core.ts scripts/verify_weekly_review.ts
git commit -m "feat(weekly): 純函數 computeWeeklySummary/pickHighlight + 斷言腳本"
```

---

### Task 3: I/O 與生成編排（gatherWeeklyReview + maybeGenerateWeeklyReview）

**Files:**
- Create: `src/lib/weekly_review.ts`

依賴（皆已存在，簽章已確認）：`repo.listWorkouts(userId, limit)`、`repo.listMealsBetween`（Task 1）、`healthRepo.listMainSleepsByDay(userId, dayKey)`、`healthRepo.listWaterBetween(userId, fromMs, toMs)`、`healthRepo.listPetMessages(userId, limit)`、`healthRepo.addPetMessage(NewPetMessage)`、`dateKey` from `@/lib/date`。`Workout.startedAt`/`Meal.loggedAt` 為 `Date`、`Meal.caloriesKcal`/`proteinG` 可為 null、`SleepLog.durationMin`/`WaterLog.amountMl` 為 number。

- [ ] **Step 1: 建立 `src/lib/weekly_review.ts`**

```ts
import { format, startOfWeek, endOfWeek, subWeeks, addDays } from 'date-fns';
import type { Pet } from '@/db/schema';
import * as repo from '@/db/repo';
import * as healthRepo from '@/db/health_repo';
import { dateKey } from '@/lib/date';
import { computeWeeklySummary, pickHighlight, type WeeklyReviewData } from '@/lib/weekly_review_core';

export type { WeeklyReviewData } from '@/lib/weekly_review_core';

const WEEK_OPTS = { weekStartsOn: 1 as const }; // 週一為週首

function weekDayKeys(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => format(addDays(weekStart, i), 'yyyy-MM-dd'));
}

/** 撈該週原始資料，交給純函數彙整。weekStart=週一 00:00、weekEnd=週日 23:59:59.999。 */
export async function gatherWeeklyReview(userId: number, weekStart: Date, weekEnd: Date): Promise<WeeklyReviewData> {
  const startMs = +weekStart;
  const nextWeekStartMs = +addDays(weekStart, 7); // 半開區間上界

  // 訓練：撈近期再 filter 到該週
  const recentWorkouts = await repo.listWorkouts(userId, 100);
  const weekWorkouts = recentWorkouts.filter((w) => {
    const t = +new Date(w.startedAt);
    return t >= startMs && t < nextWeekStartMs;
  });
  const workoutDayKeys = weekWorkouts.map((w) => dateKey(w.startedAt));

  // 飲食：ms 半開區間
  const meals = await repo.listMealsBetween(userId, startMs, nextWeekStartMs);
  const mealDayKeys = meals.map((m) => dateKey(m.loggedAt));
  const mealCalories = meals.map((m) => m.caloriesKcal ?? 0);
  const mealProtein = meals.map((m) => m.proteinG ?? 0);

  // 睡眠：跑該週 7 個 dayKey，每天主睡分段加總，一夜一筆
  const sleepNightMinutes: number[] = [];
  for (const k of weekDayKeys(weekStart)) {
    const mains = await healthRepo.listMainSleepsByDay(userId, k);
    if (mains.length > 0) sleepNightMinutes.push(mains.reduce((s, x) => s + x.durationMin, 0));
  }

  // 喝水：ms 半開區間
  const waters = await healthRepo.listWaterBetween(userId, startMs, nextWeekStartMs);
  const waterMl = waters.map((w) => w.amountMl);

  return computeWeeklySummary({
    weekStartKey: format(weekStart, 'yyyy-MM-dd'),
    weekEndKey: format(weekEnd, 'yyyy-MM-dd'),
    workoutDayKeys,
    mealDayKeys,
    mealCalories,
    mealProtein,
    sleepNightMinutes,
    waterMl,
  });
}

/**
 * 若「上一個完整週」尚未生成回顧、且該週有活動，則生成並寫入一則 'weekly' 寵物訊息。
 * 整體 try/catch → console.warn，永不擋啟動。同週重入會被去重擋掉（冪等）。
 */
export async function maybeGenerateWeeklyReview(userId: number, pet: Pet | null): Promise<void> {
  try {
    const now = new Date();
    const weekStart = startOfWeek(subWeeks(now, 1), WEEK_OPTS);
    const weekEnd = endOfWeek(weekStart, WEEK_OPTS);
    const weekStartKey = format(weekStart, 'yyyy-MM-dd');

    // 去重：已有該週 weekly 訊息 → 跳過
    const existing = await healthRepo.listPetMessages(userId, 50);
    const dupe = existing.some((m) => {
      if (m.category !== 'weekly' || !m.triggerData) return false;
      try {
        return (JSON.parse(m.triggerData) as WeeklyReviewData).weekStartKey === weekStartKey;
      } catch {
        return false;
      }
    });
    if (dupe) return;

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
  } catch (e) {
    console.warn('[weekly] 生成失敗', e);
  }
}
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。（`addPetMessage` 收 `NewPetMessage`，`category` 為 text 欄即 string，`'weekly'` 字面值相容；`generatedAt: Date`、`read: number` 與既有 `bootstrap` 內呼叫同形。）

- [ ] **Step 3: 斷言腳本回歸（沒動 core，仍應全過）**

Run: `npx -y tsx scripts/verify_weekly_review.ts`
Expected: `ALL PASS (13 checks)`

- [ ] **Step 4: Commit**

```bash
git add src/lib/weekly_review.ts
git commit -m "feat(weekly): gatherWeeklyReview + maybeGenerateWeeklyReview（去重/空週守衛）"
```

---

### Task 4: 背景觸發接線

**Files:**
- Modify: `src/lib/startup.ts:56-65`（`runBackgroundStartup` 第二個 try 區塊）

- [ ] **Step 1: 在 `generateDailyMessages` 後、`refreshHealth` 前插入週回顧生成**

把 `runBackgroundStartup` 內這段：

```ts
    try {
      const { user, pets } = useAppStore.getState();
      if (user) {
        const { generateDailyMessages } = await import('@/lib/pet_messages');
        await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
        await useAppStore.getState().refreshHealth();
      }
    } catch (e) {
      console.warn('[startup] 寵物訊息生成失敗', e);
    }
```

改為（在每日訊息之後、refreshHealth 之前生成週回顧，讓 refreshHealth 一次載入兩者）：

```ts
    try {
      const { user, pets } = useAppStore.getState();
      if (user) {
        const { generateDailyMessages } = await import('@/lib/pet_messages');
        await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
        const { maybeGenerateWeeklyReview } = await import('@/lib/weekly_review');
        await maybeGenerateWeeklyReview(user.id, pets[0] ?? null);
        await useAppStore.getState().refreshHealth();
      }
    } catch (e) {
      console.warn('[startup] 寵物訊息生成失敗', e);
    }
```

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add src/lib/startup.ts
git commit -m "feat(weekly): 背景啟動觸發 maybeGenerateWeeklyReview"
```

---

### Task 5: Rich 渲染（WeeklyReviewBlock + 訊息頁分支）

**Files:**
- Create: `src/components/pet/WeeklyReviewBlock.tsx`
- Modify: `app/pet/messages.tsx`（import + map 內分支）

- [ ] **Step 1: 建立 `src/components/pet/WeeklyReviewBlock.tsx`**

`useThemePalette` 提供 `surface/card/mute/text/success/primary`（同 `PetMessageCard` 用法）。`triggerData` 解析失敗 → fallback 純文字。

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { format } from 'date-fns';
import { useThemePalette } from '@/lib/useThemePalette';
import type { PetMessage } from '@/db/schema';
import type { WeeklyReviewData } from '@/lib/weekly_review_core';

function Tile({ label, value, color, palette }: { label: string; value: string; color?: string; palette: any }) {
  return (
    <View style={{ flex: 1, backgroundColor: palette.card, borderRadius: 8, padding: 8 }}>
      <Text style={{ color: palette.mute, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: color ?? palette.text, fontSize: 16, fontWeight: '700', marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export function WeeklyReviewBlock({ message }: { message: PetMessage }) {
  const palette = useThemePalette();
  const ts = message.generatedAt instanceof Date ? message.generatedAt : new Date(message.generatedAt);

  let data: WeeklyReviewData | null = null;
  try {
    if (message.triggerData) data = JSON.parse(message.triggerData) as WeeklyReviewData;
  } catch {
    data = null;
  }

  const containerStyle = {
    backgroundColor: palette.surface, padding: 12, borderRadius: 12, marginBottom: 8,
    borderWidth: 1, borderColor: palette.card,
  } as const;

  // triggerData 缺失/壞掉 → 只顯示標題文字
  if (!data || typeof data.weekStartKey !== 'string') {
    return (
      <View style={containerStyle}>
        <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 4 }}>{format(ts, 'M/d HH:mm')} · 週回顧</Text>
        <Text style={{ color: palette.text, fontSize: 14 }}>📊 {message.text}</Text>
      </View>
    );
  }

  const waterL = (data.waterDailyAvgMl / 1000).toFixed(1); // 與 pickHighlight 同步：統一 1 位小數
  const row1 = [
    { label: '訓練', value: `${data.workoutCount} 次`, color: palette.success },
    { label: '睡眠均', value: `${data.sleepHoursAvg}h`, color: palette.primary },
    { label: '熱量均', value: `${data.calorieAvg}` },
  ];
  const row2 = [
    { label: '蛋白質均', value: `${data.proteinAvg}g` },
    { label: '喝水均', value: `${waterL}L` },
    { label: '飲食天數', value: `${data.mealDays} 天` },
  ];

  return (
    <View style={containerStyle}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ fontSize: 18, marginRight: 8 }}>📊</Text>
        <Text style={{ color: palette.text, fontSize: 14, fontWeight: '700', flex: 1 }}>{message.text}</Text>
      </View>
      <Text style={{ color: palette.mute, fontSize: 11, marginBottom: 8 }}>
        本週回顧 · {data.weekStartKey.slice(5)}–{data.weekEndKey.slice(5)} · {format(ts, 'M/d')}
      </Text>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {row1.map((t, i) => <Tile key={i} {...t} palette={palette} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {row2.map((t, i) => <Tile key={i} {...t} palette={palette} />)}
        </View>
      </View>
    </View>
  );
}

export default WeeklyReviewBlock;
```

- [ ] **Step 2: `app/pet/messages.tsx` 加 import 與渲染分支**

import 區（line 1-7 之後）加：

```tsx
import { WeeklyReviewBlock } from '@/components/pet/WeeklyReviewBlock';
```

在 `messages.map((m) => {` 內、最前面（取得 `ts` 之前）加 weekly 分支：

```tsx
      {messages.map((m) => {
        if (m.category === 'weekly') {
          return <WeeklyReviewBlock key={m.id} message={m} />;
        }
        const ts = m.generatedAt instanceof Date ? m.generatedAt : new Date(m.generatedAt);
```

其餘列渲染邏輯不動。

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 4: Commit**

```bash
git add src/components/pet/WeeklyReviewBlock.tsx app/pet/messages.tsx
git commit -m "feat(weekly): WeeklyReviewBlock 數據磚渲染 + 訊息頁分支"
```

---

### Task 6: 驗收

**Files:**
- Modify: `docs/superpowers/specs/2026-06-17-weekly-review-design.md`（補驗收狀態）

- [ ] **Step 1: 全量自動檢查**

Run: `npx tsc --noEmit && npx -y tsx scripts/verify_weekly_review.ts`
Expected: tsc 無輸出；腳本 `ALL PASS (13 checks)`

- [ ] **Step 2: 回歸清單（裝置，需使用者協助）**

| # | 項目 | 怎麼驗 |
|---|---|---|
| 1 | 生成 | 造上週資料（訓練/飲食/睡眠/喝水任一）→ 跨到新週首開 App → 收到 📊 weekly 訊息 |
| 2 | teaser | 首頁寵物訊息卡顯示 `📊 + 標題` 一行 |
| 3 | rich 渲染 | 點進訊息頁，weekly 訊息顯示 6 磚（訓練/睡眠均/熱量均/蛋白質均/喝水均/飲食天數）＋週期間 |
| 4 | 去重 | 同週重開 App 不重覆生 weekly |
| 5 | 空週 | 上週全無活動 → 不生 |
| 6 | 亮點 | 標題隨數據變（訓練多→誇訓練；睡眠好→誇作息…） |
| 7 | fallback | （手動把某 weekly 訊息 triggerData 改壞）→ 訊息頁只顯示標題、不崩 |
| 8 | 既有不受影響 | 每日訊息（greeting/concern/celebration/reminder）照常生成與顯示 |

- [ ] **Step 3: 補 spec 驗收狀態**

在 `docs/superpowers/specs/2026-06-17-weekly-review-design.md` 末尾加一節「## 驗收狀態」，記錄：自動檢查（tsc + 斷言腳本 13/13）已過；上表裝置回歸待使用者實機驗收。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-17-weekly-review-design.md
git commit -m "docs(weekly): 驗收狀態（自動檢查全綠；實機待使用者驗收）"
```

---

## 附錄：Spec 覆蓋對照

| Spec 要求 | 對應 Task |
|---|---|
| `'weekly'` 類別（零 migration）+ triggerData 儲存 | Task 1, 3 |
| `listMealsBetween` | Task 1 |
| `computeWeeklySummary`（除零守衛）+ `pickHighlight` 純函數 | Task 2 |
| `gatherWeeklyReview`（重用 water/sleep/workout helpers + 新 meal helper） | Task 3 |
| `maybeGenerateWeeklyReview`（固定日曆週、去重、空週守衛、不回補） | Task 3 |
| 背景觸發（runBackgroundStartup） | Task 4 |
| `WeeklyReviewBlock` rich 渲染 + fallback；teaser/訊息頁 icon | Task 1, 5 |
| 純函數斷言 + tsc + 裝置回歸 | Task 2, 6 |
