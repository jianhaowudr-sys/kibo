# 每週回顧卡 設計

日期：2026-06-17
狀態：已與使用者逐段確認核可
分支：feature/v1.0.2-libpct-eggs

## 背景與目標

把使用者已記錄的一週健康/訓練/飲食資料，彙整成「每週回顧」，透過現有的寵物訊息系統推播到首頁。資料來源與推播管道大多已存在，核心工作是：週彙整邏輯、生成觸發、rich 呈現。

## 已確認的決策（brainstorm 結論）

| 主題 | 決定 |
|---|---|
| 交付形式 | **B：預告 → 專屬畫面**。回顧存成特殊寵物訊息，teaser 卡當入口，訊息頁 rich 渲染數據磚 |
| 觸發時機 | **固定日曆週**（週一起算）。新的一週首次開 App，生成「上一個完整週」回顧 |
| 語氣 | **寵物口吻標題 + 中性數據磚**。標題由「亮點挑選」邏輯產生 |
| v1 範圍 | **純本週數據**，不含與上週比較；亮點用絕對門檻 |
| 熱量均 | 除以「有記錄的天數」（mealDays），不除固定 7 |
| 空週 | 全無活動的週**跳過不生**，不對新/不活躍使用者嘮叨 |
| 漏週 | v1 只生「最近一個完整週」，**不回補**更早漏掉的週 |
| 儲存方案 | **方案 1**：`PetMessageCategory` 加 `'weekly'`（純 TS、零 migration），數據存進現成 `triggerData` JSON |

## 架構與資料流

```
背景啟動（runBackgroundStartup）
  → generateDailyMessages（既有）
  → maybeGenerateWeeklyReview（新）
       ├ 算上一個完整週 [weekStart, weekEnd]
       ├ 去重：已有該週 'weekly' 訊息？→ 跳過
       ├ gatherWeeklyReview（DB I/O）→ computeWeeklySummary（純函數）
       ├ 空週守衛：workoutCount===0 && mealDays===0 && sleepNights===0 && waterDailyAvgMl===0 → 跳過
       ├ pickHighlight（純函數）→ 標題
       └ addPetMessage({ category:'weekly', text:標題, triggerData:JSON })

首頁 PetMessageCard（既有）：顯示最新訊息 text（weekly 即標題）＋ 📊 icon，點擊 → /pet/messages
訊息頁 pet/messages：category==='weekly' → <WeeklyReviewBlock>（解析 triggerData 渲染磚）；其它類別維持純文字
```

## 資料模型

```ts
export type WeeklyReviewData = {
  weekStartKey: string;   // 'YYYY-MM-DD'（週一）
  weekEndKey: string;     // 'YYYY-MM-DD'（週日）
  workoutCount: number;   // 該週訓練次數
  workoutDays: number;    // 該週有訓練的不重複天數
  calorieAvg: number;     // 該週總熱量 ÷ mealDays（四捨五入）
  proteinAvg: number;     // 該週總蛋白質 ÷ mealDays
  mealDays: number;       // 該週有 ≥1 筆飲食記錄的天數
  sleepHoursAvg: number;  // 該週有資料的夜，主睡眠平均時數（1 位小數）
  sleepNights: number;    // 該週有主睡眠記錄的夜數
  waterDailyAvgMl: number;// 該週總喝水量 ÷ 7（四捨五入）
};
```

`triggerData` 欄存 `JSON.stringify(WeeklyReviewData)`。

**除零守衛**（`computeWeeklySummary` 必須處理）：
- `mealDays === 0` → `calorieAvg = 0`、`proteinAvg = 0`（不除零）。
- `sleepNights === 0` → `sleepHoursAvg = 0`。
- `waterDailyAvgMl` 固定除 7，無除零問題。

## 元件設計（職責隔離）

### `src/lib/weekly_review.ts`（新）
- `computeWeeklySummary(inputs, weekRange): WeeklyReviewData` — **純函數**，吃已撈出的陣列（workouts/meals/sleeps/waters）與週範圍，做過濾、加總、平均。無 DB、可在 node 跑斷言。
- `gatherWeeklyReview(userId, weekStart, weekEnd): Promise<WeeklyReviewData>` — DB I/O：呼叫 repo 撈該週資料，交給 `computeWeeklySummary`。
- `pickHighlight(data): string` — **純函數**，依序規則挑亮點標題（見下）。回傳純文字（不含 emoji，避免與 `📊` 重複）。
- `maybeGenerateWeeklyReview(userId, pet): Promise<void>` — 觸發編排：算週、去重、空週守衛、生成、寫入。整體 try/catch → `console.warn`。

### `src/components/pet/WeeklyReviewBlock.tsx`（新）
- props：`{ message: PetMessage }`。
- 解析 `message.triggerData`；成功 → 渲染標題 + 週期間 + 數據磚（2 欄，6 磚：訓練次數、睡眠均、熱量均、蛋白質均、喝水均、飲食記錄天數）。每個 `WeeklyReviewData` 欄位都有對應磚，無「算了但不顯示」的欄位。
- 解析失敗/缺資料 → 退回只顯示 `message.text`（graceful fallback）。

