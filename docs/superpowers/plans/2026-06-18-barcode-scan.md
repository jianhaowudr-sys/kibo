# 條碼掃描即查營養 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 掃包裝食品條碼 → 三層查找（本地 custom_foods.barcode → Open Food Facts → 營養標 OCR fallback）→ 預填 diet/new 飲食記錄，掃過的存進食物庫帶 barcode 下次離線秒帶。

**Architecture:** 純查找邏輯（`isValidBarcode`/`mapOffProductToReading`）放零 runtime-import 的 `food_lookup_core.ts`（node 斷言）；I/O（OFF fetch、設定、`lookupBarcode` 編排）放 `food_lookup.ts`。掃描用 `expo-camera` `CameraView`（已是 dependency，沿用 `progress/capture.tsx` 模式），結果經 Zustand 暫存欄 `pendingBarcodeResult` 回 diet/new，三層各接既有的 `onPickFromLibrary`/`apply`/營養標 OCR。零新原生依賴、一個 nullable DB 欄。

**Tech Stack:** Expo 54 / RN 0.81 / TypeScript strict / expo-camera 17 / Zustand / expo-sqlite / AsyncStorage。無測試框架——純函數用 `npx -y tsx scripts/verify_*.ts`，其餘 `npx tsc --noEmit` ＋手動煙測。

**Spec:** `docs/superpowers/specs/2026-06-18-barcode-scan-design.md`（已核可）

---

## 檔案結構總覽

| 動作 | 檔案 | 職責 |
|---|---|---|
| Modify | `src/db/schema.ts` | `customFoods.barcode` 欄 + source 註解 |
| Modify | `src/db/migrate.ts` | SCHEMA_SQL barcode 欄 + ALTER migration |
| Modify | `src/db/repo.ts` | `rowToCustomFood` barcode；`findCustomFoodByBarcode`；`createCustomFood` barcode+source |
| Create | `src/lib/food_lookup_core.ts` | 純：`isValidBarcode`、`mapOffProductToReading` |
| Create | `scripts/verify_food_lookup.ts` | core 斷言腳本 |
| Create | `src/lib/food_lookup.ts` | I/O：OFF fetch、設定開關、`lookupBarcode`、`BarcodeLookupResult` |
| Modify | `src/stores/useAppStore.ts` | `pendingBarcodeResult` + set/consume；`addCustomFood` 接 barcode |
| Create | `app/diet/scan.tsx` | `CameraView` 條碼掃描頁 |
| Modify | `app/_layout.tsx` | 註冊 `diet/scan` 路由 |
| Modify | `app/diet/new.tsx` | 「掃條碼」入口 + focus 消費 + 存庫帶 barcode |
| Modify | `app/me/health-settings.tsx` | OFF 開關 Section |

---

### Task 1: 資料層（barcode 欄 + repo）

**Files:** Modify `src/db/schema.ts`, `src/db/migrate.ts`, `src/db/repo.ts`

- [ ] **Step 1: `src/db/schema.ts` — customFoods 加 barcode**

在 `customFoods` table（約 line 250-266）的 `source` 那行下方加 `barcode`，並更新 source 註解：

```ts
  source: text('source').notNull().default('manual'),  // 'manual' | 'ai' | 'barcode'
  barcode: text('barcode'),
```

（`CustomFood = typeof customFoods.$inferSelect` 會自動帶 `barcode: string | null`；`NewCustomFood` 帶 `barcode?: string | null`。）

- [ ] **Step 2: `src/db/migrate.ts` — SCHEMA_SQL + ALTER**

(a) SCHEMA_SQL 的 `CREATE TABLE IF NOT EXISTS custom_foods (...)`（約 line 251）在 `source TEXT NOT NULL DEFAULT 'manual',` 之後加一行：

```sql
  barcode TEXT,
```

(b) 在 migrations 區（`hasColumn` 那批 `if` 之中，例如 health_settings 那組附近）加：

```ts
  if (!(await hasColumn('custom_foods', 'barcode'))) {
    await sqliteDb.runAsync('ALTER TABLE custom_foods ADD COLUMN barcode TEXT');
  }
```

- [ ] **Step 3: `src/db/repo.ts` — rowToCustomFood + findCustomFoodByBarcode + createCustomFood**

