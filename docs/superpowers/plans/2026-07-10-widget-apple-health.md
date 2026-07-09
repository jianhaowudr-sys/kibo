# Widget / Apple Health Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** iOS 上 Kibo 寫入 Apple Health（訓練/營養/喝水/體重）+ 讀步數/活動能量顯示；主畫面 WidgetKit widget 顯示今日摘要。

**Architecture:** 純函數（Kibo 值→HK 樣本、今日摘要→widget payload）零 import + 斷言。TS wrapper 用**本地最小介面 + 變數名 require**存取原生模組（不必裝相依即可 tsc；graceful fallback），原生呼叫集中 adapter。config（deps + app.json plugins/entitlements）與 SwiftUI widget target 為**裝置 build only**。

**Tech Stack:** Expo SDK54 managed、`@kingstinct/react-native-healthkit`(+`react-native-nitro-modules`)、`@bacons/apple-targets`、TypeScript strict。

## Global Constraints

- TypeScript strict；每 task 結束 `npx tsc --noEmit` 乾淨（OOM 時 `node --max-old-space-size=2048 ./node_modules/typescript/bin/tsc --noEmit`）。
- 純函數檔（`health_core.ts`/`widget_core.ts`）零 runtime import。
- TS wrapper **不得** static import 原生相依（用變數名 `require` + 本地介面），確保未裝相依也 tsc 綠、且 Android/模組缺時 graceful no-op、**永不 throw、永不擋主流程**。
- App Group 名稱一律 `group.app.kibo.fitness`；HK 型別識別碼/單位以 `health_core.ts` 常數為單一真相源。
- **原生（Swift/target/prebuild）本機無法驗**：Task 4/5 device-only，reviewer 只審 config/契約合理性。

---

### Task 1: 純函數 health_core + widget_core + 斷言

**Files:**
- Create: `src/lib/health_core.ts`
- Create: `src/lib/widget_core.ts`
- Create: `scripts/verify_health_widget.ts`

**Interfaces produced:**
- `health_core`: `type HKQuantityInput = { identifier: string; unit: string; value: number }`; `HK_ID`（識別碼常數）; `nutritionSamples(m)`, `waterSample(ml)`, `weightSample(kg)`.
- `widget_core`: `type WidgetPayload`, `type WidgetInput`; `buildWidgetPayload(input)`.

- [ ] **Step 1: 寫 `src/lib/health_core.ts`**

```ts
// HealthKit 樣本對應純函數（零 import）。見 scripts/verify_health_widget.ts。

export type HKQuantityInput = { identifier: string; unit: string; value: number };

export const HK_ID = {
  dietaryEnergy: 'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  protein: 'HKQuantityTypeIdentifierDietaryProtein',
  carb: 'HKQuantityTypeIdentifierDietaryCarbohydrates',
  fat: 'HKQuantityTypeIdentifierDietaryFatTotal',
  water: 'HKQuantityTypeIdentifierDietaryWater',
  bodyMass: 'HKQuantityTypeIdentifierBodyMass',
  stepCount: 'HKQuantityTypeIdentifierStepCount',
  activeEnergy: 'HKQuantityTypeIdentifierActiveEnergyBurned',
} as const;

function pos(n: number | undefined | null): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

/** 飲食營養素 → HK 樣本；略過缺/≤0/非有限。 */
export function nutritionSamples(m: { calories?: number; protein?: number; carb?: number; fat?: number }): HKQuantityInput[] {
  const out: HKQuantityInput[] = [];
  if (pos(m.calories)) out.push({ identifier: HK_ID.dietaryEnergy, unit: 'kcal', value: m.calories });
  if (pos(m.protein)) out.push({ identifier: HK_ID.protein, unit: 'g', value: m.protein });
  if (pos(m.carb)) out.push({ identifier: HK_ID.carb, unit: 'g', value: m.carb });
  if (pos(m.fat)) out.push({ identifier: HK_ID.fat, unit: 'g', value: m.fat });
  return out;
}

/** 喝水 → HK 樣本（mL）；ml≤0/非有限 → null。 */
export function waterSample(ml: number): HKQuantityInput | null {
  return pos(ml) ? { identifier: HK_ID.water, unit: 'mL', value: ml } : null;
}

/** 體重 → HK 樣本（kg）；0<kg<500，否則 null。 */
export function weightSample(kg: number): HKQuantityInput | null {
  return pos(kg) && kg < 500 ? { identifier: HK_ID.bodyMass, unit: 'kg', value: kg } : null;
}
```

