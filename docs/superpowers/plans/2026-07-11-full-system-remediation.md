# Kibo 健身 — 全系統巡檢結果與修改計畫(供 Opus 執行/調整)

> 產出方式:3 個並行探索 agent(架構/資料層、UI/UX、後台/維運)深讀全 codebase,
> 2 個設計 agent 產出實施方案,主 session 抽查驗證 P0 佐證(backup.ts 親讀確認)。
> 日期:2026-07-11。基準:main @ v1.0.7(批次③ Widget/Health 完成後、workout 授權修 ae6b361)。

## Context

專案:Expo SDK54 / RN 0.81 / TS / expo-router / zustand / drizzle+expo-sqlite(22 表)/ Supabase 鏡像。已上架雙平台 v1.0.7,有既有使用者 → **本地 DB 只能加法遷移;Supabase migration 手動跑、線上 schema 有 out-of-band 漂移**。
專案既有模式(必須遵循):純函數抽 `src/lib/*_core.ts`(零 import)+ `scripts/verify_*.ts` 斷言 + tsc(無 jest);「主線批次」SDD 工作流(每批 spec→plan→tasks→review,2-6 tasks,可獨立 merge/發版)。

## 精修決策(2026-07-11,Opus 逐項審查後定案)

四個產品層取捨已由使用者拍板:
1. **D2 不拆,一次做完整**(UUID + orphan-reconcile 單批)。
2. **006 gate 方式**:用 App Store Connect / Play Console 的**版本分佈**看採用率(app 內無任何 analytics——已 grep 確認零 telemetry),舊版占比夠低才跑 006;**不**用「逼舊版失敗促升級」當手段。
3. **喝水提醒改固定每日重複時間**(iOS DAILY repeating trigger),取代原「列舉 interval + 縮 horizon」;永久有效、不怕使用者沒開 app、只占少數 slot。設定 UX 從「每 N 分」改為「這些時間」。
4. **Supabase 005/006 先在測試專案演練**再上 prod;不論如何**先跑唯讀探測 SQL** 撈線上真實 schema。

Opus 核對程式碼後的修正(已併入下方批次):
- D1-1 排序:`eggs.pet_id` 是純 integer 無 FK,只有 `pets.egg_id→eggs.id` 是真 reference → 無循環,只需 eggs 在 pets 前、users 最前。
- D2 natural key:14 表僅 `period_days.day_key`、`achievements.code` 是真唯一鍵,其餘 ~11 靠 ms 時間戳。reconcile 規則收緊為「**唯一一筆候選相符才 claim,多筆/零筆一律當 orphan**」。
- D2 pushProfile 對齊須涵蓋 `users` 全欄(含 v1.0.2 的 `consecutive_days/last_active_day/next_egg_rarity_floor`),非只計畫原寫的 4 欄。
- D3-1 FK 啟用**風險上調**(非單純 P2):在已上架、FK 目前為 OFF 的 app 上開啟強制,會讓現有靜默成功的 orphan 寫入開始報錯 → 需 orphan sweep + 完整迴歸,到 D3 時再細評。

---

## 巡檢結論(濃縮)

**架構健康度 C+**:功能豐富、局部工藝優秀(`*_core.ts` 分層、RestTimer 背景計時、兩段式 AI 判讀、RLS 全表正確、empty state 覆蓋好),但**資料層有 P0 級遺失風險**。

### P0(資料遺失,已親自驗證)
1. **備份漏 11 張表**:backup.ts:6-18 TABLES 只 11/22 張。漏:water/bowel/sleep/period/custom_foods/progress_photos/daily_scores/pet_inventory/trinity_completions/pet_messages/pending_deletions。「匯出全部資料」是假的。
2. **匯入無交易 + 靜默吞錯**:backup.ts:82-108 先 DELETE 後逐筆 INSERT,無 BEGIN/COMMIT,insert 失敗 `catch {}`;schemaVersion 寫 3 但從不驗(:38 vs :76-80)。舊備份匯入 → 已刪未還原。
3. **雲同步 local_id 模型**:cloud_sync.ts 拿 SQLite autoincrement 當跨裝置主鍵(upsert `(user_id,local_id)` :195/:225;pull `id: w.local_id` :409、skip-if-exists :405)。重裝 → id 重來 → 覆蓋雲端舊資料且拉不回;多裝置互相覆蓋。