(a) `rowToCustomFood`（約 line 1044-1059）加 barcode 映射，在 `source: r.source,` 後加：

```ts
  barcode: r.barcode ?? null,
```

(b) 在 `findCustomFoodByName`（約 line 1085-1091）之後新增：

```ts
export async function findCustomFoodByBarcode(userId: number, barcode: string): Promise<CustomFood | null> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT * FROM custom_foods WHERE user_id = ? AND barcode = ? ORDER BY use_count DESC LIMIT 1`,
    [userId, barcode],
  );
  return r ? rowToCustomFood(r) : null;
}
```

(c) `createCustomFood`（約 line 1093-1110）擴充 `source` 型別、加 `barcode` 參數與 INSERT 欄位。整段替換為：

```ts
export async function createCustomFood(data: {
  userId: number; name: string; emoji?: string;
  caloriesKcal: number; proteinG: number; carbG: number; fatG: number;
  portion?: string | null; photoUri?: string | null;
  source?: 'manual' | 'ai' | 'barcode'; barcode?: string | null;
}): Promise<number> {
  const persistedPhoto = await savePhotoToDocs(data.photoUri ?? null, 'food_library');
  const r = await sqliteDb.runAsync(
    `INSERT INTO custom_foods (user_id, name, emoji, calories_kcal, protein_g, carb_g, fat_g, portion, photo_uri, source, barcode, use_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      data.userId, data.name, data.emoji ?? '🍽',
      data.caloriesKcal, data.proteinG, data.carbG, data.fatG,
      data.portion ?? null, persistedPhoto, data.source ?? 'manual',
      data.barcode ?? null,
      Date.now(),
    ],
  );
  return Number(r.lastInsertRowId);
}
```

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。（`Row` 是 `any`-ish 內部型別，`r.barcode` 可存取；`CustomFood` 自動帶 barcode。若 cloud_sync 等對 custom_foods 做欄位列舉而報錯，回報 NEEDS_CONTEXT，不要自行擴大改動。）

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/migrate.ts src/db/repo.ts
git commit -m "feat(barcode): custom_foods.barcode 欄 + findCustomFoodByBarcode + createCustomFood 接 barcode"
```

---

### Task 2: 純查找 core + 斷言腳本

**Files:** Create `src/lib/food_lookup_core.ts`, `scripts/verify_food_lookup.ts`

`food_lookup_core.ts` 只能 `import type`（無 runtime import），這樣斷言腳本在 node 下不會拉進 RN 模組（同 `meal_verify.ts` 模式——它 `import type { MealReading } from './ocr'` 仍可 node 跑）。

- [ ] **Step 1: 先寫斷言腳本（必然失敗）**

建立 `scripts/verify_food_lookup.ts`：

```ts
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
```

- [ ] **Step 2: 跑腳本確認失敗**

Run: `npx -y tsx scripts/verify_food_lookup.ts`
Expected: FAIL `Cannot find module '../src/lib/food_lookup_core'`。

- [ ] **Step 3: 建立 `src/lib/food_lookup_core.ts`**

```ts
// 條碼查找純函數：無 runtime import（node 可直接跑，見 scripts/verify_food_lookup.ts）。
import type { MealReading } from './ocr';

/** EAN-8(8)/UPC-E(6-8)/UPC-A(12)/EAN-13(13)：純數字且長度合法。 */
export function isValidBarcode(code: string): boolean {
  return /^\d+$/.test(code) && [6, 7, 8, 12, 13].includes(code.length);
}

type OffProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
};

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
}