- [ ] **Step 2: 寫 `src/lib/widget_core.ts`**

```ts
// Widget 顯示 payload 純函數（零 import）。見 scripts/verify_health_widget.ts。

export type WidgetPayload = {
  dateKey: string;
  caloriesEaten: number;
  caloriesTarget: number;
  workouts: number;
  waterMl: number;
  waterTargetMl: number;
};

export type WidgetInput = {
  dateKey: string;
  caloriesEaten?: number;
  caloriesTarget?: number;
  workouts?: number;
  waterMl?: number;
  waterTargetMl?: number;
};

function nn(n: number | undefined | null): number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
}

/** 今日摘要 → widget 扁平 payload；缺值/非有限/負 → 0；dateKey 非字串 → ''。 */
export function buildWidgetPayload(input: WidgetInput): WidgetPayload {
  return {
    dateKey: typeof input.dateKey === 'string' ? input.dateKey : '',
    caloriesEaten: nn(input.caloriesEaten),
    caloriesTarget: nn(input.caloriesTarget),
    workouts: nn(input.workouts),
    waterMl: nn(input.waterMl),
    waterTargetMl: nn(input.waterTargetMl),
  };
}
```

- [ ] **Step 3: 寫 `scripts/verify_health_widget.ts`**

```ts
import { nutritionSamples, waterSample, weightSample, HK_ID } from '../src/lib/health_core';
import { buildWidgetPayload } from '../src/lib/widget_core';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

// ---- nutritionSamples ----
{
  const s = nutritionSamples({ calories: 600, protein: 20, carb: 80, fat: 15 });
  ok(s.length === 4, 'full → 4 samples');
  ok(s[0].identifier === HK_ID.dietaryEnergy && s[0].unit === 'kcal' && s[0].value === 600, 'energy sample');
  ok(s[1].identifier === HK_ID.protein && s[1].unit === 'g', 'protein g');
}
{
  const s = nutritionSamples({ calories: 600, protein: 0, fat: -5 });
  ok(s.length === 1 && s[0].identifier === HK_ID.dietaryEnergy, 'skip 0/neg, keep energy');
}
ok(nutritionSamples({}).length === 0, 'empty → []');
ok(nutritionSamples({ calories: NaN }).length === 0, 'NaN skipped');
ok(nutritionSamples({ calories: 600 }).length === 1, 'only calories → 1 sample');

// ---- waterSample ----
ok(waterSample(500)?.identifier === HK_ID.water && waterSample(500)?.unit === 'mL', 'water sample mL');
ok(waterSample(0) === null, 'water 0 → null');
ok(waterSample(-10) === null, 'water neg → null');
ok(waterSample(NaN) === null, 'water NaN → null');

// ---- weightSample ----
ok(weightSample(70)?.identifier === HK_ID.bodyMass && weightSample(70)?.unit === 'kg', 'weight sample kg');
ok(weightSample(0) === null, 'weight 0 → null');
ok(weightSample(600) === null, 'weight >=500 → null');
ok(weightSample(NaN) === null, 'weight NaN → null');

// ---- buildWidgetPayload ----
{
  const p = buildWidgetPayload({ dateKey: '2026-07-10', caloriesEaten: 1200.6, caloriesTarget: 2000, workouts: 1, waterMl: 1500, waterTargetMl: 2000 });
  ok(p.caloriesEaten === 1201 && p.caloriesTarget === 2000, 'rounds/keeps values');
  ok(p.dateKey === '2026-07-10' && p.workouts === 1 && p.waterMl === 1500, 'passthrough fields');
}
{
  const p = buildWidgetPayload({ dateKey: 'x' });
  ok(p.caloriesEaten === 0 && p.caloriesTarget === 0 && p.workouts === 0 && p.waterMl === 0 && p.waterTargetMl === 0, 'missing → 0');
}
{
  const p = buildWidgetPayload({ dateKey: 'x', caloriesEaten: -5, waterMl: NaN });
  ok(p.caloriesEaten === 0 && p.waterMl === 0, 'neg/NaN → 0');
}
ok(buildWidgetPayload({ dateKey: 123 as any }).dateKey === '', 'non-string dateKey → ""');

console.log(`ALL PASS (${pass} checks)`);
```