### P1(選最重要)
4. 同步不對稱:push 14+ 表、pull 只 5 表 → 換機不還原課表/寵物/健康/自訂食物。
5. pushProfile 送雲端不存在的欄位(health_settings 等 4 欄不在 migrations)、無 try/catch、是 fullSync 第一步 → 整個同步可能炸;水/便/經期/custom_foods 雲端表從未 CREATE → push 永遠靜默失敗(catch{} 吞)。
6. 通知權限從不請求(health-settings 開關 → rescheduleAll,無 requestPermission)→ iOS 提醒全靜默;喝水提醒排 168 則 ≫ iOS 64 上限。
7. AI fetch ×3 無 timeout(ai_provider.ts:245/299/358)→ 行動網路永久卡死。
8. `today-meals` 死卡:onboarding 勾「飲食」開啟它,但首頁沒有它的 renderer(只渲染 nutrition-summary)→ 新用戶期待落空。
9. 鍵盤遮擋:全 app/ 只 workout/active 有 KeyboardAvoidingView,diet/new 等 8 頁全缺。
10. 像素風沒兌現(PixelCard/Button 只在設定頁預覽用;tab bar 連 pixel 色票都沒吃);pet 頁寫死淺色 hex,預設 dark 模式下壞掉。
11. resetDatabase 只 DROP 11/22 表 → 舊健康資料掛回新 user(隱私)。
12. API key 明文 AsyncStorage(未裝 expo-secure-store);CI 只建 IPA 不跑 tsc/verify;god store 1630 行;無障礙標記為 0。
13. 批次③ Apple Health:health_kit.ts 手寫介面 vs healthkit v14 Nitro 實際 API 未對照(device-only 驗證項,裝置上可能全靜默 no-op)。

### P2(計畫內處理的)
warning token 未定義、period 頁顯英文 enum、版本字串 v1.2 vs 1.0.7、onboarding setTimeout hack、startup 鏈共用 try、MiniMax 不支援看圖仍可選、主題 hook 重複、secure.ts 死碼、FK 未啟用、多步寫入無交易、schema 雙頭漂移、Android 返回鍵繞過訓練守門。

---

# 修改計畫(兩軌 7 批 + 前置)

## 前置(執行的第一步)

**Step 0**:把本計畫全文寫入 `docs/superpowers/plans/2026-07-11-full-system-remediation.md` 進 repo(commit),讓後續 session/Opus 可見。(即本檔)
**Step 0.5 — CI 護欄(半天,零 App 耦合,立刻先做)**:`.github/workflows/ios-build-unsigned.yml`(現況:單一 `build` job on macos-15,triggers 已有 workflow_dispatch + push main + paths-ignore *.md)。改法:
1. `on:` 加 `pull_request:`。
2. 新增 `check` job(ubuntu-latest,timeout 15 分):checkout → setup-node 20 → `npm install --legacy-peer-deps` → `npx tsc --noEmit` → `set -e; for f in scripts/verify_*.ts; do echo "== $f"; npx -y tsx "$f"; done`(verify 腳本斷言失敗即非零退出,零改造可跑)。
3. 既有 `build` job 加 `needs: check` 與 `if: github.event_name != 'pull_request'`(PR 只跑 check,不佔 macos 分鐘數)。
4. package.json scripts 加 `"typecheck": "tsc --noEmit"`。
執行前先本機跑一輪全部 7 支 verify 確認全綠再上(避免 CI 首跑即紅)。後續每一批都受保護。

## 資料軌(Track D)— 依風險排序,先止血