/** 把 OFF product 映射成單一 item 的 MealReading；優先每份、否則每 100g；無熱量回 null。 */
export function mapOffProductToReading(off: OffProduct | null | undefined): MealReading | null {
  if (!off || !off.nutriments) return null;
  const nut = off.nutriments;
  const hasServing = nut['energy-kcal_serving'] != null;
  const suffix = hasServing ? '_serving' : '_100g';
  const cal = num(nut[`energy-kcal${suffix}`]);
  if (cal <= 0) return null; // 無熱量 → 視為查無
  const name = (off.product_name || off.brands || '未命名產品').trim();
  const item = {
    name,
    portion: hasServing ? (off.serving_size || '每份') : '每 100g',
    calories: Math.round(cal),
    protein: Math.round(num(nut[`proteins${suffix}`])),
    carb: Math.round(num(nut[`carbohydrates${suffix}`])),
    fat: Math.round(num(nut[`fat${suffix}`])),
  };
  return {
    title: name,
    items: [item],
    totalCalories: item.calories,
    totalProtein: item.protein,
    totalCarb: item.carb,
    totalFat: item.fat,
  };
}
```

- [ ] **Step 4: 跑腳本確認全過**

Run: `npx -y tsx scripts/verify_food_lookup.ts`
Expected: 逐行 `ok - …`，最後 `ALL PASS (14 checks)`。

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 6: Commit**

```bash
git add src/lib/food_lookup_core.ts scripts/verify_food_lookup.ts
git commit -m "feat(barcode): 純函數 isValidBarcode/mapOffProductToReading + 斷言腳本"
```

---

### Task 3: 查找管線 I/O（food_lookup.ts）

**Files:** Create `src/lib/food_lookup.ts`

- [ ] **Step 1: 建立 `src/lib/food_lookup.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as repo from '@/db/repo';
import type { CustomFood } from '@/db/schema';
import type { MealReading } from '@/lib/ocr';
import { mapOffProductToReading } from '@/lib/food_lookup_core';

export type BarcodeLookupResult =
  | { tier: 'local'; barcode: string; food: CustomFood }
  | { tier: 'off'; barcode: string; reading: MealReading }
  | { tier: 'notfound'; barcode: string };

const OFF_KEY = '@kibo/barcode_off_lookup';

/** OFF 聯網查詢開關，預設 on。 */
export async function isOffLookupEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(OFF_KEY);
    return v !== '0';
  } catch {
    return true;
  }
}

export async function setOffLookupEnabled(v: boolean): Promise<void> {
  await AsyncStorage.setItem(OFF_KEY, v ? '1' : '0');
}

/** GET OFF v2，keyless，6 秒 timeout；status===1 回 product，否則/任何錯誤回 null。 */
export async function fetchOpenFoodFacts(barcode: string): Promise<any | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,serving_size,nutriments`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Kibo/1.0 (fitness app)' } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.status === 1 ? json.product : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 三層：本地快取 → （開關 on）OFF → notfound。 */
export async function lookupBarcode(userId: number, barcode: string): Promise<BarcodeLookupResult> {
  const local = await repo.findCustomFoodByBarcode(userId, barcode);
  if (local) return { tier: 'local', barcode, food: local };
  if (await isOffLookupEnabled()) {
    const product = await fetchOpenFoodFacts(barcode);
    const reading = mapOffProductToReading(product);
    if (reading) return { tier: 'off', barcode, reading };
  }
  return { tier: 'notfound', barcode };
}
```

- [ ] **Step 2: 型別檢查 + 斷言回歸**

Run: `npx tsc --noEmit && npx -y tsx scripts/verify_food_lookup.ts`
Expected: tsc 無輸出；腳本 `ALL PASS (14 checks)`。

- [ ] **Step 3: Commit**

```bash
git add src/lib/food_lookup.ts
git commit -m "feat(barcode): lookupBarcode 三層編排 + OFF v2 client（keyless/6s timeout/開關）"
```

---

### Task 4: store — pendingBarcodeResult + addCustomFood 接 barcode

**Files:** Modify `src/stores/useAppStore.ts`

- [ ] **Step 1: State 與 Actions 型別**

(a) 在 State 介面 `pendingReward` 宣告（約 line 95）附近加：

```ts
  pendingBarcodeResult: import('@/lib/food_lookup').BarcodeLookupResult | null;
```

(b) 在 Actions 介面 `consumePendingReward`（約 line 212）附近加：

```ts
  setPendingBarcodeResult: (r: import('@/lib/food_lookup').BarcodeLookupResult | null) => void;
  consumePendingBarcodeResult: () => import('@/lib/food_lookup').BarcodeLookupResult | null;
```

- [ ] **Step 2: 初始值與 action 實作**

(a) 在初始 state `pendingReward: null,`（約 line 280）附近加：

```ts
  pendingBarcodeResult: null,
```

(b) 在 `consumePendingReward` action 附近加（mirror 既有 pending 模式）：

