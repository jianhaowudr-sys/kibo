# 訓練計時/佇列改善 設計

日期：2026-07-06
狀態：已與使用者逐段確認核可
分支：feature/v1.0.2-libpct-eggs

## 背景與目標

三個訓練流程需求，併為一份 spec、三條獨立工作線：

1. **進行中訓練佇列可調順序**：`workout/active.tsx` 的動作清單目前只能長按移除，不能排序。
2. **組間計時秒數自定義**：`RestTimer` 的 `[30,60,90,120]` 寫死，改成使用者自定 4 個秒數。
3. **組間休息背景倒數 + 通知**：目前 `setInterval` 每秒減一，App 縮到背景 JS 凍結 → 倒數暫停、回來時間沒扣。要能背景「照走」（正確扣時）+ 到點跳推播。

## 已確認的決策（brainstorm 結論）

| 主題 | 決定 |
|---|---|
| #1 目標畫面 | **進行中訓練佇列**（`workout/active.tsx` 的 `routineQueue`）。課表編輯頁 `routine/[id].tsx` 已有拖曳排序、不動 |
| #1 互動 | 佇列是 flex-wrap **晶片雲**（非垂直列表），DraggableFlatList 不適用 → **長按晶片 → 選單「上移／下移／移除」** |
| #2 儲存 | AsyncStorage `@kibo/rest_durations` 存 4 數字 JSON，預設 `[30,60,90,120]`，全域、跨啟動保留 |
| #2 編輯 | RestTimer 展開面板**就地編輯**：長按秒數格 → `WheelPicker`（5–600、step 5）→ 存回 |
| #3 做法 | **方案 A**：`endTime` 時間戳為真相 + `AppState` 回前景重算 + 排本地通知；**不**開真背景執行 |
| #3 範圍 | 只做 `RestTimer`（組間休息）。`ExerciseTimer`（動作計時 plank/HIIT）背景化列後續 |

## 工作線 ①：進行中佇列排序

### 現況
`routineQueue: Exercise[]`（store 狀態）在 `active.tsx:300` 以 flex-wrap 膠囊晶片渲染：點 = `setSelectedExerciseId`、長按 = 「從清單移除？」Alert。store 已有 `removeFromQueue`/`pickFromQueue`/`addExercisesToQueue`/`popRoutineQueue`/`clearRoutineQueue`，**無 reorder**。

### 設計
- **新 store action** `reorderQueue(exerciseId: number, dir: 'up' | 'down')`：在 `routineQueue` 找該 id，與相鄰前/後一項交換；邊界（首項上移、末項下移）為 no-op。純陣列操作、不寫 DB（佇列是 session 狀態）。
- **`active.tsx` 長按選單**：把現有長按的「移除單選 Alert」改成三選項 Alert：`上移`（`reorderQueue(id,'up')`）、`下移`（`reorderQueue(id,'down')`）、`移除`（`removeFromQueue`，紅色 destructive）、`取消`。首項不顯示上移、末項不顯示下移（或顯示但 no-op；以「不顯示」較清楚）。
- 提示文字 `· 長按移除` 改為 `· 長按可調整順序/移除`。

### 純邏輯
`reorderQueue` 的陣列交換抽成純函數 `swapAdjacent(list, id, dir)`（回傳新陣列，邊界回原陣列），用斷言驗。

## 工作線 ②：自定義 4 個秒數

### 設計
- **`src/lib/rest_timer.ts`（新）** 純函數 + 存取：
  - `DEFAULT_DURATIONS = [30, 60, 90, 120]`。
  - `clampDuration(n: number): number` — clamp 到 5–900，非有限數/NaN → 回 60。
  - `parseDurations(raw: string | null): number[]` — parse JSON；非 4 元素陣列/壞資料 → 回 `DEFAULT_DURATIONS`；每元素過 `clampDuration`。**純函數**。
  - `getRestDurations(): Promise<number[]>` — 讀 AsyncStorage `@kibo/rest_durations` → `parseDurations`。
  - `setRestDurations(ds: number[]): Promise<void>` — `JSON.stringify`（已 clamp）寫入。
- **RestTimer 讀取**：mount 時 `getRestDurations()` 載入 state `durations`（初值 `DEFAULT_DURATIONS`）取代寫死 `PRESETS`。
- **就地編輯**：展開面板 4 晶片，長按某格 → 開 `WheelPicker` modal（值域 5–600 step 5，初值該格現值）→ 存回：更新 `durations[i]`、`setRestDurations`、若該格 == 當前 `preset` 同步 `setRemaining`。面板加提示「長按秒數格可修改」。

