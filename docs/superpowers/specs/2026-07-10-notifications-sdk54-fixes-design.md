# 通知系統 SDK54 修正 設計

日期：2026-07-10
狀態：已與使用者確認核可（主線批次 ④）
分支：feature/v1.0.2-libpct-eggs

## 背景與目標

`rest_timer.ts`（組間休息通知）在上一個功能已修好 SDK54 的 trigger 型別，但 `reminders.ts`（喝水／排便／睡眠提醒）仍用舊寫法，且全 App 沒有設 `setNotificationHandler`。兩個後果：

1. **提醒可能根本不觸發**：`reminders.ts:63/76` 用 `trigger: { date: trig } as any`、`{ date, repeats: false } as any`，缺 SDK54 需要的 `type` discriminant。這正是 rest_timer 修過的同一類 bug。
2. **前景收不到 banner**：全域沒有 `setNotificationHandler`（grep 全 repo 僅 rest_timer 用到 `SchedulableTriggerInputTypes`，無任何 `setNotificationHandler`）。App 在前景時，OS 預設不顯示通知橫幅／不播音，使用者當下沒感覺。

目標：讓所有本地通知在 SDK54 正確排程並觸發，且前景也看得到。

## 現況診斷（程式碼證據）

- `src/lib/reminders.ts:56-64` `scheduleWater`：每個時間點 `trigger: { date: trig } as any`。
- `src/lib/reminders.ts:72-76` `scheduleFixedReminder`：`trigger: { date: trig, repeats: false } as any`；而且是「只排下一次」，靠 `rescheduleAll`（僅在 `updateHealthSettings` 時呼叫）再補——若使用者不改設定，排便／睡眠提醒**只會響一次**。
- 全 repo 無 `setNotificationHandler`（`app/_layout.tsx` 只在 useEffect 掛了 `setupNotificationActionHandler`＝action 回應監聽，非前景顯示設定）。

## 範圍

**做**：
1. `reminders.ts` trigger 改用 SDK54 discriminated union（水＝`DATE` 一次性、固定提醒＝`DAILY` 每日重複）。
2. 新增全域 `setNotificationHandler`（SDK54 的 `shouldShowBanner`/`shouldShowList` 新形狀），於 App 啟動時一次設定。
3. 把 `reminders.ts` 內可測純邏輯（時間點列舉、HH:MM 解析）抽成零-import core + 斷言腳本。

**不做（列後續）**：
- iOS 64 則待觸發通知上限：水提醒目前列舉「7 天 × 每日視窗內每 N 分鐘」可能產生 >64 則被 OS 靜默丟棄。本輪不改列舉策略（屬既有行為），列後續建議加總量上限。
- 提醒內容個人化、通知分組、Android channel 細分。

## 工作線 ①：reminders.ts trigger 型別修正 + 固定提醒改每日重複

### 設計
- **水（interval，視窗內每 N 分）**：維持列舉具體時間，但每則 `trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date }`。行為不變，只補型別。
- **固定提醒（排便／睡眠，HH:MM）**：改用 `trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute }`——OS 每日自動重複，修掉「只響一次」。移除 `nextDailyTrigger`（不再需要算下一個 Date）。
- `rescheduleAll` 開頭的 `cancelAllScheduledNotificationsAsync()` 不變（DAILY 也會被清乾淨後重建）。

### 純邏輯（抽 `reminders_core.ts`，零 import，node 可跑）
- `buildIntervalTriggers(intervalMin, win: { startHour, endHour }, nowMs): number[]`——回傳未來 7 天、每日 `[startHour, endHour)` 內、每 `intervalMin` 分、且 `> now` 的 ms 時間戳陣列。（把現有同名函式的 `new Date()` 依賴改成傳入 `nowMs`，caller 用 `new Date(ms)` 包成 Date。）
- `parseHhmm(hhmm): { hour: number; minute: number } | null`——解析 `"9:05"`／`"22:00"`；小時 0–23、分鐘 0–59，超界或格式壞回 `null`（caller 跳過該筆、不排壞通知）。

## 工作線 ②：全域 setNotificationHandler

