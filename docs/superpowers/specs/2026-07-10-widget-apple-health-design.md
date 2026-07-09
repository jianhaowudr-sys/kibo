# Widget / Apple Health 設計（原生）

日期：2026-07-10
狀態：已與使用者確認核可（主線批次 ③；兩子系統一起做，使用者裝置驗）
分支：feature/v1.0.2-libpct-eggs

## 重大前提（誠實聲明）

這是**兩個獨立原生子系統**，Expo SDK54 managed + EAS build。**本開發環境無 iOS 工具鏈，無法編譯/執行任何原生碼**。可在本機驗的只有 TypeScript（`tsc`）與純函數斷言；**真正的 Health 同步、Widget 畫面、prebuild/EAS build 全部由使用者在裝置上驗**。

決策（使用者核可）：兩個現在一起做；Apple Health＝**Kibo 寫入 Health（訓練/營養/喝水/體重）+ 讀步數/活動能量顯示**。

## 專案現況（讀 app.json / eas.json / package.json）

- Expo SDK 54 managed、`newArchEnabled: true`、bundle `app.kibo.fitness`、Apple Team `XGY266T6Y8`、已上 TestFlight/Store（ascAppId 6764039298）。
- 已有自訂 config plugin（`./plugins/with-google-play-token`）＋ `infoPlist` overrides，故加 plugin/entitlement 是既有模式。
- 無 Health / widget 相依。

## 子系統 A：Apple Health（HealthKit）

### 相依與設定
- 安裝：`@kingstinct/react-native-healthkit` + peer `react-native-nitro-modules`（Nitro、支援 New Arch、iOS-only）。
- app.json `plugins` 加：
  ```json
  ["@kingstinct/react-native-healthkit", {
    "NSHealthShareUsageDescription": "Kibo 讀取你的步數與活動能量，顯示每日活動量。",
    "NSHealthUpdateUsageDescription": "Kibo 將你記錄的訓練、營養、喝水與體重寫入 Apple 健康，集中管理。",
    "background": false
  }]
  ```
  （此 plugin 會自動加 HealthKit entitlement + Info.plist 用途字串。）

### 範圍（使用者核可）
- **寫入 Health**：訓練（HKWorkout）、飲食（dietary energy kcal / protein / carb / fat total）、喝水（dietary water）、體重（body mass）。
- **讀取 Health**：今日步數（step count）、今日活動能量（active energy burned）→ 顯示在 App。

### 純函數（`src/lib/health_core.ts`，零 import，可斷言）
把「Kibo 值 → HealthKit 樣本描述」的對應抽純函數（單位換算、型別識別碼、防呆），不碰原生：
- `type HKQuantityInput = { identifier: string; unit: string; value: number }`
- `nutritionSamples(m: { calories?: number; protein?: number; carb?: number; fat?: number }): HKQuantityInput[]`——各營養素對應 `HKQuantityTypeIdentifierDietaryEnergyConsumed`(kcal)/`...DietaryProtein`(g)/`...DietaryCarbohydrates`(g)/`...DietaryFatTotal`(g)；**略過非有限/≤0 的值**（避免寫 0 或 NaN）。
- `waterSample(ml: number): HKQuantityInput | null`——`HKQuantityTypeIdentifierDietaryWater`，單位 `mL`；ml≤0/非有限 → null。
- `weightSample(kg: number): HKQuantityInput | null`——`HKQuantityTypeIdentifierBodyMass`，單位 `kg`；範圍防呆（>0、<500）。
- 以斷言驗：漏值略過、單位/識別碼正確、防呆邊界。

### TS wrapper（`src/lib/health_kit.ts`，I/O，graceful fallback）
- **平台/可用性守衛**：`isHealthAvailable(): boolean` = `Platform.OS === 'ios' && HealthKit.isHealthDataAvailable()`；非 iOS/模組缺 → 全部 no-op、read 回 null/0。所有函數 try/catch → `console.warn`，**永不 throw、永不擋記錄流程**。
- `requestHealthPermissions(): Promise<boolean>`——requestAuthorization：share＝[workout, dietaryEnergy, protein, carb, fatTotal, water, bodyMass]、read＝[stepCount, activeEnergy]。
- `writeWorkoutToHealth(w: { start: Date; end: Date; kcal?: number })`、`writeNutritionToHealth(...)`、`writeWaterToHealth(ml)`、`writeWeightToHealth(kg)`——用 `health_core` 的純對應產樣本再存。
- `readTodaySteps(): Promise<number>`、`readTodayActiveEnergy(): Promise<number>`——查今日統計；不可用回 0。
- **啟用開關**：AsyncStorage `@kibo/health_sync_enabled`（預設 off）；`getHealthSyncEnabled`/`setHealthSyncEnabled`。所有 write 先查開關。
- 註：`@kingstinct/react-native-healthkit` v9 Nitro API 的**確切函數名/簽名以安裝版本為準**；wrapper 把原生呼叫集中在一處 adapter，裝置 build 時對照修正。