### 批 D1:備份止血(P0-1/2 + resetDatabase)→ 最優先
Scope guard:不碰 cloud_sync、不碰 Supabase、純本地加法。
- **D1-1** 新檔 `src/db/tables.ts`:`ALL_TABLES`(22 張,拓撲排序父先子後)。**排序約束(核對後)**:users 最前(全表 →users.id);eggs 先於 pets(唯一真 FK `pets.egg_id→eggs.id`;`eggs.pet_id` 是純 integer 無 FK,不構成循環);exercises 先於 routine_exercises/workout_sets;routines 先於 routine_exercises;workouts 先於 workout_sets。唯一真相來源。驗證:新 `scripts/verify_table_registry.ts` 用 drizzle `getTableConfig` 斷言 22==22 + 順序滿足 FK。
- **D1-2** 新檔 `src/lib/backup_core.ts`(零 import):`BACKUP_SCHEMA_VERSION=4`;`validateBackupFile`(缺版本/`>4` 拒,1..4 收);`tablesToImport`= file∩known(v3 舊檔只 replace 它有的 11 張,其餘不動——天然向下相容);`planTableInsert`(檔案欄∩live 欄交集,缺欄用 DB default)。驗證:新 `scripts/verify_backup_core.ts`。
- **D1-3** 改寫 `src/lib/backup.ts`:`serializeAll`(迭代 ALL_TABLES,讀失敗 **throw** 不再塞空);importAll 新流程=(1)驗證在任何刪除前 (2)safety-net:匯入前先 serializeAll 存 `documentDirectory/backups/pre_import_<ts>.json` 留 2 份 (3)`sqliteDb.withExclusiveTransactionAsync` 包整個 DELETE+INSERT,insert 失敗 throw → ROLLBACK (4)回傳含 skippedTables/columns warnings,me.tsx 顯示。
- **D1-4** `migrate.ts` resetDatabase 改迭代 `ALL_TABLES.slice().reverse()` DROP 全 22 張再 ensureSchema。
- 驗證:tsc + 兩支新 verify + 裝置手測(匯出→reset→匯入 roundtrip 列數相等;匯入 v3 舊檔;匯入壞 JSON 資料無損;匯入中殺 app 資料無損)。