## 工作線 ③：RestTimer 背景正確化 + 通知（方案 A）

### 真相來源改為時間戳
- 移除「`remaining` 每秒減一」作為真相；改 `endTimeRef`/`endTime` state（ms epoch）。
- **開始**：`const end = Date.now() + preset * 1000; setEndTime(end); setActive(true);` → 排通知（存 notifId）。
- **顯示 tick**：`setInterval` ~500ms 只重算顯示 `remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000))`；`remaining <= 0` → 進「結束」（`haptic.success()`、取消 notif、`setActive(false)`、清 endTime）。interval 純顯示，背景凍結不影響真相。
- **AppState**：`AppState.addEventListener('change', ...)`，變 `'active'` 時若 `active && endTime`：`now >= endTime` → 直接結束（notif 已由 OS 觸發）；否則畫面自動跳到正確剩餘（interval 續跑 + remaining 重算）。
- 倒數中途 4 秒提示 `haptic.tapLight()` 保留（依重算後的 remaining 判斷）。
- **一次性守衛**：500ms tick 下每個秒值會出現約兩次，故「結束」轉換與「4 秒震動」各需一個 ref 旗標，確保只觸發一次（避免雙重震動/重複結束）；開始新計時時重置旗標。

### 純函數
`computeRemaining(endTime: number, now: number): number` — `Math.max(0, Math.ceil((endTime - now) / 1000))`。用斷言驗（含已過、剛好、還在跑）。

### 通知（重用 expo-notifications）
- `src/lib/rest_timer.ts` 加 IO helper：
  - `scheduleRestDoneNotification(seconds: number): Promise<string | null>` — 先確認權限（重用 `reminders.ts` 的 `requestPermission`；未授權回 `null` 不排）；`Notifications.scheduleNotificationAsync({ content: { title: '⏱ 休息結束', body: '開始下一組！' }, trigger: { seconds } })` 回 id。
  - `cancelRestNotification(id: string | null): Promise<void>` — id 存在則 `cancelScheduledNotificationAsync`。
- **取消時機**：前景自然歸零、使用者中止/重開新計時、元件 unmount（`useEffect` cleanup）。

### 邊界
- App 完全關閉：元件狀態消失，但 OS 排的通知照跳（bonus）；重開顯示 idle。
- 離開進行中訓練頁：計時與通知隨 unmount 一起取消；rest timer 不跨頁持久化（YAGNI）。
- 權限未授予：App 內倒數（含背景回來重算）照常，僅無推播；不 nag。

## 檔案異動

| 動作 | 檔案 | 職責 |
|---|---|---|
| Create | `src/lib/rest_timer.ts` | 純函數 `clampDuration`/`parseDurations`/`computeRemaining`/`swapAdjacent`；存取 `getRestDurations`/`setRestDurations`；通知 helper |
| Create | `scripts/verify_rest_timer.ts` | 純函數斷言腳本 |
| Modify | `src/stores/useAppStore.ts` | `reorderQueue(id, dir)` action（用 `swapAdjacent`） |
| Modify | `app/workout/active.tsx` | 長按晶片 → 上移/下移/移除 選單；提示文字 |
| Modify | `src/components/RestTimer.tsx` | 自定秒數 + 就地編輯（WheelPicker）；endTime 化；AppState；通知排程/取消 |

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `scripts/verify_rest_timer.ts`（`npx -y tsx`）斷言 `clampDuration`/`parseDurations`/`computeRemaining`/`swapAdjacent` |
| 型別 | `npx tsc --noEmit` 乾淨 |
| 裝置（需使用者） | ① 長按晶片上移/下移/移除、邊界；② 改 4 格秒數→持久（重開仍在）、長按編輯；③ 休息中背景→回來時間正確扣、背景到點跳通知、前景歸零不重複通知、中止/離開無殘留通知、未授權時 App 內仍正常 |

## 範圍邊界（v1 不做，列後續）

- `ExerciseTimer`（動作計時）背景化（同 pattern 可套）。
- rest timer 跨頁/跨啟動持久化（目前綁進行中訓練頁）。
- 佇列拖曳（wrap 佈局拖放）；本輪用選單式排序。
- 每課表獨立的 rest 秒數（目前全域一組）。