### 接線
- **設定頁**（`me/health-settings` 或「我」）：加「同步 Apple Health」開關 → 開啟時 `requestHealthPermissions()`；僅 iOS 顯示。
- **寫入點**（fire-and-forget、try/catch、開關+可用性守衛內）：訓練完成、飲食儲存、喝水 +cup、體重/InBody 儲存 → 對應 `writeXToHealth`。
- **讀取顯示**：dashboard 或健康頁一個小 tile 顯示今日步數 / 活動能量（`readTodaySteps`/`readTodayActiveEnergy`）；不可用時不顯示。

## 子系統 B：iOS Widget（WidgetKit）

### 相依與設定
- 安裝：`@bacons/apple-targets`。
- app.json：`plugins` 加 `"@bacons/apple-targets"`；`ios.appleTeamId: "XGY266T6Y8"`；`ios.entitlements` 加 App Group：
  ```json
  "entitlements": { "com.apple.security.application-groups": ["group.app.kibo.fitness"] }
  ```
- 建立 `targets/kibo_widget/`：
  - `expo-target.config.js`：`{ type: 'widget', name: 'kibo_widget', displayName: 'Kibo 今日', entitlements: { 'com.apple.security.application-groups': ['group.app.kibo.fitness'] } }`
  - `index.swift`（SwiftUI TimelineProvider + View）：讀 `UserDefaults(suiteName: "group.app.kibo.fitness")` 的 key，渲染 small/medium。
  - `Info.plist`、（必要時）`kibo_widget.entitlements`。

### 資料流（App → Widget）
- 純函數 `widget_core.ts`（零 import）：`buildWidgetPayload(input): WidgetPayload`——把今日摘要（熱量已吃/目標、訓練次數、喝水 ml/目標）整成 widget 要顯示的扁平物件（字串/數字），含防呆（缺值給 0/'—'）。斷言驗。
- I/O `widget_data.ts`：`import { ExtensionStorage } from '@bacons/apple-targets'`；`updateWidget(payload)`＝`new ExtensionStorage(APP_GROUP).set('today', JSON.stringify(payload))` + `ExtensionStorage.reloadWidget()`；iOS-only、try/catch graceful。
- 觸發點：dashboard 資料變動 / 記錄後刷新（refreshHealth 之後）呼叫 `updateWidget(buildWidgetPayload(...))`。
- SwiftUI 端讀同一 App Group 的 `'today'` JSON、decode 顯示。

### 本環境可驗 vs 裝置驗
- 可驗（tsc/斷言）：`widget_core` 純函數、`widget_data.ts` 型別（用本地最小介面 for ExtensionStorage，避免必裝）、payload 契約。
- 裝置驗：SwiftUI 畫面、App Group 讀寫、prebuild 產 widget target、實際主畫面加入 widget。

## 檔案異動

| 動作 | 檔案 | 職責 | 可驗性 |
|---|---|---|---|
| Modify | `package.json` | 加 3 個相依（healthkit + nitro + apple-targets） | JS 安裝 |
| Modify | `app.json` | healthkit plugin、apple-targets plugin、appleTeamId、app group entitlement | 裝置 build |
| Create | `src/lib/health_core.ts` | 純：Kibo 值 → HK 樣本對應 | tsc + 斷言 |
| Create | `src/lib/widget_core.ts` | 純：今日摘要 → widget payload | tsc + 斷言 |
| Create | `scripts/verify_health_widget.ts` | 純函數斷言 | 本機跑 |
| Create | `src/lib/health_kit.ts` | HealthKit wrapper（graceful fallback） | tsc |
| Create | `src/lib/widget_data.ts` | ExtensionStorage 寫入 + reload | tsc |
| Create | `targets/kibo_widget/expo-target.config.js` + `index.swift` + `Info.plist` | Widget target + SwiftUI | **裝置 build only** |
| Modify | 設定頁 + 各寫入點 + dashboard tile | 開關、寫入 Health、顯示步數/能量、更新 widget | tsc |

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `npx -y tsx scripts/verify_health_widget.ts`：health_core（漏值略過/單位/識別碼/防呆）、widget_core（payload 缺值防呆） |
| 型別 | `npx tsc --noEmit` 乾淨（TS wrappers、接線；ExtensionStorage 用本地最小介面） |
| 裝置（**全部使用者驗**） | ① `npx expo prebuild -p ios --clean` 成功產出 HealthKit 能力 + widget target；② EAS dev build 裝機；③ 開「同步 Apple Health」→ 授權面板出現、記訓練/飲食/喝水/體重 → Apple 健康 App 看得到；④ 讀今日步數/活動能量顯示正確；⑤ 主畫面加入 Kibo widget → 顯示今日摘要、記錄後 timeline reload 更新；⑥ 未授權/Android → App 內功能照常、不 crash |