### 既有檔修改
- `src/db/repo.ts`：新增 `listMealsBetween(userId, fromMs, toMs): Promise<Meal[]>`（補 `gatherActivity` 那個 `// 之後有 listMealsBetween 再 swap` 的缺口；本 spec 不改 gatherActivity 本身）。
- `src/db/schema.ts`：`PetMessageCategory` union 加 `'weekly'`，更新 category 欄註解。**無 DB migration**。
- `src/lib/startup.ts`：`runBackgroundStartup` 在 `generateDailyMessages` 後呼叫 `maybeGenerateWeeklyReview`。
- `app/pet/messages.tsx`：map 加 weekly 分支 → `<WeeklyReviewBlock>`；`CATEGORY_ICON`/`CATEGORY_LABEL` 加 `weekly`。
- `src/components/dashboard/PetMessageCard.tsx`：`CATEGORY_ICON` 加 `weekly: '📊'`。

## 亮點挑選規則（pickHighlight，依序第一個命中）

1. `workoutDays >= 5` → 「這週訓練 {workoutDays} 天，超猛的！」
2. `workoutCount >= 3` → 「這週練了 {workoutCount} 次，很穩！」
3. `sleepNights >= 4 && sleepHoursAvg >= 7` → 「睡眠均 {sleepHoursAvg}h，作息顧得很好～」
4. `mealDays >= 6` → 「飲食 {mealDays} 天都有記，超自律！」
5. `waterDailyAvgMl >= 2000` → 「喝水達標，{waterDailyAvgMl/1000 取 1 位} L／天！」
6. 其餘（有任何活動）→ 「這週有動有記，繼續保持！」

註：空週在生成前已被守衛擋掉，故規則 6 涵蓋「低但非零」的週。

## 週界線計算

- 用 date-fns：`startOfWeek(d, { weekStartsOn: 1 })`、`endOfWeek(d, { weekStartsOn: 1 })`。
- 「上一個完整週」：以 `subWeeks(now, 1)` 為基準取 start/end。
- `weekStartKey` = `format(weekStart, 'yyyy-MM-dd')`。

## 錯誤處理

- `maybeGenerateWeeklyReview` 整體 try/catch → `console.warn`，永不擋啟動（比照 `generateDailyMessages`）。
- `WeeklyReviewBlock` 解析 `triggerData` 失敗 → fallback 顯示 `message.text`。

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `scripts/verify_weekly_review.ts`（`npx -y tsx`）斷言 `computeWeeklySummary`（過濾/平均/邊界）與 `pickHighlight`（每層規則 + fallback） |
| 型別 | `npx tsc --noEmit` 乾淨 |
| 生成 | 實機：造一週資料 → 跨到新週首開 → 出現 weekly 訊息（需使用者協助） |
| 去重 | 同週重開 App 不重覆生 |
| 渲染 | teaser 顯示標題；訊息頁 weekly 渲染磚；triggerData 壞掉 fallback 純文字 |
| 空週 | 全無活動的週不生 |

## 風險與對策

| 風險 | 對策 |
|---|---|
| 加 `'weekly'` 後，其它讀 `category` 的地方未涵蓋 | 全域搜尋 `CATEGORY_ICON`/`CATEGORY_LABEL`/category switch，補上 weekly；未涵蓋處 fallback 已有預設（`?? '🐣'` / `?? m.category`） |
| 週界線時區/夏令 | 用裝置本地時間 + date-fns，與 app 其它日期邏輯一致 |
| `listMealsBetween` 與既有 meal 查詢語意不一致 | 以 `loggedAt` ms 範圍查，回傳 `Meal[]`，與 `listMealsByDate` 同表同型別 |
| 睡眠歸日與「週」對齊 | 用既有 `listMainSleepsByDay` 跑該週 7 個 dayKey，沿用 app 既有的跨夜歸日邏輯 |

## 範圍邊界（v1 不做，列後續）

- 與上週比較（↑↓ delta）。
- 回補久未開 App 漏掉的舊週。
- 週首可設定（週一/週日）。
- 更多指標（體重變化、PR、trinity 完整度、EXP）。
- 把 `gatherActivity`（每日訊息）的 meal 簡化也 swap 成 `listMealsBetween`（本輪只新增 helper，不改既有行為）。

## 驗收狀態（2026-06-17 實作完成）

**已自動驗證（本機）：**
- `npx tsc --noEmit` 全綠（每個 task 完成時皆通過）。
- `npx -y tsx scripts/verify_weekly_review.ts` → ALL PASS (14 checks)：`computeWeeklySummary`（過濾/平均/除零守衛）＋ `pickHighlight`（每層規則 + 規則順序 + fallback）。

**實作摘要（8 commits，9dbd368…a29a745）：**
- 純邏輯抽零 import 的 `weekly_review_core.ts`（可 node 斷言）；I/O 與生成在 `weekly_review.ts`。
- 審查意見已採納：水量顯示統一 1 位小數（核心與渲染一致）；斷言改精確比對＋加規則順序測試；去重改 `category` 限定查詢、訓練改 `listWorkoutsBetween` 範圍查詢（去除 fetch-N-then-filter 隱含上限）；渲染 fallback 守衛加數值欄位檢查。

**待使用者在實機驗收：**
- 生成：造上週資料（訓練/飲食/睡眠/喝水任一）→ 跨到新週首開 App → 收到 📊 weekly 訊息。
- teaser：首頁寵物訊息卡顯示 `📊 + 標題`；點進訊息頁顯示 6 磚（訓練/睡眠均/熱量均/蛋白質均/喝水均/飲食天數）＋週期間。
- 去重：同週重開不重生。空週：上週全無活動不生。
- 亮點：標題隨數據變。fallback：triggerData 壞掉只顯示標題、不崩。
- 既有每日訊息（greeting/concern/celebration/reminder）不受影響。