### 批 D2:雲同步 UUID 改造 + Supabase 對齊(P0-3 + P1-4/5)→ 工程最大的一批
Scope guard:不做 CRDT/LWW(明確決策:**不做** updated_at LWW——「本地為真相」語意自洽,做對 LWW 要 14 表加欄+全寫入路徑維護,違反止血原則);不新增未 push 過的表(daily_scores/trinity/pet_inventory/pet_messages/progress_photos 維持僅本地+備份);不上傳照片檔。
- **核心方案**:14 張同步表加 client 端 UUID 作同步主鍵。
  - 本地:runAdditions 加法遷移 `ADD COLUMN sync_uuid TEXT` + 純 SQL backfill `UPDATE t SET sync_uuid=lower(hex(randomblob(16))) WHERE sync_uuid IS NULL` + unique index。新列 **lazy backfill**(fullSync 開頭重跑 UPDATE),寫入路徑零改動。
  - 雲端 `005_sync_uuid_and_alignment.sql`(全冪等):(a) CREATE TABLE IF NOT EXISTS ×5(water/bowel/sleep/period/custom_foods,含 RLS + unique(user_id,local_id) → **v1.0.7 的健康 push 立刻開始成功,免費止血**)(b) 這 5 表逐欄 add column if not exists 收斂手建表 (c) profiles 補 4 欄(text 不用 jsonb)→ 修 pushProfile 炸點 (d) 14 表加 client_uuid + partial unique index + 4 個父鏈 uuid 欄(workout_sets.workout_client_uuid 等)。**不 drop 任何東西**。
  - **Reconcile(claim-or-orphan)**:fullSync 對 `client_uuid is null` 的雲端列——local_id 存在本地**且 natural key 相符**(workouts=started_at、meals=(logged_at,meal_type)、period_days=day_key【真唯一鍵】、achievements=code【真唯一鍵】、body=measured_at、routines=(created_at,name)、routine_exercises=(父連結,order_idx)、workout_sets=(父連結,order_idx,created_at)、eggs/pets=created_at、custom_foods=(name,created_at)、water=(logged_at,amount_ml)、bowel=logged_at、sleep=(bedtime_at,wake_at))→ claim 回寫 uuid;不符 → **orphan 匯入本地成新列**(重裝前的舊資料被救回)。**安全規則(Opus 收緊)**:僅 `period_days`/`achievements` 是真唯一鍵;其餘靠 ms 時間戳,故 claim 條件為「**本地恰有唯一一筆候選相符才 claim,零筆或多筆一律當 orphan**」——寧可多匯入一列也不誤併。local_id 重映用兩段式負值避 unique 撞。
  - Push 拆兩批:uuid 已在雲端 → upsert on (user_id,client_uuid) 不帶 local_id;新列 → insert,23505 撞號 → 隨機 local_id(1e9..2^31-1)重試 ≤3。維持 500 筆 chunk。
  - Pull 擴到全 14 張(修不對稱),比對鍵=uuid,插入前 natural-key adopt 防重(擋「匯入 pre-UUID 備份後 uuid 再生」的重複),**不再指定 id: local_id**,子表用父 uuid 對映(fallback legacy workout_local_id)。順序:routines→routine_exercises;workouts→workout_sets;eggs→pets→回填 eggs.pet_id。
  - pushProfile defensive:try/catch,42703/PGRST204 → 用**已知存在的欄位子集**重試(以 001+003 為底,涵蓋 `users` 全欄含 v1.0.2 的 consecutive_days/last_active_day/next_egg_rarity_floor),仍敗 → warnings 不 throw;pushHealthTables/pushCustomFoods 的 catch{} 改浮出 warnings。
  - Capability probe:fullSync 開頭 select client_uuid limit 1,失敗(005 未跑)→ 走 legacy 路徑 → 「先出 app 或先跑 migration」兩序皆安全。
  - tombstone:repo.ts enqueue 帶 sync_uuid;delete 條件改 client_uuid,null 舊佇列項 fallback local_id。
- **佈署時序(關鍵,決策 2+4)**:
  1. 唯讀探測 SQL(information_schema/pg_constraint,結果存 `supabase/migrations/PROBE_*.md`)——**必做前提**,先知道線上真實 schema 與舊 unique 約束的實際名稱。
  2. 在**測試 Supabase 專案**演練 005→006 全流程(決策 4)。
  3. 005(純加法,v1.0.7 不受影響)上 prod → 上架含 UUID 同步的版本。
  4. **006 gate**:透過 App Store Connect / Play Console 的**版本分佈**觀察採用率(app 內無 analytics,無法在端內量),舊版占比夠低(建議 <10%)才跑 `006_drop_legacy_unique.sql`(drop unique(user_id,local_id) 換普通 index)。**注意**:006 跑完後未升級的舊版 client push 會失敗——這是接受的代價,故必須等版本分佈確認舊版已少;跑了不可逆。
- 檔案:migrate.ts、新 `src/lib/sync_core.ts`(naturalKeyOf/planReconcile/planPull/chunk)、cloud_sync.ts、repo.ts、supabase/migrations/005+006。
- 驗證:新 `scripts/verify_sync_core.ts` fixtures 必測:重裝情境(cloud 100 列+local 撞號 3 列 → 0 覆蓋 100 orphan 匯入)、換機還原、備份匯入後 adopt 零重複、兩段式重映無碰撞。005/006 先在**測試 Supabase 專案**演練全流程。

