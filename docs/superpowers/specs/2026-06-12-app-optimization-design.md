# Kibo App 優化設計：冷啟動、AI 判讀、性能雜訊、程式碼體質

日期：2026-06-12
狀態：已與使用者逐段確認核可
分支：feature/v1.0.2-libpct-eggs（基於 v1.0.7）

## 背景與目標

使用者回報兩大痛點，加上兩項順手範圍：

1. **App 冷啟動慢**：從點圖示到首頁可操作的等待過長。
2. **AI 食物判讀等太久、且不夠準**：不準的型態集中在「份量估錯」（普遍高估）與「漏項／認錯菜」（醬汁、配菜、飲料漏掉）。
3. 順手掃低風險性能雜訊。
4. 程式碼體質整理（僅限本輪會動到的檔案，不改行為）。

AI 取捨已確認：**快回 + 背景複核**——先用 1 次呼叫立刻給結果，背景複核有顯著差異才提示修正。

## 現況診斷（程式碼證據）

- `app/_layout.tsx:70`：10 個初始化步驟全部串行 `await`，包含會打網路的 `loadAuthSession` 與寵物訊息生成，全部擋在 `setReady(true)` 之前。網路慢 = 開 App 慢。
- `src/stores/useAppStore.ts:297`：`bootstrap()` 內部 6 個 SQLite 查詢逐一 `await`（getCurrentUser → listExercises → getActiveEgg → listPets → listWorkouts → listRoutines），可並行。
- `src/lib/ocr.ts:385`：`readMealFromBase64` 同一張照片以 temp 0.1/0.3/0.2 並行打 3 次 API、取中位數。等待時間 = 最慢一次；成本 3 倍；中位數無法補回「3 次都漏掉的品項」。
- `src/lib/ocr.ts:148`：「高估 20~40% 校正」提示只在使用者設定了手掌比例尺（palmRef）時才注入。
- 巨型檔：`app/(tabs)/me.tsx` 73KB、`src/stores/useAppStore.ts` 54KB、`src/db/repo.ts` 41KB。

## 範圍

**做**：冷啟動三層優化、AI 兩段式判讀（初判＋針對性複核）、提示詞強化、≤5 處性能雜訊、啟動／判讀耗時量測、`startup.ts` 與 `meal_prompts.ts` 抽檔。

**不做（列為後續建議）**：`me.tsx` 與 `useAppStore.ts` 全面拆分、可組態判讀管線、營養標籤／InBody 判讀變更、引入測試框架、效能監測套件。

---

## 工作線 1：冷啟動優化

### 設計

三層改法：

1. **`bootstrap()` 內部並行化**：`getCurrentUser` 先查（其餘依賴 user.id），之後 5 個查詢用 `Promise.all` 同跑。寵物訊息生成（`generateDailyMessages`）移出 bootstrap，放行後背景執行。
2. **`_layout.tsx` 初始化重組三組**（編排邏輯抽到新檔 `src/lib/startup.ts`）：
   - **關鍵路徑（must-wait）**：`ensureSchema` → `bootstrap`；與其並行：全部主題／偏好類 AsyncStorage 載入（themeMode、themeStyle、lowPower、calendarView、statsLayout、onboardingPetName）+ `hydrateTutorial`。主題類必須在首繪前就緒，避免主題閃爍。
   - **放行後背景組**：`loadAuthSession`（網路）、寵物訊息生成。登入態晚到時靠 state 更新自然反映；首頁本來就先顯示本地資料。
   - **onboarding 跳轉**：邏輯不動（只依賴 bootstrap 的 user）。
3. **量測先行**：`[perf]` log 記 schema／bootstrap／並行組／total-to-ready 耗時。改前先記基準，改後同尺對比。

### 錯誤處理

- 關鍵路徑失敗 → 維持現狀「初始化錯誤」畫面。
- 背景組失敗 → `console.warn`，不擋使用。

### 風險與對策

- 某畫面可能在 mount 當下假設 authSession 已載入。實作前全域搜尋 `authSession` 使用點；若有 mount 期依賴，把 `loadAuthSession` 留在關鍵路徑（少省一點時間，不冒功能風險）。

---

## 工作線 2：AI 判讀——快回 + 背景複核 + 準度

### 架構

「盲打 3 次取中位數」→「1 次初判 + 1 次針對性複核」。總呼叫 3→2（成本 −1/3）；首結果時間 ≈ 單次呼叫（體感快 2~3 倍）。

### 資料流

1. **初判**：壓縮後打第 1 次（temp 0.1），過 `sanityCheck` 立即回填表單，頂部顯示「AI 複核中…」。
2. **背景複核**：同一張照片＋初判清單送第 2 次，複核提示詞專打兩痛點：
   - (a) 逐類檢查漏項：醬汁、飲料、配菜、隱藏油脂；
   - (b) 逐項重校份量，內建「普遍高估 20~40%」校正指令。
   - 回傳同 `MealReading` 格式完整修正 JSON，沿用既有解析與 sanity 檢查。
