# SDK54 通知修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 reminders.ts 的本地通知在 SDK54 正確排程並觸發（水＝DATE、固定提醒＝DAILY 每日重複），並全域設定前景通知行為讓 banner 顯示。

**Architecture:** 把 reminders.ts 內兩個可測純邏輯（時間點列舉、HH:MM 解析）抽到零-import 的 `reminders_core.ts`，用 node 斷言腳本驗。reminders.ts 的 I/O helper 改用 SDK54 discriminated-union trigger。新增副作用模組設 `setNotificationHandler`，於 `_layout.tsx` import 一次。

**Tech Stack:** TypeScript strict、expo-notifications（SDK54）、`npx -y tsx` 跑斷言、`npx tsc --noEmit` 檢型。

## Global Constraints

- TypeScript strict；每個 task 結束 `npx tsc --noEmit` 乾淨（記憶體吃緊時 `node --max-old-space-size=2048 ./node_modules/typescript/bin/tsc --noEmit`）。
- SDK54 trigger 必須帶 `type` discriminant（`Notifications.SchedulableTriggerInputTypes.*`），不得用 `as any`。
- SDK54 `setNotificationHandler` 回傳用 `shouldShowBanner`/`shouldShowList`，不得用已淘汰的 `shouldShowAlert`。
- 純函數檔零 runtime import（可被 node 直接 require）。
- Commit 訊息結尾維持本專案慣例（無 Co-Authored 尾註要求以外照舊）。

---

### Task 1: reminders_core.ts 純函數 + 斷言腳本

**Files:**
- Create: `src/lib/reminders_core.ts`
- Create: `scripts/verify_reminders.ts`

**Interfaces:**
- Produces:
  - `type Window = { startHour: number; endHour: number }`
  - `buildIntervalTriggers(intervalMin: number, win: Window, nowMs: number): number[]` — 未來 7 天、每日 `[startHour, endHour)` 內每 `intervalMin` 分、且 `> nowMs` 的 ms epoch 陣列；`intervalMin <= 0`／非有限 → 回 `[]`。
  - `parseHhmm(hhmm: string): { hour: number; minute: number } | null` — 解析 `"H:MM"`／`"HH:MM"`，hour 0–23、minute 0–59，否則 `null`。

- [ ] **Step 1: 寫 `src/lib/reminders_core.ts`**

```ts
// 通知排程純函數：零 import（node 可直接跑，見 scripts/verify_reminders.ts）。

export type Window = { startHour: number; endHour: number };

/**
 * 未來 7 天、每日 [startHour, endHour) 內每 intervalMin 分、且 > nowMs 的觸發時間（ms epoch）。
 * intervalMin 非有限或 <= 0 → 回 []（避免無窮迴圈）。
 */
export function buildIntervalTriggers(intervalMin: number, win: Window, nowMs: number): number[] {
  const out: number[] = [];
  if (!Number.isFinite(intervalMin) || intervalMin <= 0) return out;
  const baseDate = new Date(nowMs).getDate();
  for (let d = 0; d < 7; d++) {
    const day = new Date(nowMs);
    day.setDate(baseDate + d);
    day.setHours(win.startHour, 0, 0, 0);
    while (day.getHours() < win.endHour) {
      if (day.getTime() > nowMs) out.push(day.getTime());
      day.setMinutes(day.getMinutes() + intervalMin);
    }
  }
  return out;
}

/** 解析 "H:MM" / "HH:MM"；hour 0–23、minute 0–59，否則 null。 */
export function parseHhmm(hhmm: string): { hour: number; minute: number } | null {
  if (typeof hhmm !== 'string') return null;
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{1,2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null;
  return { hour, minute };
}
```

- [ ] **Step 2: 寫 `scripts/verify_reminders.ts`**

