# 條碼掃描即查營養 設計

日期：2026-06-18
狀態：已與使用者逐段確認核可
分支：feature/v1.0.2-libpct-eggs

## 背景與目標

掃包裝食品條碼 → 帶出熱量/三大營養素 → 預填飲食記錄，補現有「營養標 OCR」的便利性缺口。便利商店/包裝食品的最快記錄路徑。

## 已確認的決策（brainstorm 結論）

| 主題 | 決定 |
|---|---|
| 相機 | `expo-camera`（已是 dependency v17.0.10）`CameraView` 內建條碼掃描——**零新原生依賴**，沿用 [progress/capture.tsx](app/progress/capture.tsx) 模式 |
| 資料策略 | **三層**：本地快取（custom_foods.barcode）→ Open Food Facts（OFF）→ 營養標 OCR fallback。台灣覆蓋率不足靠 OCR 補、掃過的本地學起來 |
| 本地快取 | **重用食物庫**：掃到並存下的產品就是一筆 custom food，多帶 barcode。tier-1 = `findCustomFoodByBarcode`（離線、瞬間） |
| 入口 | diet/new 加「📷 掃條碼」按鈕 → 全螢幕掃描路由 `app/diet/scan.tsx` → 結果回填 diet/new |
| OFF | keyless v2 API、6 秒 timeout、`status===1` 才命中；藏在設定 toggle 後（預設 on） |
| 結果 UX | 命中 → 預填現有 diet 表單（可編輯後存）；新產品提示「存進食物庫（帶 barcode）」 |
| 隱私 | OFF 只傳條碼數字（無圖、無帳號）；首次掃描一次性說明 |
| 結果回傳 | Zustand 暫存欄 `pendingBarcodeResult` + `consumePendingBarcodeResult`，比照既有 `pendingReward`/`pendingHatch` |

## 架構與資料流

```
diet/new「📷 掃條碼」→ router.push('/diet/scan')
  scan.tsx：CameraView onBarcodeScanned（單次守衛）→ lookupBarcode(userId, code)
    tier1 findCustomFoodByBarcode → 命中 { tier:'local', barcode, food }
    tier2 （OFF 開關 on）fetchOpenFoodFacts → mapOffProductToReading → { tier:'off', barcode, reading }
    失敗/查無/timeout → { tier:'notfound', barcode }
  → set pendingBarcodeResult → router.back()
diet/new useFocusEffect 消費 pendingBarcodeResult：
  local → onPickFromLibrary(item)（既有）＋ useCount/lastUsedAt++
  off   → apply(reading)（既有）＋ 顯示「存進食物庫」
  notfound → Alert「條碼查不到，改拍營養標？」→ photoMode='label' 接 readNutritionLabelFromBase64（既有）
存庫：saveItemToLibrary 擴充附 barcode + source:'barcode' → tier-1 快取學會此產品
```

## 結果型別

```ts
import type { CustomFood } from '@/db/schema';
import type { MealReading } from '@/lib/ocr';

export type BarcodeLookupResult =
  | { tier: 'local'; barcode: string; food: CustomFood }
  | { tier: 'off'; barcode: string; reading: MealReading }
  | { tier: 'notfound'; barcode: string };
```

## 工作線 1：資料層 / migration

- `src/db/migrate.ts`：SCHEMA_SQL 的 `CREATE TABLE custom_foods` 加 `barcode TEXT`（新安裝）；migrations 區加 `if (!(await hasColumn('custom_foods','barcode'))) await sqliteDb.runAsync('ALTER TABLE custom_foods ADD COLUMN barcode TEXT')`（升級，比照既有 column migration 模式）。
- `src/db/schema.ts`：`customFoods` 加 `barcode: text('barcode')`；`source` 註解加 `| 'barcode'`。
- `src/db/repo.ts`：新增 `findCustomFoodByBarcode(userId, barcode): Promise<CustomFood | null>`；`addCustomFood` 呼叫端可傳 `barcode` + `source: 'barcode'`（既有函數的 NewCustomFood 已含這些欄位，barcode 為新欄）。

零新表、一個 nullable 欄、可安全升級（舊資料 barcode NULL）。

## 工作線 2：查找管線

### `src/lib/food_lookup_core.ts`（純、零 import）
- `isValidBarcode(code: string): boolean` — EAN-8(8)/EAN-13(13)/UPC-A(12)/UPC-E(6~8) 長度與純數字檢查。
- `mapOffProductToReading(off: any): MealReading | null` — 把 OFF product 映射成 `MealReading`（單一 item）：
  - 名稱：`product_name`（空則 `brands` 或「未命名產品」）。
  - 營養：優先用每份欄位（`nutriments['energy-kcal_serving']` 等）＋ `serving_size` 當 portion；否則用每 100g（`*_100g`）＋ portion「每 100g」。
  - 缺熱量（每份與每 100g 都無 `energy-kcal`）→ 回 `null`（視為查無 → OCR）。
  - 回傳 items 單一項 + totals 等於該項。