```ts
  setPendingBarcodeResult: (r) => set({ pendingBarcodeResult: r }),
  consumePendingBarcodeResult: () => {
    const r = get().pendingBarcodeResult;
    if (r) set({ pendingBarcodeResult: null });
    return r;
  },
```

- [ ] **Step 3: addCustomFood action 接 barcode**

`addCustomFood` action（約 line 848-862）的 `repo.createCustomFood({...})` 呼叫，把 `source` cast 放寬並加 `barcode`：

```ts
      source: data.source as 'manual' | 'ai' | 'barcode',
      barcode: data.barcode ?? null,
```

（`data` 型別 `Omit<NewCustomFood, ...>` 已含 `barcode?: string | null`，因 Task 1 schema 加了欄位。）

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 5: Commit**

```bash
git add src/stores/useAppStore.ts
git commit -m "feat(barcode): store pendingBarcodeResult set/consume + addCustomFood 接 barcode"
```

---

### Task 5: 掃描頁 `app/diet/scan.tsx` + 路由

**Files:** Create `app/diet/scan.tsx`; Modify `app/_layout.tsx`

- [ ] **Step 1: 建立 `app/diet/scan.tsx`**

```tsx
import { View, Text, Pressable, Alert, Linking } from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as haptic from '@/lib/haptic';
import { useAppStore } from '@/stores/useAppStore';
import { lookupBarcode } from '@/lib/food_lookup';
import { isValidBarcode } from '@/lib/food_lookup_core';

const NOTICE_KEY = '@kibo/barcode_notice_seen';

export default function BarcodeScan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const setPendingBarcodeResult = useAppStore((s) => s.setPendingBarcodeResult);
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handledRef = useRef(false);

  const onScanned = async (res: BarcodeScanningResult) => {
    if (handledRef.current) return;
    const code = (res?.data || '').trim();
    if (!isValidBarcode(code)) return; // 非有效條碼，繼續掃
    handledRef.current = true;
    setBusy(true);
    haptic.tapMedium();
    try {
      const seen = await AsyncStorage.getItem(NOTICE_KEY);
      if (seen !== '1') {
        await new Promise<void>((resolve) => {
          Alert.alert(
            '關於條碼查詢',
            '查不到時會把「條碼數字」傳到 Open Food Facts 開放資料庫（不含照片、不含帳號）。可在「我 → 健康設定」關閉聯網查詢。',
            [{ text: '知道了', onPress: () => resolve() }],
          );
        });
        await AsyncStorage.setItem(NOTICE_KEY, '1');
      }
      if (!user) { router.back(); return; }
      const result = await lookupBarcode(user.id, code);
      setPendingBarcodeResult(result);
      haptic.success();
      router.back();
    } catch (e: any) {
      haptic.error();
      Alert.alert('查詢失敗', e?.message ?? String(e));
      handledRef.current = false;
      setBusy(false);
    }
  };

  if (!permission) return <View className="flex-1 bg-black" />;
  if (!permission.granted) {
    return (
      <View className="flex-1 bg-kibo-bg items-center justify-center p-6">
        <Text className="text-kibo-text text-base font-bold mb-2">需要相機權限</Text>
        <Text className="text-kibo-mute text-xs text-center mb-6">
          掃描條碼需要使用相機。授權後即可掃描，不會上傳照片。
        </Text>
        <Pressable
          onPress={async () => {
            const r = await requestPermission();
            if (!r.granted) {
              Alert.alert('還是被拒絕', '請到系統設定打開相機權限。', [
                { text: '取消', style: 'cancel' },
                { text: '打開設定', onPress: () => Linking.openSettings() },
              ]);
            }
          }}
          className="bg-kibo-primary rounded-2xl px-8 py-4 mb-3"
        >
          <Text className="text-kibo-bg font-bold">授權相機</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="py-3">
          <Text className="text-kibo-mute text-sm">取消</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      >
        {/* aiming reticle */}
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 260, height: 150, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', borderRadius: 12 }} />
        </View>

        {/* header */}
        <View style={{ position: 'absolute', top: insets.top + 8, left: 0, right: 0 }} className="px-4">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => { haptic.tapLight(); router.back(); }} className="bg-black/50 rounded-full px-4 py-2">
              <Text className="text-white text-base">✕</Text>
            </Pressable>
            <View className="bg-black/50 rounded-full px-4 py-2">
              <Text className="text-white font-bold text-sm">掃描條碼</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </View>

        {/* hint / busy */}
        <View style={{ position: 'absolute', bottom: insets.bottom + 32, left: 0, right: 0, alignItems: 'center' }}>
          <View className="bg-black/60 rounded-2xl px-4 py-2">
            <Text className="text-white text-xs">{busy ? '查詢中…' : '把條碼對準框內'}</Text>
          </View>
        </View>
      </CameraView>
    </View>
  );
}
```