## 風險與對策

| 風險 | 對策 |
|---|---|
| 原生碼本機驗不了 | 誠實標示；TS/純函數盡量 tsc/斷言；native 全交裝置驗；步驟寫清楚 |
| healthkit v9 Nitro API 名稱漂移 | wrapper adapter 集中原生呼叫一處，裝置 build 對照修正 |
| 加相依/entitlement 可能破壞既有 build（已上架 App） | 隔離於清楚 commits、可還原；不動 version/buildNumber/submit；使用者在 dev build 先驗再進 production |
| 寫入 Health 拖慢記錄流程 | fire-and-forget + try/catch，永不擋主流程 |
| App Group 名稱/entitlement 不一致 | app.json 與 expo-target.config.js 用同一 `group.app.kibo.fitness` |
| Android 無 HealthKit/widget | 全 graceful fallback；功能 iOS-only、Android no-op |

## 範圍邊界（本輪不做，列後續）

- Android：Health Connect 整合、Android app widget（另一套原生，未來）。
- Widget 互動（點擊記錄）、多種 widget 尺寸美化、Lock Screen widget。
- Health 讀取更多型別（睡眠、心率）、雙向睡眠同步。
- 背景同步（background delivery）；本輪 write 為即時、read 為開啟時查。

## 驗收狀態（2026-07-10 實作完成）

**已自動驗證（本機，僅 TS/純函數）：**
- `npx -y tsx scripts/verify_health_widget.ts` → ALL PASS (20 checks)（health_core 樣本對應 / widget_core payload 防呆）。
- `npx tsc --noEmit` 全綠（含 store 接線與設定頁；原生模組走變數名 require + 本地介面，未裝也綠）。
- 逐 task 雙審 + 最終整功能審查（a1277d1..339ec4c）＝ **Ready to merge Yes**：4 組跨檔契約全對（payload↔SwiftUI KiboToday、App Group `group.app.kibo.fitness` 於 app.json/expo-target/widget_data/swift 四處一致、HK 識別碼/單位、app.json plugins/entitlement）；純加/三重守衛，不破壞既有記錄、Android/Expo Go 不 crash。

**實作摘要（8 commits + 相依，73833ee..339ec4c）：**
- health_core/widget_core 純函數 + 斷言；health_kit.ts（寫入 4 類 + 讀步數/能量 + 同步開關 + graceful fallback）；widget_data.ts（App Group 寫入 + reload）；deps（healthkit **v14.0.2** + nitro + apple-targets）+ app.json 設定；targets/kibo_widget SwiftUI 骨架；store 接線 4 寫入點 + 設定頁開關/步數顯示 + pushTodayWidget（記餐/完訓/刷新即時更新 widget）。

**⚠️ 使用者在裝置上驗收（本機全無法驗原生）：**
1. `npx expo prebuild -p ios --clean` → 產出 HealthKit 能力 + kibo_widget target（app group、entitlements）。
2. EAS dev build（`eas build -p ios --profile development`）裝機。
3. **對照已安裝的 `@kingstinct/react-native-healthkit` v14 實際 API**，修 `src/lib/health_kit.ts` 的 `HealthKitModule` adapter 函數名/簽名（isHealthDataAvailable/requestAuthorization/saveQuantitySample/saveWorkoutSample/queryStatisticsForQuantity 可能不同）——不符時目前只會靜默 no-op、不 crash。
4. **workout 寫入**：授權請求需加入 workout 型別（HKWorkoutType，非 SHARE 的 quantity 識別碼），否則 `writeWorkoutToHealth` 靜默失敗。nutrition/water/weight 正常。
5. 設定頁開「同步 Apple Health」→ 授權面板出現；記飲食/喝水/體重/訓練 → Apple 健康 App 看得到；今日步數/活動能量顯示正確。
6. 主畫面加入 Kibo widget → 顯示今日摘要；記餐/完訓/喝水後 timeline reload 更新。
7. Android / 未授權 → App 內功能照常、不 crash。

**列後續（本輪不做）：** Android Health Connect / Android widget；Gemini-style 更多 Health 讀取型別；weight==500 邊界斷言；widget 尺寸美化/互動。