### 批 D3:本地強健化(P2)
- **D3-1** FK 啟用(**風險上調,非單純 P2**):在已上架、FK 目前 OFF 的 app 上開啟強制,會讓現有靜默成功的 orphan 寫入/亂序寫入開始報錯 → 需先 orphan sweep(sentinel gate;刪 workout_sets 無父、routine_exercises 無父、pets.egg_id 懸空置 null)+ **完整功能迴歸**(建/刪課表、finishWorkout、importAll、cloud pull 亂序插入)才可 `PRAGMA foreign_keys=ON`(client.ts 開檔後)。注意 D2 的 pull 若曾靠 FK-off 亂序插入,啟用後須確保父先子後。回滾=拿掉一行。
- **D3-2** 交易化:finishWorkout、ensureSchema seed、bootstrap 包 `withExclusiveTransactionAsync`(注意不與 importAll 巢狀)。
- **D3-3** 新 `scripts/verify_schema_drift.ts`:斷言 SCHEMA_SQL+runAdditions 覆蓋 drizzle 全欄位、SYNCABLE_TABLES ⊆ 註冊表。schema 雙頭漂移從「靠人記得」變 CI 斷言。

## UX 軌(Track E)— 依痛度排序

### 批 E1:功能斷鏈(P1 邏輯層,全 JS 可 OTA)
- **E1-1** today-meals 死卡(**方案 B:移除+遷移**——nutrition-summary 本來就是「今日飲食」卡含記錄入口,補新 renderer 是三份重複維護):dashboard.ts 刪 id;parseLayout 加一次性遷移(today-meals.visible→nutrition-summary.visible+order,在 DEFAULT map 丟棄前讀值;使用者兩張都關則不強開);onboarding:37 改指 nutrition-summary。驗證:新 `scripts/verify_dashboard_layout.ts` 4 斷言 + 人工清資料走 onboarding。
- **E1-2** 通知權限 gate:reminders.ts 加 `ensurePermission()`('granted'|'denied'|'blocked';undetermined→requestPermission,拒絕過→blocked);health-settings 三開關(:177/:202/:258)開啟前 await,blocked → Alert「請到系統設定開啟通知」+ Linking.openSettings() 且開關不動。
- **E1-3** iOS 64 上限 → **喝水提醒改固定每日重複時間(決策 3)**:
  - `reminders_core.ts` 新增純函數 `dailyReminderTimes(config): {hour,minute}[]`——輸入為新的 `times[]` 明確時間;若讀到舊 `{intervalMin, window}` config 則**一次性推導**(自 window 起每 intervalMin 取時點,`slice(0, MAX)`,`MAX=12` 留大量餘裕給排/睡 DAILY);輸出去重、排序、驗 0–23/0–59。**保留** `buildIntervalTriggers`(其他潛在用途)但喝水排程不再用它。
  - `reminders.ts`:喝水改為 `for t of dailyReminderTimes(): schedule DAILY repeating (hour,minute)`(與排便/睡前同型),取代 7 天列舉一次性觸發。DAILY repeating **跨啟動持久**,故**移除**原計畫的「startup 滾動補排」——只保留設定變更時 `rescheduleAll`(開頭 cancelAll 冪等)。
  - `health-settings.tsx`:喝水提醒編輯器從「間隔分鐘 + 視窗」改為**時間清單**(加/減時點,附預設 preset 如 8:00/11:00/14:00/17:00/20:00);讀取時把舊 config lazy 遷移成 `times[]`(存回 healthSettings JSON)。
  - 驗證:`verify_reminders` 加斷言——`dailyReminderTimes` 上限 ≤MAX、排序去重、合法 hh:mm、舊 config 推導正確、空/壞輸入 → 預設 preset。人工:設 5 個時間 → `getAllScheduledNotificationsAsync().length` = 5(水)+ 排/睡,遠 <64;隔日不開 app 仍如期收到。
- **E1-4** AI timeout:ai_provider.ts 加 `fetchWithTimeout`(AbortController,60s,finally clearTimeout),三 call site(:245/:299/:358)換用,AbortError → 「連線逾時(60 秒),請檢查網路後重試」走既有 throw→Alert 路徑。
- **E1-5** Android 返回守門:workout/active 加 BackHandler('hardwareBackPress'→onPause Alert :219→return true),unmount 移除;檢查該 modal iOS gestureEnabled,必要時關閉。