- [ ] **Step 4:** Run `npx -y tsx scripts/verify_health_widget.ts` → expect `ALL PASS (20 checks)`
- [ ] **Step 5:** Run `npx tsc --noEmit` → clean
- [ ] **Step 6: Commit**

```bash
git add src/lib/health_core.ts src/lib/widget_core.ts scripts/verify_health_widget.ts
git commit -m "feat(native): health_core/widget_core 純函數（HK 樣本對應 / widget payload）+ 斷言（主線批次③）"
```

---

### Task 2: health_kit.ts wrapper（graceful fallback）

**Files:**
- Create: `src/lib/health_kit.ts`

**Interfaces:**
- Consumes: `health_core`（Task 1）。
- Produces: `isHealthAvailable()`, `getHealthSyncEnabled()/setHealthSyncEnabled(on)`, `requestHealthPermissions()`, `writeNutritionToHealth(m)`, `writeWaterToHealth(ml)`, `writeWeightToHealth(kg)`, `writeWorkoutToHealth(w)`, `readTodaySteps()`, `readTodayActiveEnergy()`.

**Context:** 用**變數名 require**存取 `@kingstinct/react-native-healthkit`（不 static import → 未裝也 tsc 綠；`require` 在本專案可用，見 `app/_layout.tsx` 既有 `require`）。本地 `HealthKitModule` 最小介面涵蓋用到的函數；裝置 build 時對照 v9 Nitro 實際 API 調整此一處 adapter。

- [ ] **Step 1: 寫 `src/lib/health_kit.ts`**

```ts
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nutritionSamples, waterSample, weightSample, HK_ID, type HKQuantityInput } from './health_core';

// 本地最小介面（避免 static import 未裝相依；裝置 build 時對照 @kingstinct/react-native-healthkit v9 實際 API 調整）。
type HealthKitModule = {
  isHealthDataAvailable: () => boolean;
  requestAuthorization: (share: string[], read: string[]) => Promise<boolean>;
  saveQuantitySample: (identifier: string, unit: string, value: number, options?: unknown) => Promise<boolean>;
  saveWorkoutSample: (activityType: number, quantities: unknown[], start: Date, end: Date, options?: unknown) => Promise<boolean>;
  queryStatisticsForQuantity: (identifier: string, unit: string, from: Date, to?: Date) => Promise<{ sumQuantity?: { quantity: number } } | null>;
};

const HEALTHKIT_MODULE = '@kingstinct/react-native-healthkit';
let HK: HealthKitModule | null = null;
try { HK = require(HEALTHKIT_MODULE) as HealthKitModule; } catch { HK = null; }

const SYNC_KEY = '@kibo/health_sync_enabled';
const SHARE = [HK_ID.dietaryEnergy, HK_ID.protein, HK_ID.carb, HK_ID.fat, HK_ID.water, HK_ID.bodyMass];
const READ = [HK_ID.stepCount, HK_ID.activeEnergy];

export function isHealthAvailable(): boolean {
  try { return Platform.OS === 'ios' && !!HK && HK.isHealthDataAvailable(); } catch { return false; }
}

export async function getHealthSyncEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(SYNC_KEY)) === '1'; } catch { return false; }
}
export async function setHealthSyncEnabled(on: boolean): Promise<void> {
  try { await AsyncStorage.setItem(SYNC_KEY, on ? '1' : '0'); } catch {}
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (!isHealthAvailable() || !HK) return false;
  try { return await HK.requestAuthorization(SHARE, READ); }
  catch (e) { console.warn('[health] auth failed', e); return false; }
}

async function saveSamples(samples: HKQuantityInput[]): Promise<void> {
  if (!HK) return;
  for (const s of samples) {
    try { await HK.saveQuantitySample(s.identifier, s.unit, s.value); }
    catch (e) { console.warn('[health] save failed', s.identifier, e); }
  }
}

async function guardedWrite(fn: () => Promise<void>): Promise<void> {
  if (!isHealthAvailable()) return;
  if (!(await getHealthSyncEnabled())) return;
  try { await fn(); } catch (e) { console.warn('[health] write failed', e); }
}

export async function writeNutritionToHealth(m: { calories?: number; protein?: number; carb?: number; fat?: number }): Promise<void> {
  await guardedWrite(() => saveSamples(nutritionSamples(m)));
}
export async function writeWaterToHealth(ml: number): Promise<void> {
  await guardedWrite(async () => { const s = waterSample(ml); if (s) await saveSamples([s]); });
}
export async function writeWeightToHealth(kg: number): Promise<void> {
  await guardedWrite(async () => { const s = weightSample(kg); if (s) await saveSamples([s]); });
}
export async function writeWorkoutToHealth(w: { start: Date; end: Date; kcal?: number }): Promise<void> {
  await guardedWrite(async () => {
    if (!HK) return;
    // activityType 3000 = HKWorkoutActivityTypeOther；裝置 build 對照調整
    await HK.saveWorkoutSample(3000, [], w.start, w.end);
  });
}

async function readTodaySum(identifier: string, unit: string): Promise<number> {
  if (!isHealthAvailable() || !HK) return 0;
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const stats = await HK.queryStatisticsForQuantity(identifier, unit, start, new Date());
    return Math.round(stats?.sumQuantity?.quantity ?? 0);
  } catch (e) { console.warn('[health] read failed', identifier, e); return 0; }
}
export async function readTodaySteps(): Promise<number> { return readTodaySum(HK_ID.stepCount, 'count'); }
export async function readTodayActiveEnergy(): Promise<number> { return readTodaySum(HK_ID.activeEnergy, 'kcal'); }
```

