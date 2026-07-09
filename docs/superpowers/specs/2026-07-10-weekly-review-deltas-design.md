# 每週回顧 週對週 Δ 設計

日期：2026-07-10
狀態：已與使用者確認核可（主線批次 ①）
分支：feature/v1.0.2-libpct-eggs

## 背景與目標

每週回顧卡（`WeeklyReviewBlock`）目前顯示本週 6 項均值（訓練次數／睡眠均／熱量均／蛋白質均／喝水均／飲食天數），但沒有「跟上週比」的方向感。使用者想看到 ↑↓：這週比上週進步還是退步。

目標：生成回顧時一併撈「前一週」摘要、算出每項的 Δ，卡片在每格數字下顯示小小的 ↑／↓／→ 與變化量。

## 現況（程式碼證據）

- `src/lib/weekly_review.ts:58` `maybeGenerateWeeklyReview`：算「上一個完整週」`WeeklyReviewData`，存成一則 `category:'weekly'` 的 `PetMessage`，`triggerData = JSON.stringify(data)`。第 80 行有空週守衛。
- `src/lib/weekly_review_core.ts`：`computeWeeklySummary`（純）產 `WeeklyReviewData`；`pickHighlight` 產標題。
- `src/components/pet/WeeklyReviewBlock.tsx`：parse `triggerData` → `WeeklyReviewData`，渲染 6 格 `Tile`（label/value/color）。`triggerData` 缺失/壞掉時只顯示標題（已防呆）。

## 範圍

**做**：純函數算 Δ（本週 vs 前一週）、生成時撈前一週並把 Δ 存入 `triggerData`、卡片每格顯示 ↑/↓/→ + 變化量。

**不做（列後續）**：
- Δ 的「好壞」配色（熱量升降是好是壞取決於目標，本輪一律中性色，不做價值判斷）。
- 卡片點擊展開歷史趨勢圖／多週折線。
- 對「已生成過」的舊回顧補算 Δ（只有之後生成的新週有 Δ；舊卡自然無箭頭）。

## 設計

### 純函數（`weekly_review_core.ts`，零 import 不變）

新增型別與函數：

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

- 在 `WeeklyReviewData` 加**選填** `deltas?: WeeklyDeltas`（向後相容：`computeWeeklySummary` 不設它；舊 `triggerData` 沒這欄 → 卡片不畫箭頭）。
- `computeWeeklyDeltas(cur: WeeklyReviewData, prev: WeeklyReviewData | null): WeeklyDeltas`
  - `prev == null` → 回 `{}`（無基準，不顯示箭頭）。
  - 否則每項 `diff = round((cur - prev) * 10) / 10`（清浮點誤差，整數項維持整數）；`dir = diff>0?'up':diff<0?'down':'flat'`。
- `isEmptyWeek(d: WeeklyReviewData): boolean` = `workoutCount===0 && mealDays===0 && sleepNights===0 && waterDailyAvgMl===0`（＝現有空週守衛條件，抽成純函數共用）。

### IO 編排（`weekly_review.ts`）

- `maybeGenerateWeeklyReview` 內：算完本週 `data` 後，另撈**前一週**
  `prevStart = subWeeks(weekStart, 1)`、`prevEnd = endOfWeek(prevStart, WEEK_OPTS)`、
  `prevData = await gatherWeeklyReview(userId, prevStart, prevEnd)`。
- `const deltas = computeWeeklyDeltas(data, isEmptyWeek(prevData) ? null : prevData);`
  （前一週完全無活動 → 傳 null → 不顯示箭頭，避免新手第一份回顧「樣樣從 0 暴增」的誤導。）
- 存 `triggerData: JSON.stringify({ ...data, deltas })`。
- 現有第 80 行空週守衛改用 `isEmptyWeek(data)`（DRY，行為不變）。

### 卡片渲染（`WeeklyReviewBlock.tsx`）

- `Tile` 增加選填 `delta?: MetricDelta` 與 `format?: (n: number) => string`：value 下方一行小字顯示 `↑/↓/→` + 格式化後的 |diff|（`dir==='flat'` 顯示 `→ 持平`）。箭頭與文字用 `palette.mute`（中性，不做好壞配色）。無 `delta` → 不顯示該行（向後相容）。
- 6 格各自對應 `data.deltas?.<key>` 與單位格式：
  - 訓練：`${diff} 次`；睡眠均：`${diff.toFixed(1)}h`；熱量均：`${diff}`；蛋白質均：`${diff}g`；喝水均：`${(diff/1000).toFixed(1)}L`；飲食天數：`${diff} 天`。
- `data.deltas` 缺失（舊卡）→ 全部不畫箭頭，畫面同現況。

## 檔案異動

| 動作 | 檔案 | 職責 |
|---|---|---|
| Modify | `src/lib/weekly_review_core.ts` | `MetricDelta`/`WeeklyDeltas` 型別、`deltas?` 欄、`computeWeeklyDeltas`、`isEmptyWeek` |
| Modify | `scripts/verify_weekly_review.ts` | 追加 `computeWeeklyDeltas`／`isEmptyWeek` 斷言 |
| Modify | `src/lib/weekly_review.ts` | 撈前一週、算 deltas、存入 triggerData；空週守衛改用 `isEmptyWeek` |
| Modify | `src/components/pet/WeeklyReviewBlock.tsx` | `Tile` 顯示 ↑/↓/→ + 變化量（中性色） |

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `npx -y tsx scripts/verify_weekly_review.ts`：`computeWeeklyDeltas`（prev null→{}、up/down/flat、浮點清理、整數項）、`isEmptyWeek`（全 0 true、任一非 0 false） |
| 型別 | `npx tsc --noEmit` 乾淨 |
| 裝置（需使用者） | 連兩週有資料 → 新一週回顧卡每格顯示 ↑/↓/→ + 變化量；前一週無資料 → 無箭頭；舊回顧卡（無 deltas）仍正常只是無箭頭 |

## 風險與對策

| 風險 | 對策 |
|---|---|
| 前一週無資料 → 箭頭誤導 | `isEmptyWeek` → 傳 null → 不顯示 |
| 舊 `triggerData` 無 deltas 欄 | `deltas?` 選填；卡片缺 delta 不畫箭頭（防呆已在） |
| 生成時多撈一週 = 多幾次 DB 查詢 | 背景執行（`runBackgroundStartup`），且每週僅生成一次（冪等去重），成本可忽略 |
| 浮點誤差（睡眠時數相減） | `round(diff*10)/10` 清理 |