### 設計
- 新檔 `src/lib/notifications_setup.ts`：**模組載入即副作用**呼叫
  ```ts
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,   // SDK54：取代舊 shouldShowAlert
      shouldShowList: true,     // SDK54：通知中心列表
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  ```
- `app/_layout.tsx` 最上方加 `import '@/lib/notifications_setup';`（副作用 import，保證在任何通知抵達前、App 啟動時設定一次）。
- 用 SDK54 新回傳形狀（`shouldShowBanner`+`shouldShowList`），不用已淘汰的 `shouldShowAlert`（型別會擋）。

## 檔案異動

| 動作 | 檔案 | 職責 |
|---|---|---|
| Create | `src/lib/reminders_core.ts` | 純函數 `buildIntervalTriggers`（傳入 nowMs）、`parseHhmm` |
| Create | `scripts/verify_reminders.ts` | 純函數斷言腳本 |
| Create | `src/lib/notifications_setup.ts` | 模組載入即設 `setNotificationHandler`（SDK54 形狀） |
| Modify | `src/lib/reminders.ts` | 引用 core；水＝`DATE`、固定提醒＝`DAILY`；移除 `nextDailyTrigger` |
| Modify | `app/_layout.tsx` | 副作用 import `notifications_setup` |

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `npx -y tsx scripts/verify_reminders.ts`：`buildIntervalTriggers`（視窗邊界、只取未來、7 天總數、跨日）、`parseHhmm`（合法／單位數／超界／壞字串） |
| 型別 | `npx tsc --noEmit` 乾淨（記憶體吃緊時 `node --max-old-space-size=2048 ./node_modules/typescript/bin/tsc --noEmit`） |
| 裝置（需使用者） | 開喝水提醒→前景時間到跳 banner + 響；排便／睡眠設 HH:MM→到點跳、且**隔天再跳一次**（驗每日重複）；背景與鎖屏照跳；關掉提醒→`rescheduleAll` 清空不再跳 |

## 風險與對策

| 風險 | 對策 |
|---|---|
| 固定提醒改 DAILY 是行為變更（原本只響一次） | 這是修正而非退步；spec/驗收明列，使用者實機確認隔天仍響 |
| iOS 64 則上限：水提醒 7 天列舉可能超額被靜默丟棄 | 本輪不動（既有行為），列後續建議加總量上限；文件記錄 |
| DAILY trigger 需要 hour/minute 有效值 | `parseHhmm` 回 null 時 caller 跳過該筆，不排壞通知 |

## 後續建議（本輪不做）

- 水提醒總量上限（避免 iOS 64 則靜默丟棄）——需要重新設計列舉/改用 channel 或動態補排。
- 通知內容依使用者暱稱／寵物口吻個人化。

## 驗收狀態（2026-07-10 實作完成）

**已自動驗證（本機）：**
- `npx -y tsx scripts/verify_reminders.ts` → ALL PASS (23 checks)：`buildIntervalTriggers`（視窗邊界／只取未來／7 天／跨日／無效間隔）+ `parseHhmm`（合法／單位數／超界／壞字串）。
- `npx tsc --noEmit` 全綠。
- 逐 task 雙審 + 最終整功能審查（e0c7c2f..bb71e50）＝ **Ready to merge Yes**；三個 Minor 皆 defer（無阻擋）。
- Bonus：全域 `setNotificationHandler` 讓先前的 rest_timer 前景也會跳 banner。

**實作摘要（3 commits，fa2693c..bb71e50）：**
- `reminders_core.ts` 純函數 + 斷言；`reminders.ts` 水＝`DATE`、固定提醒＝`DAILY` 每日重複；`notifications_setup.ts` 全域 `setNotificationHandler`（SDK54 `shouldShowBanner`/`shouldShowList`）接 `_layout.tsx`。

**待使用者在實機驗收：**
- 喝水提醒前景到點跳 banner + 響；排便／睡眠 HH:MM 到點跳、且**隔天再跳一次**（驗 DAILY 每日重複）；背景／鎖屏照跳；關掉提醒 → 不再跳。
- Android heads-up banner 另需通知 channel importance = HIGH（本輪未設，裝置上觀察；列後續）。

**列後續（本輪不做）：**
- iOS 64 則待觸發上限（水提醒 7 天列舉可能超額被靜默丟棄）。
- Android HIGH importance channel（heads-up banner）。