- [ ] **Step 2:** Run `npx tsc --noEmit` → clean（若 `require` 型別報錯，確認 tsconfig 已含 RN 環境；本專案 `app/_layout.tsx` 已用 `require`）。
- [ ] **Step 3: Commit**

```bash
git add src/lib/health_kit.ts
git commit -m "feat(native): health_kit wrapper（寫入/讀取 + 同步開關 + graceful fallback）（主線批次③）"
```

---

### Task 3: widget_data.ts（ExtensionStorage 寫入 + reload）

**Files:**
- Create: `src/lib/widget_data.ts`

**Interfaces:**
- Consumes: `widget_core`（Task 1）。
- Produces: `updateWidget(input: WidgetInput): void`。

- [ ] **Step 1: 寫 `src/lib/widget_data.ts`**

```ts
import { Platform } from 'react-native';
import { buildWidgetPayload, type WidgetInput } from './widget_core';

const APP_GROUP = 'group.app.kibo.fitness';
const APPLE_TARGETS_MODULE = '@bacons/apple-targets';

// 本地最小介面（避免 static import 未裝相依；裝置 build 對照實際 API）。
type ExtensionStorageInstance = { set: (k: string, v: string) => void };
type ExtensionStorageStatic = {
  new (group: string): ExtensionStorageInstance;
  reloadWidget: (name?: string) => void;
};

let ExtensionStorage: ExtensionStorageStatic | null = null;
try { ExtensionStorage = require(APPLE_TARGETS_MODULE).ExtensionStorage as ExtensionStorageStatic; }
catch { ExtensionStorage = null; }

/** 把今日摘要寫進 App Group 並 reload widget timeline；iOS-only、graceful。 */
export function updateWidget(input: WidgetInput): void {
  if (Platform.OS !== 'ios' || !ExtensionStorage) return;
  try {
    const payload = buildWidgetPayload(input);
    const storage = new ExtensionStorage(APP_GROUP);
    storage.set('today', JSON.stringify(payload));
    ExtensionStorage.reloadWidget();
  } catch (e) { console.warn('[widget] update failed', e); }
}
```

- [ ] **Step 2:** Run `npx tsc --noEmit` → clean
- [ ] **Step 3:** Run `npx -y tsx scripts/verify_health_widget.ts` → `ALL PASS (20 checks)`（回歸）
- [ ] **Step 4: Commit**

```bash
git add src/lib/widget_data.ts
git commit -m "feat(native): widget_data（App Group 寫入 + reload timeline）（主線批次③）"
```

---

### Task 4: 相依 + app.json 設定（device-build only）

**Files:**
- Modify: `package.json`（透過安裝指令）
- Modify: `app.json`

**⚠️ 本 task 的產物在 EAS/prebuild 才生效；本機只確認 JSON 合法 + `npx tsc --noEmit` 仍綠。**

- [ ] **Step 1: 安裝相依**

```bash
npx expo install @kingstinct/react-native-healthkit react-native-nitro-modules
npm install @bacons/apple-targets
```
（`expo install` 選 SDK54 相容版本。若安裝失敗或版本衝突 → 記在 report、標 device-only，不阻擋其餘 task。）

- [ ] **Step 2: `app.json` 的 `plugins` 陣列，於 `"./plugins/with-google-play-token"` 之後加兩個 plugin**