3. **差異處理**：
   - 總熱量差 >15% 或品項增刪 → 橫幅「複核發現差異：730→650 kcal、新增滷蛋」＋[套用]/[忽略]。
   - 差異小 → 標示轉「已複核 ✓」。
   - **使用者手動改過的欄位永不覆蓋**：套用僅更新 AI 填的、使用者未碰過的值。
4. **失敗路徑**：初判失敗 → 重試一次（temp 0.4，同現行）；複核失敗 → 保留初判、`console.warn`，不打擾使用者。
5. **低耗模式**：維持單次呼叫、不複核（同現行 economy 行為）。

### 提示詞強化（初判與複核共用基礎）

- 「高估 20~40% 校正」改為常駐原則；手掌比例尺（palmRef）仍保留做尺寸校準。
- 輸出前強制自我檢查清單（四類常漏項逐一確認）。
- 擴充台灣食物參考表：自助餐、火鍋、早餐店（鐵板麵／蘿蔔糕／鍋貼）、手搖飲糖度換算、超商品項；加「拳頭≈一碗飯」等份量錨點。
- 認錯菜緩解：品名不確定時用通用名稱（如「滷肉類蓋飯」），不亂猜特定菜名。

### 範圍邊界

- 營養標籤、InBody 判讀：維持單次呼叫，不動。
- 多照片流程：沿用同模式，每張獨立初判＋複核。
- 記憶提示（過去修正學習）照常注入兩次呼叫。

### 程式碼落點

- `src/lib/ocr.ts`：新增兩段式編排（初判回呼＋複核 promise）；差異比對、套用合併寫成純函數。
- `src/lib/meal_prompts.ts`（新檔）：MEAL_PROMPT 與複核提示詞移入。
- `app/diet/new.tsx`：接「複核中／已複核／差異橫幅」三態 UI 與套用邏輯。

### 量測

`[ai]` log：首結果耗時、複核耗時、差異幅度（kcal %、品項增刪數）。

---

## 工作線 3：順手性能掃描

- 鎖定熱點：首頁儀表板、飲食 tab、列表元件。
- 只修便宜且明顯的：重複計算未 memo、Zustand selector 範圍過大造成整頁重渲染、FlatList 缺基本優化 props。
- **上限 5 處**；更大的發現記入後續建議清單，本輪不動。

## 工作線 4：程式碼體質（不改行為）

- `src/lib/startup.ts`（新檔）：啟動三組編排＋耗時量測；`_layout.tsx` 變薄。
- `src/lib/meal_prompts.ts`（新檔）：提示詞抽出，`ocr.ts` 保持純邏輯。
- `useAppStore.ts` 僅動 `bootstrap` 內部並行化；`me.tsx` 本輪不碰。

---

## 驗收標準

| 項目 | 驗收方式 |
|---|---|
| TypeScript | 每工作線完成後 `npx tsc --noEmit` 乾淨 |
| 冷啟動 | 同裝置改前／改後各跑數次 `[perf]` log，total-to-ready 下降且數字記錄於本文件附錄 |
| AI 快回 | 首結果出現時間 ≈ 單次呼叫；UI 三態流轉正確；低耗模式單次；失敗 fallback 正確（開發環境驗證） |
| AI 準度 | 需使用者協助：以自己的 API Key 實拍 3~5 張（便當、麵食、手搖飲）對照舊版，檢查漏項與份量 |
| 回歸 | onboarding 跳轉、主題無閃爍、營養標／InBody 不受影響、多照片流程、使用者改過欄位不被複核覆蓋 |

## 風險與對策

| 風險 | 對策 |
|---|---|
| 畫面 mount 期依賴 authSession | 實作前全域搜尋；有依賴則留在關鍵路徑 |
| 複核結果比初判差（過度修正） | 差異橫幅由使用者決定套用與否；不自動覆蓋 |
| 提示詞改動影響營養標／InBody | 兩者提示詞獨立、不共用，不在本輪改動範圍 |
| 並行化後 SQLite 競態 | expo-sqlite 同連線序列執行查詢，Promise.all 僅省 JS 層往返；實作時確認無交錯寫入 |

## 後續建議（本輪不做）

- `me.tsx`（73KB）拆分為設定區塊子元件。
- `useAppStore.ts`（54KB）按領域拆 slices。
- 判讀管線可組態化（複核可指定便宜模型如 Gemini Flash 以再降成本）。
- 引入測試框架（jest-expo），為 `sanityCheck`／merge／diff 純函數補單元測試。
- 性能掃描中發現但超出 5 處上限的項目（實作時補記於此）。

## 附錄：效能基準（實作時填寫）

| 量測點 | 改前 | 改後 |
|---|---|---|
| ensureSchema | — | — |
| bootstrap | — | — |
| total-to-ready | — | — |
| AI 首結果 | — | — |
| AI 複核完成 | — | — |