### `src/lib/food_lookup.ts`（I/O）
- `isOffLookupEnabled(): Promise<boolean>` — 讀 AsyncStorage `@kibo/barcode_off_lookup`（預設 true）。
- `setOffLookupEnabled(v: boolean): Promise<void>`。
- `fetchOpenFoodFacts(barcode): Promise<any | null>` — GET `https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=product_name,brands,serving_size,nutriments`，6 秒 timeout（AbortController），`status===1` 回 product 否則 null；任何錯誤回 null。
- `lookupBarcode(userId, barcode): Promise<BarcodeLookupResult>`：
  1. tier1 `findCustomFoodByBarcode` 命中 → `{ tier:'local', barcode, food }`。
  2. `isOffLookupEnabled()` 為 true → `fetchOpenFoodFacts` → `mapOffProductToReading` 非 null → `{ tier:'off', barcode, reading }`。
  3. 否則 → `{ tier:'notfound', barcode }`。

## 工作線 3：掃描頁 `app/diet/scan.tsx`

- 全螢幕 `CameraView`，照搬 capture.tsx 的 `useCameraPermissions` 權限流（未授權請求、被拒提示去設定）。
- `barcodeScannerSettings={{ barcodeTypes: ['ean13','ean8','upc_a','upc_e'] }}` + `onBarcodeScanned`（確切 enum 實作時對齊 expo-camera v17）。
- **單次守衛**：`scanned` ref/state，只處理第一次掃描、之後鎖住直到查詢結束。
- 對準框 reticle + 提示文字；可選手電筒 `enableTorch`。
- 掃到 → haptic → 「查詢中…」遮罩 → `lookupBarcode` → 首次掃描前若 `@kibo/barcode_notice_seen` 未設則跳一次性隱私說明 → set `pendingBarcodeResult` → `router.back()`。
- `_layout.tsx` 註冊 `diet/scan`（presentation: modal, headerShown: false 或 title「掃描條碼」）。

## 工作線 4：diet/new 接線 + 存庫

- 照片區加「📷 掃條碼」按鈕 → `router.push('/diet/scan')`。
- `useFocusEffect` 消費 `pendingBarcodeResult`（消費後 `consumePendingBarcodeResult` 清掉，避免重入）：
  - `local`：CustomFood → MealItem（`name←name, portion←portion, calories←caloriesKcal, protein←proteinG, carb←carbG, fat←fatG`）→ `onPickFromLibrary`（既有，加項目＋重算）。
  - `off`：`apply(reading)`（既有）；記住此餐來自 barcode，顯示「存進食物庫」入口。
  - `notfound`：`Alert('條碼 {barcode} 查不到', '改拍營養標？', [拍營養標→photoMode='label'+開相機, 手動輸入→關閉, 取消])`。
- 存庫帶 barcode：`saveItemToLibrary(item)` 擴充——掃描來源時 `addCustomFood({ ...item, barcode, source:'barcode' })`。OCR fallback 存庫時同樣可附當下 barcode。

## 工作線 5：設定 / 隱私

- `me/health-settings.tsx`（或 me 設定區）加 toggle「條碼查無時聯網查 Open Food Facts」綁 `isOffLookupEnabled`/`setOffLookupEnabled`。
- 首次掃描一次性說明：flag `@kibo/barcode_notice_seen`，第一次跳 Alert 告知只傳條碼數字、無圖無帳號，之後不跳。
- 相機權限沿用 app.json 既有 `NSCameraUsageDescription`，不新增。

## 錯誤處理

- OFF 任何失敗（網路/timeout/查無/欄位不足）→ 靜默降級 `notfound` → OCR，不擋流程。
- 相機權限被拒 → 提示去系統設定（比照 capture.tsx）。
- 掃到非食品條碼或 `isValidBarcode` 失敗 → 提示「不是有效條碼」，留在掃描頁。

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `scripts/verify_food_lookup.ts`（`npx -y tsx`）斷言 `mapOffProductToReading`（每份/每100g/缺熱量→null）與 `isValidBarcode` |
| 型別 | `npx tsc --noEmit` 乾淨 |
| 實掃（需使用者） | 台灣商品 OFF 命中/查無、本地快取二次掃離線秒帶、OCR fallback、權限拒絕、OFF 關閉跳過 tier2、首次說明只跳一次 |

## 範圍邊界（v1 不做，列後續）

- 食物庫新增頁的獨立掃描入口（v1 只在 diet/new）。
- 條碼搜尋歷史/批次掃描。
- OFF 寫回（貢獻台灣缺漏產品）。
- 多語系產品名挑選（v1 取 OFF 預設 product_name）。
- 份量倍數選擇器整合（沿用現有 diet 表單編輯）。