```json
      "./plugins/with-google-play-token",
      [
        "@kingstinct/react-native-healthkit",
        {
          "NSHealthShareUsageDescription": "Kibo 讀取你的步數與活動能量，顯示每日活動量。",
          "NSHealthUpdateUsageDescription": "Kibo 將你記錄的訓練、營養、喝水與體重寫入 Apple 健康，集中管理。",
          "background": false
        }
      ],
      "@bacons/apple-targets"
```

- [ ] **Step 3: `app.json` 的 `ios` 物件，加 `appleTeamId` 與 `entitlements`（app group）**

在 `ios` 內（與 `bundleIdentifier` 同層）加：
```json
      "appleTeamId": "XGY266T6Y8",
      "entitlements": {
        "com.apple.security.application-groups": ["group.app.kibo.fitness"]
      },
```

- [ ] **Step 4: 驗 JSON 合法 + 型別**

Run: `node -e "JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log('app.json OK')"`
Run: `npx tsc --noEmit`（應仍乾淨）
Expected: `app.json OK` 且 tsc 無輸出。

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore(native): 加 HealthKit + apple-targets 相依與 app.json 設定（app group / appleTeamId / plugins）（主線批次③；裝置 build 驗）"
```

---

### Task 5: Widget target 骨架（SwiftUI，device-build only）

**Files:**
- Create: `targets/kibo_widget/expo-target.config.js`
- Create: `targets/kibo_widget/index.swift`
- Create: `targets/kibo_widget/Info.plist`

**⚠️ 全部 SwiftUI/target 檔本機無法編譯驗證；prebuild + Xcode/EAS 才生效。reviewer 只審契約（App Group 名、key `today`、payload 欄位與 `widget_core.WidgetPayload` 一致）。**

- [ ] **Step 1: 寫 `targets/kibo_widget/expo-target.config.js`**

```js
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'kibo_widget',
  displayName: 'Kibo 今日',
  entitlements: {
    'com.apple.security.application-groups': ['group.app.kibo.fitness'],
  },
});
```

- [ ] **Step 2: 寫 `targets/kibo_widget/index.swift`**（讀 App Group `today` JSON，顯示今日摘要；欄位對齊 `WidgetPayload`）

```swift
import WidgetKit
import SwiftUI

struct KiboToday: Codable {
  var dateKey: String = ""
  var caloriesEaten: Int = 0
  var caloriesTarget: Int = 0
  var workouts: Int = 0
  var waterMl: Int = 0
  var waterTargetMl: Int = 0
}

func loadToday() -> KiboToday {
  let defaults = UserDefaults(suiteName: "group.app.kibo.fitness")
  guard let raw = defaults?.string(forKey: "today"),
        let data = raw.data(using: .utf8),
        let decoded = try? JSONDecoder().decode(KiboToday.self, from: data)
  else { return KiboToday() }
  return decoded
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry { Entry(date: Date(), data: KiboToday()) }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    completion(Entry(date: Date(), data: loadToday()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    completion(Timeline(entries: [Entry(date: Date(), data: loadToday())], policy: .atEnd))
  }
}

struct Entry: TimelineEntry { let date: Date; let data: KiboToday }

struct KiboWidgetView: View {
  var data: KiboToday
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Kibo 今日").font(.caption).foregroundColor(.secondary)
      Text("\(data.caloriesEaten) / \(data.caloriesTarget) kcal").font(.headline)
      HStack(spacing: 10) {
        Label("\(data.workouts)", systemImage: "figure.strengthtraining.traditional")
        Label("\(data.waterMl)ml", systemImage: "drop.fill")
      }.font(.caption)
    }.padding()
  }
}

@main
struct KiboWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "kibo_widget", provider: Provider()) { entry in
      KiboWidgetView(data: entry.data)
    }
    .configurationDisplayName("Kibo 今日")
    .description("今日熱量、訓練、喝水一眼看")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}
```

- [ ] **Step 3: 寫 `targets/kibo_widget/Info.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>kibo_widget</string>
  <key>CFBundleDisplayName</key>
  <string>Kibo 今日</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundlePackageType</key>
  <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>