### 批 E2:輸入與主題正確性(像素風的前置)
- **E2-1** 新 `src/components/common/KeyboardScreen.tsx`(封裝 KAV:flex:1、iOS behavior='padding'、keyboardVerticalOffset prop;參數對齊 workout/active.tsx:257 已在生產驗證那套;否決逐頁手刻與 keyboard-controller 新依賴)。
- **E2-2/3** 兩波接入(整頁含底部 bar 一起包 + ScrollView keyboardShouldPersistTaps="handled"):wave1=diet/new、body/new、food-library/new、me;wave2=routine/new、exercise/new、feedback、onboarding。每頁固定驗收腳本(點最底輸入框→框與按鈕可見、可直接點按鈕),iOS/Android 各一次。
- **E2-4** 補 `kibo-warning` token(tailwind.config.js + theme.ts THEME_VARS/COLORS + palette.ts PIXEL_VARS/COLORS;light #b45309(180 83 9)/ dark #fbbf24(251 191 36)/ pixel #ffa300(255 163 0))。驗證:diet/new 過去日期補登 banner 三主題截圖。
- **E2-5** pet/index.tsx 主題化(:66-131 的 12 hex → useThemePalette;:68 paddingTop 50 → insets.top+8)。
- **E2-6** 硬編 hex 清理 8 檔(index.tsx:162 RefreshControl #22D3EE→primary、:198-201 #83769c→mute、water.tsx:52 #29adff→cardio、diet/new.tsx:867 #ffa300→warning/#83769c→mute…只換有語意 token 者,剩餘 grep 清單逐條給理由)。

### 批 E3:像素風 Phase 1 + a11y baseline(硬驗收:modern 模式截圖零 diff)
- **E3-1** tab bar 吃主題(修 bug 兼像素化:現狀只 import THEME_COLORS,連 pixel 色票都沒吃;改用 useThemeStyle + isPixel 時 tabBarLabelStyle fontFamily 'Cubic11'、borderTopWidth 3、borderTopColor palette.text)。
- **E3-2** 首頁卡容器換 PixelCard/PixelButton(empty 卡 :254、無紀錄卡 :262、workout 列項 :290、開始訓練鈕 :308;PixelCard modern 退化路徑輸出與現行 className 相同,diff 風險低;驗 Swipeable 刪除手勢仍正常)。
- **E3-3** dashboard 快覽卡(NutritionSummaryCard/BodySummaryCard/PetHeroBar)最外層 View→PixelCard。
- **E3-4** a11y baseline:6-8 檔 icon-only 控制加中文 accessibilityLabel+Role(MonthCalendar ‹›「上一個月」、active ✕⋯▾、diet/new 關閉/相機、HealthRow +−、首頁 🗑「刪除這次訓練」⚙️、SleepEditModal 關閉)。VoiceOver 逐一唸出 + TalkBack 抽 3 個。
- **E3-5** 大字體防裁切:小字加 `maxFontSizeMultiplier={1.3}`(DailyTrinityCard :52 等固定容器)。iOS 文字最大 → 首頁三圈不破版。
- 後續 Phase 2/3(diet/routines/me 卡、CTA 統一 PixelButton、標題 Cubic11、modal/輸入框、PixelArt tab icon、主題音效)列 backlog 不在本計畫。

### 批 E4:打磨與工程債
- **E4-1** 微修集:period.tsx:81 flow 中文化(抽 `src/lib/period_labels.ts` 與 PeriodDetailModal:8-11 共用);me.tsx:1490 版本改讀 `Constants.expoConfig?.version`;index.tsx:77/diet.tsx:44 useEffect 查詢包 try/catch+console.warn 保持空列表不白屏。
- **E4-2** 啟動鏈韌性:_layout.tsx:69-74 setTimeout(500) hack → 宣告式 `<Redirect href="/onboarding" />`(ready 且 user && !onboardingCompletedAt);startup.ts:47-70 共用 try 拆 per-step try/catch,單步失敗不吞後續。
- **E4-3** MiniMax 看圖下架:ai_provider.ts:95-117 兩 entry 加 visionUnsupported 旗標,picker 灰化;getActiveModelId 讀到 unsupported/未知 → fallback DEFAULT_MODEL。
- **E4-4** 主題 hook 合併:lib/useThemePalette.ts 改 delegate hooks/useThemeStyle.ts(保留檔名與簽名,零呼叫端改動);刪 lib/secure.ts 死碼。
- **E4-5** API key → expo-secure-store(lazy 遷移:getProviderKey 先讀 SecureStore,miss → 讀 AsyncStorage → 搬入 → 刪;setProviderKey 只寫 SecureStore。**新 native module 不能 OTA,需原生 build**,故排本批)。驗證:1.0.7 已存 key 裝置升級後 key 仍在。

## 建議執行順序與版本節奏

```
Step 0 計畫入 repo + Step 0.5 CI 護欄
→ D1 備份止血 ∥ E1 功能斷鏈     → 發 v1.0.8(全 JS 可 OTA;005 migration 先跑)
→ D2 雲同步 UUID                → 隨 v1.0.8/1.0.9 上架,觀察後跑 006
→ E2 鍵盤+主題                   → v1.0.9
→ E3 像素風+a11y                 → v1.1.0(可見賣點,值 minor)
→ D3 強健化 ∥ E4 打磨(含 SecureStore 原生 build)→ v1.1.1
```
獨立軌(與上並行):**iOS device build 驗證批次③**(healthkit v14 adapter 函數名對照、activityType 3000、Swift widget 編譯)——本機無 iOS 工具鏈,依賴使用者跑 EAS build。

## 明確不做(backlog,有理由)
- god store 拆分(維護債非資料風險,等止血完;拆分時商業邏輯先抽 *_core.ts)
- updated_at LWW / CRDT(定位是備份+還原,非即時多裝置同步;多裝置同列編輯=最後 push 者勝,寫進文件當已知行為)
- 刪除手勢三範式統一(需先出 UX 決策文件)、`as any` 全清(CI 上線後分次)、a11y 全量、11 檔 loading 全補(長尾順手補)
- drizzle-kit migrations 替換 SCHEMA_SQL(風險/收益不成比,verify_schema_drift 防漂移即可)

## 風險與回滾(選錄)
| 風險 | 緩解 | 回滾 |
|---|---|---|
| v4 匯入 bug 毀資料 | 交易 ROLLBACK + 匯入前 safety-net 快照留 2 份 | 從快照還原;舊版 importer 可讀 v4 檔的 11 張(向後相容) |
| 005 在未知線上 schema 跑掛 | 全冪等 if-not-exists;先探測;測試專案演練 | 純加法免回滾,半途可重跑 |
| reconcile 誤 claim | 需 local_id **且** natural key 雙符合;fixture 覆蓋重裝 | 最壞=該列被本地覆蓋,不劣於現狀;使用者有 D1 全量備份 |
| 006 後 v1.0.7 push 失敗 | 有意設計(可見、非破壞);006 延後至採用率達標 | 有 uuid 雙寫後不可逆 → 006 必須最後跑 |
| FK ON 讓 orphan 炸寫入 | 啟用前 orphan sweep 同批出 | 拿掉 PRAGMA 一行 |

## 全計畫驗證方式
- 每批:tsc --noEmit + 全部 scripts/verify_*.ts(CI 自動)+ 各批人工驗收清單(雙平台)
- 新增 verify 腳本 5 支:table_registry、backup_core、sync_core、dashboard_layout、schema_drift
- D2 額外:測試 Supabase 專案演練 005→006;fixtures 覆蓋重裝/換機/備份重匯三情境
- 發版前:裝置 roundtrip 手測(D1)+ 通知實測(E1)+ 三主題截圖(E2/E3)