```ts
import { buildIntervalTriggers, parseHhmm } from '../src/lib/reminders_core';

let pass = 0;
function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error('FAIL: ' + msg);
  pass++;
}

// ---- buildIntervalTriggers ----
// now = 2026-01-15 08:00 本地；win 9–12、每 60 分 → 每天 9/10/11 共 3 slot、7 天全未來 = 21
{
  const now = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
  const t = buildIntervalTriggers(60, { startHour: 9, endHour: 12 }, now);
  ok(t.length === 21, `full-window count = ${t.length}, want 21`);
  ok(t.every((ms) => ms > now), 'all triggers in the future');
  ok(t.every((ms) => new Date(ms).getMinutes() === 0), 'all on the hour');
  ok(t.every((ms) => { const h = new Date(ms).getHours(); return h >= 9 && h < 12; }), 'all hours within [9,12)');
  ok(t.every((ms, i) => i === 0 || ms > t[i - 1]), 'strictly increasing');
}
// now = 10:30 → 當天 9/10 已過，只剩 11；後 6 天各 3 → 1 + 18 = 19
{
  const now = new Date(2026, 0, 15, 10, 30, 0, 0).getTime();
  const t = buildIntervalTriggers(60, { startHour: 9, endHour: 12 }, now);
  ok(t.length === 19, `only-future count = ${t.length}, want 19`);
  ok(new Date(t[0]).getHours() === 11, 'first remaining slot is 11:00');
}
// 無效 intervalMin → []
{
  const now = new Date(2026, 0, 15, 8, 0, 0, 0).getTime();
  ok(buildIntervalTriggers(0, { startHour: 9, endHour: 12 }, now).length === 0, 'interval 0 → []');
  ok(buildIntervalTriggers(-5, { startHour: 9, endHour: 12 }, now).length === 0, 'interval -5 → []');
  ok(buildIntervalTriggers(NaN, { startHour: 9, endHour: 12 }, now).length === 0, 'interval NaN → []');
}
// 30 分間隔：win 9–10 → 每天 9:00/9:30 共 2 slot
{
  const now = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
  const t = buildIntervalTriggers(30, { startHour: 9, endHour: 10 }, now);
  ok(t.length === 14, `30-min count = ${t.length}, want 14`);
  ok(t.slice(0, 2).map((ms) => new Date(ms).getMinutes()).join(',') === '0,30', 'first day slots at :00 and :30');
}

// ---- parseHhmm ----
ok(JSON.stringify(parseHhmm('22:00')) === JSON.stringify({ hour: 22, minute: 0 }), '22:00');
ok(JSON.stringify(parseHhmm('9:05')) === JSON.stringify({ hour: 9, minute: 5 }), '9:05');
ok(JSON.stringify(parseHhmm('9:5')) === JSON.stringify({ hour: 9, minute: 5 }), '9:5 lenient minute');
ok(JSON.stringify(parseHhmm(' 7:30 ')) === JSON.stringify({ hour: 7, minute: 30 }), 'trim whitespace');
ok(parseHhmm('24:00') === null, '24:00 → null (hour out of range)');
ok(parseHhmm('12:60') === null, '12:60 → null (minute out of range)');
ok(parseHhmm('-1:00') === null, '-1:00 → null');
ok(parseHhmm('abc') === null, 'abc → null');
ok(parseHhmm('') === null, 'empty → null');
ok(parseHhmm('1200') === null, 'no colon → null');
ok(parseHhmm(null as any) === null, 'non-string → null');

console.log(`ALL PASS (${pass} checks)`);
```

- [ ] **Step 3: 跑斷言，確認全過**