（`barcodeTypes`/`BarcodeScanningResult` 為 expo-camera v17 既有 API；若 enum 字串或型別名不符，回報 NEEDS_CONTEXT 附 tsc 錯誤，不要亂猜。）

- [ ] **Step 2: `app/_layout.tsx` 註冊路由**

在 `<Stack>` 內 `diet/new` 那組 `Stack.Screen` 附近加：

```tsx
          <Stack.Screen name="diet/scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 4: Commit**

```bash
git add app/diet/scan.tsx app/_layout.tsx
git commit -m "feat(barcode): CameraView 掃描頁（單次守衛/權限/一次性說明）+ 路由"
```

---

### Task 6: diet/new 接線（入口 + focus 消費 + 存庫）

**Files:** Modify `app/diet/new.tsx`

- [ ] **Step 1: imports + state**

(a) react import 加 `useCallback`；expo-router import 加 `useFocusEffect`（檔案已 import `useRouter, useLocalSearchParams` 自 'expo-router'，把 `useFocusEffect` 併入該行）。

(b) 在既有 state 區（`photoMode` 那批附近）加：

```tsx
  const consumePendingBarcodeResult = useAppStore((s) => s.consumePendingBarcodeResult);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
```

- [ ] **Step 2: focus 消費 pendingBarcodeResult**

在 `onPickFromLibrary`/`apply` 都已定義之後（約 saveItemToLibrary 之後）加：

```tsx
  useFocusEffect(
    useCallback(() => {
      const r = consumePendingBarcodeResult();
      if (!r) return;
      if (r.tier === 'local') {
        const f = r.food;
        onPickFromLibrary({
          name: f.name,
          portion: f.portion ?? undefined,
          calories: f.caloriesKcal,
          protein: f.proteinG,
          carb: f.carbG,
          fat: f.fatG,
        });
        setScannedBarcode(null);
      } else if (r.tier === 'off') {
        apply(r.reading);
        setScannedBarcode(r.barcode); // 存庫時附上
      } else {
        setScannedBarcode(r.barcode);
        Alert.alert(`條碼 ${r.barcode} 查不到`, '改拍營養標讀取，或手動輸入數值。', [
          { text: '拍營養標', onPress: () => { setPhotoMode('label'); onChoosePhoto(); } },
          { text: '手動輸入', style: 'cancel' },
        ]);
      }
    }, [consumePendingBarcodeResult]),
  );
```

- [ ] **Step 3: 存庫帶 barcode**

`saveItemToLibrary`（約 line 197-216）的 `addCustomFood({...})` 加 barcode 與 source 條件：把 `source: 'ai',` 改為：

```tsx
      source: scannedBarcode ? 'barcode' : 'ai',
      barcode: scannedBarcode,
```

- [ ] **Step 4: 掃條碼入口按鈕**

在 `photos.length === 0` 區塊（約 line 599-622），於 2-按鈕 `View`（`拍食物+AI` / `食物庫`）之後、`💡` 提示文字之前插入：

```tsx
            <Pressable
              onPress={() => { haptic.tapLight(); router.push('/diet/scan' as any); }}
              className="bg-kibo-surface border-2 border-kibo-card rounded-2xl py-3 items-center mb-2 flex-row justify-center gap-2"
            >
              <Text className="text-xl">📷</Text>
              <Text className="text-kibo-text font-bold">掃條碼查營養</Text>
            </Pressable>