```

- [ ] **Step 4:** Run `node -e "require('./targets/kibo_widget/expo-target.config.js')({ios:{entitlements:{}}}); console.log('target config OK')"` → `target config OK`（確認 JS 合法可執行）。Swift/plist 本機不驗。
- [ ] **Step 5: Commit**

```bash
git add targets/kibo_widget
git commit -m "feat(native): kibo_widget SwiftUI target 骨架（App Group today payload；裝置 build 驗）（主線批次③）"
```

---

### Task 6: 接線（設定開關 / 寫入點 / 步數 tile / widget 更新）

**Files:**（依實際存在調整；先 grep 找 store 的 mutation actions 與設定頁）
- Modify: 設定頁（`app/me/health-settings.tsx` 或「我」頁）— 加「同步 Apple Health」開關（iOS-only）
- Modify: `src/stores/useAppStore.ts` — 在 `addWater` / 記飲食 / 完成訓練 / 記體重 的 persist 後，fire-and-forget 呼叫對應 `writeXToHealth`；並在資料刷新後 `updateWidget(...)`
- Modify: dashboard — 一個今日步數/活動能量 tile（iOS + 可用時顯示）

**Context:** 所有原生呼叫皆 graceful（Task 2/3 已內建守衛）。接線只是「在對的地方呼叫」。先 grep 定位：`git grep -n "addWater" src/stores/useAppStore.ts`、飲食/訓練/體重的 persist action、以及設定頁元件。若某寫入點分散在畫面而非 store，於該畫面 save 成功後呼叫。

- [ ] **Step 1: 設定開關** — 在健康設定頁加一列（`Platform.OS === 'ios' && isHealthAvailable()` 時才顯示）：開 → `await requestHealthPermissions()` 成功才 `setHealthSyncEnabled(true)`；關 → `setHealthSyncEnabled(false)`。用 `getHealthSyncEnabled()` 初始化。

- [ ] **Step 2: 寫入點** — `import { writeWaterToHealth, writeNutritionToHealth, writeWeightToHealth, writeWorkoutToHealth } from '@/lib/health_kit';`
  - 喝水：`addWater` persist 後 `void writeWaterToHealth(ml);`
  - 飲食：記一餐 persist 後 `void writeNutritionToHealth({ calories, protein, carb, fat });`
  - 訓練完成：`void writeWorkoutToHealth({ start, end, kcal });`
  - 體重/InBody：`void writeWeightToHealth(kg);`
  （皆 fire-and-forget，不 await 擋 UI。）

- [ ] **Step 3: Widget 更新** — `import { updateWidget } from '@/lib/widget_data';` 在今日資料刷新（如 `refreshHealth`／dashboard 載入）之後，用今日彙整呼叫 `updateWidget({ dateKey, caloriesEaten, caloriesTarget, workouts, waterMl, waterTargetMl })`。

- [ ] **Step 4: 步數/活動能量 tile** — dashboard 或健康頁加一 tile：mount 時 `readTodaySteps()`/`readTodayActiveEnergy()`，`isHealthAvailable()` 為假則不顯示。

- [ ] **Step 5: 型別 + 斷言回歸** — `npx tsc --noEmit` 乾淨；`npx -y tsx scripts/verify_health_widget.ts` → `ALL PASS (20 checks)`。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(native): 接線 Apple Health 同步開關/寫入點/步數 tile + widget 更新（主線批次③）"
```

---

## Self-Review

**Spec coverage:** 純函數對應+斷言(T1)✓；HealthKit wrapper 寫入/讀取/開關/fallback(T2)✓；widget 寫入(T3)✓；deps+app.json(T4)✓；SwiftUI target(T5)✓；接線 開關/寫入/tile/更新(T6)✓。Android/未授權 graceful 全程 ✓。

**Placeholder scan:** 純函數/wrapper/config/swift 皆完整碼；T6 因需 grep 既有 mutation 位置，步驟給明確定位法與呼叫碼（非 placeholder，是整合指示）。

**Type consistency:** `HKQuantityInput`/`HK_ID`(T1)→wrapper(T2) 一致；`WidgetInput`/`WidgetPayload`(T1)→`updateWidget`(T3)→SwiftUI `KiboToday`(T5) 欄位一致（dateKey/caloriesEaten/caloriesTarget/workouts/waterMl/waterTargetMl）；App Group `group.app.kibo.fitness` 於 app.json(T4)/expo-target.config(T5)/widget_data(T3)/swift(T5) 一致。

**驗收：** T1/3 斷言 20、T1/2/3/6 tsc 綠；T4/5 及所有實際同步/widget 畫面/prebuild＝裝置驗（見 spec）。