Run: `npx -y tsx scripts/verify_reminders.ts`
Expected: `ALL PASS (21 checks)`

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出（乾淨）

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminders_core.ts scripts/verify_reminders.ts
git commit -m "feat(notif): reminders_core 純函數（buildIntervalTriggers/parseHhmm）+ 斷言（主線批次④）"
```

---

### Task 2: reminders.ts trigger 改 SDK54（水＝DATE、固定＝DAILY）

**Files:**
- Modify: `src/lib/reminders.ts`

**Interfaces:**
- Consumes: `buildIntervalTriggers`, `parseHhmm` from `./reminders_core`（Task 1）。
- Produces: 無新對外介面（`rescheduleAll` 等簽名不變）。

**Context:** 現況 `src/lib/reminders.ts` 內有本地 `buildIntervalTriggers`（用 `new Date()`）與 `nextDailyTrigger`，兩處 `scheduleNotificationAsync` 用 `trigger: { date } as any`。本 task 刪掉本地兩函式、改引用 core、trigger 換成 discriminated union。`ensureCategories`/`requestPermission`/`rescheduleAll`/`setupNotificationActionHandler` 邏輯不動。

- [ ] **Step 1: 加 import（檔案頂部既有 import 區）**

在 `import type { HealthSettings, ReminderConfig } from './health_settings';` 下一行加：

```ts
import { buildIntervalTriggers, parseHhmm } from './reminders_core';
```

- [ ] **Step 2: 刪除本地 `buildIntervalTriggers` 與 `nextDailyTrigger`**

刪掉現有這兩個函式定義（`function buildIntervalTriggers(...) { ... }` 整段、`function nextDailyTrigger(...) { ... }` 整段）。

- [ ] **Step 3: 改寫 `scheduleWater`（用 core + DATE trigger）**

```ts
async function scheduleWater(config: ReminderConfig) {
  if (!config.enabled || config.type !== 'interval' || !config.intervalMin || !config.activeWindow) return;
  const triggers = buildIntervalTriggers(config.intervalMin, config.activeWindow, Date.now());
  for (const ms of triggers) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💧 該喝水了',
        body: `小提醒：別忘了補水`,
        categoryIdentifier: CATEGORY_WATER,
        data: { type: 'water' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(ms) },
    });
  }
}
```

- [ ] **Step 4: 改寫 `scheduleFixedReminder`（DAILY 每日重複）**

```ts
async function scheduleFixedReminder(content: { title: string; body: string }, fixedTimes: string[] | undefined) {
  if (!fixedTimes || fixedTimes.length === 0) return;
  for (const t of fixedTimes) {
    const hm = parseHhmm(t);
    if (!hm) continue;
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: hm.hour, minute: hm.minute },
    });
  }
}
```

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出（乾淨）。若報 `DAILY` 不存在於 `SchedulableTriggerInputTypes`，確認 expo-notifications 版本 ≥ SDK54；此為 SDK54 標準 enum 值。

- [ ] **Step 6: Commit**

```bash
git add src/lib/reminders.ts
git commit -m "fix(notif): reminders trigger 補 SDK54 type（水 DATE、固定提醒改 DAILY 每日重複）（主線批次④）"
```

---

### Task 3: 全域 setNotificationHandler + 接線 _layout

**Files:**
- Create: `src/lib/notifications_setup.ts`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: 無。
- Produces: 副作用模組（import 即設定 handler）；無對外符號。

- [ ] **Step 1: 寫 `src/lib/notifications_setup.ts`**

```ts
import * as Notifications from 'expo-notifications';

// 全域前景通知行為（SDK54：shouldShowBanner/shouldShowList 取代 shouldShowAlert）。
// 模組載入即設定一次，確保任何通知抵達前就緒。
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
```

- [ ] **Step 2: 於 `app/_layout.tsx` 加副作用 import**

在第 2 行 `import 'react-native-get-random-values';` 之後新增一行：

```ts
import '@/lib/notifications_setup';
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出（乾淨）。若報 `shouldShowBanner` 不存在，確認 expo-notifications 為 SDK54（`NotificationBehavior` 已改新形狀）。

- [ ] **Step 4: 全套斷言 + 型別回歸**

Run: `npx -y tsx scripts/verify_reminders.ts && npx tsc --noEmit`
Expected: `ALL PASS (21 checks)` 且 tsc 無輸出。

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications_setup.ts app/_layout.tsx
git commit -m "feat(notif): 全域 setNotificationHandler 前景顯示 banner（SDK54 形狀）（主線批次④）"
```

---

## Self-Review

**Spec coverage:**
- reminders trigger 型別（水 DATE / 固定 DAILY）→ Task 2 ✓
- setNotificationHandler（SDK54 形狀）→ Task 3 ✓
- 純邏輯抽出 + 斷言 → Task 1 ✓
- 「固定提醒只響一次」修正 → Task 2（DAILY）✓
- iOS 64 則上限 → spec 明列本輪不做，計畫無對應 task（符合預期）✓

**Placeholder scan:** 無 TBD/TODO；每個 code step 都有完整程式碼。

**Type consistency:** `buildIntervalTriggers(intervalMin, win, nowMs): number[]`、`parseHhmm(hhmm): {hour,minute}|null` 在 Task 1 定義、Task 2 依相同簽名使用（`buildIntervalTriggers(config.intervalMin, config.activeWindow, Date.now())`、`parseHhmm(t)`）。`Window` 型別 = `{ startHour, endHour }` 與 `ReminderConfig.activeWindow` 結構相容。一致。

**驗收：** Task 1 斷言 21 檢查；Task 2/3 tsc 乾淨；裝置驗收見 spec。