```

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 6: Commit**

```bash
git add app/diet/new.tsx
git commit -m "feat(barcode): diet/new 掃條碼入口 + focus 三層消費 + 存庫帶 barcode"
```

---

### Task 7: 設定 — OFF 開關

**Files:** Modify `app/me/health-settings.tsx`

- [ ] **Step 1: imports + state**

(a) import 區加：

```tsx
import { isOffLookupEnabled, setOffLookupEnabled } from '@/lib/food_lookup';
```

（`useState`/`useEffect` 已 import；若無，從 'react' 補。）

(b) 在元件內既有 `*Open` state 那批附近加：

```tsx
  const [scanOpen, setScanOpen] = useState(false);
  const [offEnabled, setOffEnabled] = useState(true);
  useEffect(() => { isOffLookupEnabled().then(setOffEnabled); }, []);
```

- [ ] **Step 2: 新增條碼 Section**

在 JSX 既有某個 `<Section …>` 之後加一個（用檔案內既有的 `Section` + `RowSwitch` 元件）：

```tsx
      <Section title="📷 條碼掃描" open={scanOpen} onToggle={() => setScanOpen(!scanOpen)}>
        <RowSwitch
          label="查無條碼時聯網查 Open Food Facts"
          value={offEnabled}
          onChange={async (v: boolean) => { setOffEnabled(v); await setOffLookupEnabled(v); }}
        />
        <Text style={{ color: palette.mute, fontSize: 11, marginTop: 4 }}>
          關閉後只用「已掃過的本地紀錄」與「拍營養標」，不會聯網。
        </Text>
      </Section>
```

（`palette` 在該元件已存在——`useThemePalette()`；若變數名不同，用檔案內既有的取色變數。）

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出。

- [ ] **Step 4: Commit**

```bash
git add app/me/health-settings.tsx
git commit -m "feat(barcode): 健康設定加 Open Food Facts 聯網查詢開關"
```

---

### Task 8: 驗收

**Files:** Modify `docs/superpowers/specs/2026-06-18-barcode-scan-design.md`

- [ ] **Step 1: 全量自動檢查**

Run: `npx tsc --noEmit && npx -y tsx scripts/verify_food_lookup.ts`
Expected: tsc 無輸出；腳本 `ALL PASS (14 checks)`。

- [ ] **Step 2: 裝置/網路回歸（需使用者，無裝置無法於開發環境跑）**

| # | 項目 | 怎麼驗 |
|---|---|---|
| 1 | OFF 命中 | 掃一個 OFF 有的國際商品 → diet/new 預填熱量/三大營養素 |
| 2 | 查無 → OCR | 掃台灣本地商品（OFF 無）→ 提示「改拍營養標」→ 接 OCR |
| 3 | 本地快取 | OFF 命中後存進食物庫 → 再掃同條碼 → 離線/瞬間帶出（tier local） |
| 4 | 權限拒絕 | 拒絕相機 → 顯示授權說明 + 去設定 |
| 5 | OFF 關閉 | 健康設定關開關 → 掃 OFF 有的商品也直接走 notfound（不聯網） |
| 6 | 一次性說明 | 首次掃描跳一次說明，之後不跳 |
| 7 | 非食品條碼 | 掃 QR 或長度不符 → 不誤判（CameraView 已限 type + isValidBarcode） |

- [ ] **Step 3: 補 spec 驗收狀態**

在 spec 末尾加「## 驗收狀態（2026-06-18 實作完成）」：自動檢查（tsc + 斷言 14/14）已過；上表裝置回歸待使用者實機驗收。

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-06-18-barcode-scan-design.md
git commit -m "docs(barcode): 驗收狀態（自動檢查全綠；實機待使用者）"
```

---

## 附錄：Spec 覆蓋對照

| Spec 要求 | 對應 Task |
|---|---|
| barcode 欄（migration）+ findCustomFoodByBarcode | Task 1 |
| 純函數 mapOffProductToReading/isValidBarcode + 斷言 | Task 2 |
| OFF v2 keyless/6s timeout/開關 + lookupBarcode 三層 | Task 3 |
| pendingBarcodeResult 回傳 + addCustomFood 接 barcode | Task 4 |
| CameraView 掃描頁 + 單次守衛 + 一次性說明 + 路由 | Task 5 |
| diet/new 入口 + 三層 focus 消費 + 存庫帶 barcode | Task 6 |
| 健康設定 OFF 開關 | Task 7 |
| 純函數斷言 + tsc + 裝置回歸 | Task 2, 8 |
