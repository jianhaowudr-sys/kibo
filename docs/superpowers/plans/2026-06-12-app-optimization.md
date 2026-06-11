# Kibo App 優化實作計畫（冷啟動／AI 兩段式判讀／性能掃描／程式碼體質）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 冷啟動關鍵路徑並行化＋網路請求移出；AI 食物判讀改「1 次初判立即回 + 1 次針對性背景複核」，同時強化提示詞（漏項、份量高估）。

**Architecture:** 啟動編排抽到 `src/lib/startup.ts`（關鍵路徑／背景兩階段）；判讀提示詞抽到 `src/lib/meal_prompts.ts`；複核差異比對與套用合併為純函數放 `src/lib/meal_verify.ts`（node 可跑、附斷言腳本）；`ocr.ts` 提供 `readMealTwoPhase()` 兩段式編排；`diet/new.tsx` 接三態 UI（複核中／已複核／差異橫幅）。

**Tech Stack:** Expo 54 / RN 0.81 / TypeScript strict / Zustand / expo-sqlite / NativeWind。無測試框架——純函數用 `npx -y tsx` 跑斷言腳本驗證，其餘以 `npx tsc --noEmit` ＋手動煙測驗收。

**Spec:** `docs/superpowers/specs/2026-06-12-app-optimization-design.md`（已核可）

---

## 檔案結構總覽

| 動作 | 檔案 | 職責 |
|---|---|---|
| Create | `src/lib/perf.ts` | 耗時量測 helper（`__DEV__` 才輸出） |
| Create | `src/lib/startup.ts` | 啟動編排：`runCriticalStartup` / `runBackgroundStartup` |
| Create | `src/lib/meal_prompts.ts` | `MEAL_PROMPT`（強化版）、`VERIFY_PROMPT`、`buildPalmRefHint` |
| Create | `src/lib/meal_verify.ts` | 純函數：`diffReadings` / `snapshotOf` / `mergeVerifiedIntoForm` / `formatDiffSummary` |
| Create | `scripts/verify_meal_logic.ts` | meal_verify 斷言腳本（`npx -y tsx` 執行） |
| Modify | `app/_layout.tsx` | 改用 startup.ts；移除 8 個 load hook 取值 |
| Modify | `src/stores/useAppStore.ts:297-353` | bootstrap 內部並行化 |
| Modify | `src/lib/ocr.ts` | 兩段式 `readMealTwoPhase`；刪 3 次中位數、`economy` 死碼、`readMealsFromMultiplePhotos` |
| Modify | `app/diet/new.tsx` | 三態 UI、快照 dirty 追蹤、套用／忽略 |
| Modify | （熱點畫面 ≤5 處） | Task 8 性能掃描結果 |

既知行為變更（spec 已核可）：`app/me/food-library/new.tsx` 經由 `readMealFromBase64` 從 3 次中位數變單次判讀（更快、成本 −2/3，提示詞已強化）。營養標籤、InBody 路徑完全不動。

---

### Task 1: 耗時量測 helper ＋ 基準量測

**Files:**
- Create: `src/lib/perf.ts`
- Modify: `app/_layout.tsx:70-99`（暫時性插入，Task 3 會移入 startup.ts）

- [ ] **Step 1: 建立 `src/lib/perf.ts`**

```ts
// 耗時量測：perfStart('label') 回傳結束函數，呼叫時輸出 [perf] label XXXms。
// 只在 __DEV__ 輸出；release build 為 no-op。
export function perfStart(label: string): () => void {
  if (!__DEV__) return () => {};
  const t0 = Date.now();
  return () => {
    console.log(`[perf] ${label} ${Date.now() - t0}ms`);
  };
}
```

- [ ] **Step 2: 在 `app/_layout.tsx` 現有串行鏈插入量測**

import 區加：

```tsx
import { perfStart } from '@/lib/perf';
```

把 `useEffect`（line 70）內的 async IIFE 改成（僅插入量測，順序與行為不變）：

```tsx
  useEffect(() => {
    (async () => {
      try {
        const endTotal = perfStart('startup:total-to-ready');
        const endSchema = perfStart('startup:schema');
        await ensureSchema();
        endSchema();
        const endBoot = perfStart('startup:bootstrap');
        await bootstrap();
        endBoot();
        const endRest = perfStart('startup:prefs+tutorial+auth');
        await loadThemeMode();
        await loadThemeStyle();
        await loadLowPowerMode();
        await loadCalendarViewMode();
        await loadStatsLayoutJson();
        await loadOnboardingPetName();
        await hydrateTutorial();
        await loadAuthSession();
        endRest();
        // 第一次啟動 → 進 onboarding
        const { user } = useAppStore.getState();
        if (user && !user.onboardingCompletedAt) {
          // 延遲一點讓 Stack 準備好
          setTimeout(() => {
            try {
              const { router } = require('expo-router');
              router.replace('/onboarding');
            } catch {}
          }, 500);
        }
        endTotal();
        setReady(true);
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, [bootstrap, loadThemeMode, loadThemeStyle, loadAuthSession]);
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出（乾淨通過）

- [ ] **Step 4: 記錄基準（裝置可用才做，不阻塞後續）**

Run: `npx expo start`，以實機或模擬器冷啟動 App 3 次，從 Metro console 抄下 `[perf]` 四個數字的中位數，填入 spec 附錄「改前」欄（`docs/superpowers/specs/2026-06-12-app-optimization-design.md`）。
Expected: 例如 `[perf] startup:schema 120ms`、`[perf] startup:bootstrap 450ms`、`[perf] startup:prefs+tutorial+auth 900ms`、`[perf] startup:total-to-ready 1500ms`（實際值依裝置）。
若當下無裝置：在 spec 附錄「改前」欄寫「待使用者實機量測」，繼續 Task 2。

- [ ] **Step 5: Commit**

```bash
git add src/lib/perf.ts app/_layout.tsx
git commit -m "perf: 啟動耗時量測 log（基準量測用）"
```

---

### Task 2: bootstrap 內部並行化

**Files:**
- Modify: `src/stores/useAppStore.ts:297-353`（`bootstrap` action）

注意：expo-sqlite 同一連線內查詢是序列執行，`Promise.all` 省的是每個 query 之間的 JS↔Native 往返與排程空檔；收益靠 Task 9 量測驗證，不先承諾幅度。`generateDailyMessages` 本 task 不動（Task 3 才移到背景，維持每個 commit 都是完整行為）。

- [ ] **Step 1: 改寫 `bootstrap`**

將 `useAppStore.ts` 內整段 `bootstrap: async () => { ... }`（line 297-353）替換為：

```ts
  bootstrap: async () => {
    const user = await repo.getCurrentUser();

    if (!user) {
      const exercises = await repo.listExercises();
      set({ user, exercises, activeEgg: null, pets: [], recentWorkouts: [], routines: [], weeklyCount: 0 });
      return;
    }

    const [exercises, activeEgg, pets, recentWorkouts, routines, weeklyCount] = await Promise.all([
      repo.listExercises(),
      repo.getActiveEgg(user.id),
      repo.listPets(user.id),
      repo.listWorkouts(user.id, 20),
      repo.listRoutines(user.id),
      repo.weeklyWorkoutCount(user.id),
    ]);
    set({ user, exercises, activeEgg, pets, recentWorkouts, routines, weeklyCount });

    // 健康模組初始化
    const [hsRaw, dlRaw, tokens] = await Promise.all([
      healthRepo.getHealthSettings(user.id),
      healthRepo.getDashboardLayout(user.id),
      healthRepo.getStreakFreezeTokens(user.id),
    ]);
    set({
      healthSettings: parseHealthSettings(hsRaw),
      dashboardLayoutJson: dlRaw,
      streakFreezeTokens: tokens,
    });

    // 嘗試自動消耗補課券救 streak
    try {
      const { tryAutoFreeze } = await import('@/lib/streak_freeze');
      const result = await tryAutoFreeze(user);
      if (result.used) {
        await get().refreshUser();
        // 寫一則寵物訊息通知使用者
        await healthRepo.addPetMessage({
          userId: user.id,
          petId: pets[0]?.id ?? null,
          generatedAt: new Date(),
          category: 'celebration',
          text: `補課券救了你的 ${user.streak} 天連續紀錄！還有 ${result.tokensLeft} 張`,
          read: 0,
          triggerData: JSON.stringify({ type: 'freeze-used', tokensLeft: result.tokensLeft }),
        });
        set({ streakFreezeTokens: result.tokensLeft });
      }
    } catch (e) {
      console.warn('Auto freeze failed', e);
    }

    // 每天首次 bootstrap 生成寵物訊息（同天不重複，pet_messages 內部會去重）
    try {
      const { generateDailyMessages } = await import('@/lib/pet_messages');
      await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
    } catch (e) {
      console.warn('Pet messages generate failed', e);
    }

    await Promise.all([get().refreshHealth(), get().refreshCustomFoods()]);
  },
```

與原版的差異：(1) user 為 null 提早 return（原本 5 個查詢各自帶 `user ?` 三元）；(2) 6 個讀取查詢併成一個 `Promise.all`；(3) 尾端 `refreshHealth` / `refreshCustomFoods` 併行。`tryAutoFreeze` 與 `generateDailyMessages` 邏輯原樣保留。

- [ ] **Step 2: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 3: Commit**

```bash
git add src/stores/useAppStore.ts
git commit -m "perf: bootstrap 內部 6 查詢與尾端 refresh 並行化"
```

---

### Task 3: startup.ts 三組編排＋瘦身 _layout

**Files:**
- Create: `src/lib/startup.ts`
- Modify: `app/_layout.tsx`（imports、store hooks、useEffect）
- Modify: `src/stores/useAppStore.ts`（自 `bootstrap` 移除 `generateDailyMessages` 段）

依據（已驗證）：`authSession` 僅 `app/(tabs)/me.tsx`、`app/me/feedback.tsx`、`app/me/delete-account.tsx` 以 selector 訂閱，無首屏 mount 依賴，可安全移背景。`refreshHealth`（useAppStore.ts:899）負責載入 `petMessages`，故訊息生成完成後須補一次 `refreshHealth()`。

- [ ] **Step 1: 建立 `src/lib/startup.ts`**

```ts
import { ensureSchema } from '@/db/migrate';
import { useAppStore } from '@/stores/useAppStore';
import { useTutorialStore } from '@/stores/useTutorialStore';
import { perfStart } from '@/lib/perf';

/**
 * 關鍵路徑：首屏渲染前必須完成的初始化。
 * - DB 鏈：ensureSchema → bootstrap（bootstrap 依賴 schema，必須依序）
 * - 偏好鏈：主題/低耗/檢視模式等 AsyncStorage 讀取 + 教學 hydrate（與 DB 鏈並行；
 *   主題必須在首繪前就緒，避免主題閃爍）
 * 任一失敗 throw，由呼叫端顯示「初始化錯誤」畫面。
 */
export async function runCriticalStartup(): Promise<void> {
  const endTotal = perfStart('startup:critical');
  const app = useAppStore.getState();
  const tutorial = useTutorialStore.getState();

  const dbChain = (async () => {
    const endSchema = perfStart('startup:schema');
    await ensureSchema();
    endSchema();
    const endBoot = perfStart('startup:bootstrap');
    await app.bootstrap();
    endBoot();
  })();

  const endPrefs = perfStart('startup:prefs');
  const prefsChain = Promise.all([
    app.loadThemeMode(),
    app.loadThemeStyle(),
    app.loadLowPowerMode(),
    app.loadCalendarViewMode(),
    app.loadStatsLayoutJson(),
    app.loadOnboardingPetName(),
    tutorial.hydrate(),
  ]).then(() => endPrefs());

  await Promise.all([dbChain, prefsChain]);
  endTotal();
}

/**
 * 背景階段：setReady 之後執行，失敗只 warn 不擋使用。
 * - loadAuthSession：打 Supabase（網路），登入態晚到由 state 更新自然反映
 * - generateDailyMessages：每日寵物訊息；完成後 refreshHealth 重載 petMessages
 */
export function runBackgroundStartup(): void {
  void (async () => {
    const end = perfStart('startup:background');
    const app = useAppStore.getState();
    try {
      await app.loadAuthSession();
    } catch (e) {
      console.warn('[startup] 登入態載入失敗', e);
    }
    try {
      const { user, pets } = useAppStore.getState();
      if (user) {
        const { generateDailyMessages } = await import('@/lib/pet_messages');
        await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
        await useAppStore.getState().refreshHealth();
      }
    } catch (e) {
      console.warn('[startup] 寵物訊息生成失敗', e);
    }
    end();
  })();
}
```

- [ ] **Step 2: 自 `bootstrap` 移除 `generateDailyMessages` 段**

刪除 `src/stores/useAppStore.ts` bootstrap 內這一段（Task 2 改寫後的版本中）：

```ts
    // 每天首次 bootstrap 生成寵物訊息（同天不重複，pet_messages 內部會去重）
    try {
      const { generateDailyMessages } = await import('@/lib/pet_messages');
      await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
    } catch (e) {
      console.warn('Pet messages generate failed', e);
    }
```

（生成改由 `runBackgroundStartup` 負責，且其後補 `refreshHealth()`，首頁訊息卡不會空窗。）

- [ ] **Step 3: 改寫 `app/_layout.tsx`**

imports 區：

```tsx
// 刪除這兩行：
import { ensureSchema } from '@/db/migrate';
import { perfStart } from '@/lib/perf';
// 新增：
import { runCriticalStartup, runBackgroundStartup } from '@/lib/startup';
```

`RootLayout` 內刪除這 9 個 hook 取值（line 33-41，僅 effect 使用，已不需要）：

```tsx
  const bootstrap = useAppStore((s) => s.bootstrap);
  const loadThemeMode = useAppStore((s) => s.loadThemeMode);
  const loadThemeStyle = useAppStore((s) => s.loadThemeStyle);
  const loadLowPowerMode = useAppStore((s) => s.loadLowPowerMode);
  const loadCalendarViewMode = useAppStore((s) => s.loadCalendarViewMode);
  const loadStatsLayoutJson = useAppStore((s) => s.loadStatsLayoutJson);
  const loadOnboardingPetName = useAppStore((s) => s.loadOnboardingPetName);
  const loadAuthSession = useAppStore((s) => s.loadAuthSession);
  const hydrateTutorial = useTutorialStore((s) => s.hydrate);
```

（`themeMode`、`themeStyle` 兩個 selector 保留；若 `useTutorialStore` import 因此無人使用，連同 import 行一併刪除。）

啟動 useEffect 整段替換為：

```tsx
  useEffect(() => {
    (async () => {
      try {
        await runCriticalStartup();
        // 第一次啟動 → 進 onboarding（依賴 bootstrap 的 user，須在關鍵路徑完成後判斷）
        const { user } = useAppStore.getState();
        if (user && !user.onboardingCompletedAt) {
          // 延遲一點讓 Stack 準備好
          setTimeout(() => {
            try {
              const { router } = require('expo-router');
              router.replace('/onboarding');
            } catch {}
          }, 500);
        }
        setReady(true);
        runBackgroundStartup();
      } catch (e: any) {
        setErr(e?.message ?? String(e));
      }
    })();
  }, []);
```

其餘（fonts、theme resolve、通知 handler、JSX）完全不動。

- [ ] **Step 4: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 5: 煙測（裝置可用才做；不可用則留待 Task 9 一併驗）**

Run: `npx expo start` 冷啟動，確認：
1. App 正常進首頁，無「初始化錯誤」。
2. Metro console 出現 `[perf] startup:critical` 與 `[perf] startup:background` 兩組數字。
3. 首頁寵物訊息卡有今日訊息（背景生成後補 refreshHealth 的效果）。
4. 「我」分頁登入區塊正常（已登入顯示 email；authSession 晚到會自動補上）。

- [ ] **Step 6: Commit**

```bash
git add src/lib/startup.ts app/_layout.tsx src/stores/useAppStore.ts
git commit -m "perf: 啟動三組化（DB 鏈與偏好鏈並行；auth/寵物訊息移背景）+ startup.ts 抽檔"
```

---

### Task 4: meal_prompts.ts——提示詞抽檔＋強化

**Files:**
- Create: `src/lib/meal_prompts.ts`
- Modify: `src/lib/ocr.ts`（刪內嵌 `MEAL_PROMPT` 與手掌提示字串，改 import）

- [ ] **Step 1: 建立 `src/lib/meal_prompts.ts`**

```ts
// 食物判讀提示詞（初判 + 複核共用知識）。
// 改提示詞只動這個檔，ocr.ts 維持純邏輯。

const REF_TABLE = `## 台灣常見菜與標準熱量參考（per 一般份量）：
- 白飯一碗 (200g) 280 kcal，P:6 C:62 F:0
- 滷肉飯一碗：600 kcal（P:15 C:85 F:20，含肥肉+滷汁油脂）
- 雞腿便當：900 kcal（P:40 C:100 F:35，含三樣配菜）
- 排骨便當：850 kcal
- 自助餐便當（三菜一肉）：750 kcal（P:30 C:90 F:28）
- 牛肉麵大碗：750 kcal（P:35 C:95 F:20）
- 陽春麵 + 小菜：500 kcal
- 鹽酥雞一份：500 kcal（超高油 F:35）
- 雞排一塊：450 kcal（F:25）
- 肉粽一顆：450 kcal
- 飯糰（超商）：300 kcal
- 蛋餅（加蛋）：350 kcal
- 鐵板麵（早餐店，加蛋）：550 kcal
- 蘿蔔糕 2 塊（早餐店）：350 kcal
- 鍋貼 10 顆：700 kcal
- 早餐店奶茶（中杯 350ml）：250 kcal
- 小籠包 8 顆：560 kcal
- 炒麵一盤：600 kcal
- 蚵仔煎：500 kcal
- 擔仔麵：300 kcal
- 滷味一份（中）：400 kcal
- 個人小火鍋（含肉盤+冬粉或王子麵，不含沾醬）：800 kcal；沙茶醬一碟另加 150 kcal
- 麥當勞大麥克：550 kcal，套餐 1200 kcal
- 珍珠奶茶 700ml 全糖：550 kcal
- 含糖拿鐵 大杯：250 kcal
- 美式咖啡黑：5 kcal
- 水餃 10 顆：450 kcal
- 燙青菜：50 kcal
- 荷包蛋：90 kcal
- 滷蛋：80 kcal
- 茶葉蛋：75 kcal
- 豆干一塊：35 kcal
- 超商烤地瓜（中）：130 kcal
- 無糖豆漿 450ml：160 kcal
- 即食雞胸肉一包：110 kcal
- 手搖飲糖度換算（以全糖為基準）：半糖 −15%、微糖 −30%、無糖 −45%；珍珠/配料本身另計約 200 kcal

## 份量錨點（畫面無比例尺時用這些目測）：
- 一個拳頭 ≈ 一碗飯（200-250g）
- 一個掌心面積、小指厚 ≈ 一份熟肉（約 100g）
- 一個拇指 ≈ 一份油脂（約 10g ≈ 90 kcal）`;

export const MEAL_PROMPT = `你是台灣食物營養估算助手。使用者在台灣，會上傳一餐照片（外食、便當、自煮、小吃都有）。

## 判讀流程（內部請依此順序思考，不輸出 reasoning）：

第一步「辨識」：先仔細看照片，列出你看到的所有食物 / 飲料 / 醬料 / 配菜。注意容器大小（飯碗、便當盒、一般盤子直徑約 20cm）作為參照物。別漏了：
- 醬汁（滷肉飯的油脂、酸菜、辣油）
- 配菜（滷蛋、豆乾、酸菜、花生、醃菜）
- 隱藏油脂（三層肉、肥肉、炸物外皮）
- 飲料（含糖飲料、湯底）

第二步「估份量」：根據容器/參照物估每樣的公克 / 份數。台灣一碗白飯 ≈ 200-250g、一個便當盒 ≈ 700-800g 總重。

第三步「估營養素」：用下方台灣常見菜參考表，依實際份量 scale。

第四步「自我檢查」（輸出前必做）：逐類確認——
1. 醬汁/淋醬都列了嗎？
2. 飲料/湯都列了嗎？
3. 配菜/小菜都列了嗎？
4. 隱藏油脂（肥肉、炸皮、油亮反光）反映在 fat 了嗎？
漏任何一類就回到第一步補上。

${REF_TABLE}

## 原則：
- ⚠️ 系統性校正：你（與多數視覺模型）對台灣食物份量普遍高估 20~40%，特別是便當、麵食、油脂類。完成估算後整體下修檢視一次；照片中有手掌比例尺時以比例尺為準。
- 品名不確定時用通用名稱（如「滷肉類蓋飯」「綠葉炒青菜」），不要猜成特定菜名——錯的菜名會誤導熱量。
- 照片油光越多、湯汁越多 → 脂肪上調
- 便當有三格配菜 → 至少多加 100-150 kcal
- 若畫面有時間標記（如 12:30）→ 判斷餐別，午/晚餐份量應比早餐大
- 含糖飲料、湯底別漏

## 輸出（嚴格 JSON，不要 markdown，不要 reasoning 文字）：
{
  "title": "午餐｜滷肉飯套餐",
  "items": [
    {"name":"滷肉飯","portion":"一碗","calories":600,"protein":15,"carb":85,"fat":20},
    {"name":"滷蛋","portion":"一顆","calories":80,"protein":7,"carb":1,"fat":5},
    {"name":"燙青菜","portion":"一盤","calories":50,"protein":2,"carb":6,"fat":1}
  ],
  "totalCalories": 730,
  "totalProtein": 24,
  "totalCarb": 92,
  "totalFat": 26
}

若不是食物照片或無法辨識，回傳 {"error":"無法判讀"}`;

export const VERIFY_PROMPT = `你是台灣食物營養估算的「複核員」。另一位估算員已對這張照片做出初步判讀（JSON 附在使用者訊息中）。你的任務不是從零重新判讀，而是針對兩類最常見的錯誤逐項複核。

## 複核重點一：漏項
重新仔細看照片，逐類檢查初判清單：
- 醬汁與淋醬（滷汁、肉燥、辣油、美乃滋、沙茶）
- 飲料與湯（含糖飲料、湯底、濃湯）
- 配菜（滷蛋、豆乾、酸菜、花生、泡菜、小菜碟）
- 隱藏油脂（肥肉、炸物外皮、油亮反光、油炒痕跡）
照片中確實存在但初判沒列的 → 補進 items；初判列了但照片中其實沒有的 → 移除。

## 複核重點二：份量（系統性高估）
估算員對台灣食物份量普遍高估 20~40%（特別是便當、麵食、油脂類）。逐項檢查初判份量與熱量：
- 以照片中的容器、餐具、（若有）手掌為參照重新評估
- 有疑慮時向下修正，不要向上加碼
- 但若初判明顯漏算（例如整碗飯沒算到），照實上修

${REF_TABLE}

## 輸出
回傳「修正後的完整結果」，格式與初判完全相同（title/items/totalCalories/totalProtein/totalCarb/totalFat 的嚴格 JSON）。
- 初判大致正確就輸出幾乎相同的內容——不要為了改而改
- totals 必須等於 items 加總
- 嚴格只回 JSON，不要 markdown、不要解釋文字`;

export function buildPalmRefHint(palmRef: { lengthCm: number; widthCm: number }): string {
  return `## 比例尺參照
使用者的手掌張開時：長 ${palmRef.lengthCm} cm（中指尖到手腕）、寬 ${palmRef.widthCm} cm（四指根橫寬不含拇指）。
若照片中出現平放且五指張開的手掌，請優先用此 calibrate 食物的真實尺寸再估份量；若手掌姿勢非五指張開或不平放（如握拳、側立、捏東西），可忽略此參照。`;
}
```

（強化點對照 spec：高估校正常駐於 MEAL_PROMPT 原則區、第四步自我檢查清單、參考表擴充 11 項＋糖度換算＋份量錨點、通用名原則。原本只在 palmRef 才出現的「⚠️ 重要校正」段落，其校正語句已常駐化，故 `buildPalmRefHint` 不再重複。）

- [ ] **Step 2: `src/lib/ocr.ts` 改用抽出的提示詞**

1. import 區加：

```ts
import { MEAL_PROMPT, buildPalmRefHint } from './meal_prompts';
```

2. 刪除整段內嵌 `const MEAL_PROMPT = \`...\`;`（line 13-74）。
3. `singleRead` 內的 palmRef 段（原 line 146-154）替換為：

```ts
  if (options.palmRef) {
    parts.push(buildPalmRefHint(options.palmRef));
  }
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 4: Commit**

```bash
git add src/lib/meal_prompts.ts src/lib/ocr.ts
git commit -m "ai: 提示詞抽檔＋強化（常駐高估校正/自我檢查/參考表擴充/通用名原則）"
```

---

### Task 5: meal_verify.ts 純函數＋斷言腳本

**Files:**
- Create: `src/lib/meal_verify.ts`
- Create: `scripts/verify_meal_logic.ts`

meal_verify.ts 只能用 `import type`（型別在編譯後抹除），不得有任何 runtime import——否則斷言腳本在 node 下會拉進 React Native 模組而炸掉。

- [ ] **Step 1: 先寫斷言腳本（此時必然失敗）**

建立 `scripts/verify_meal_logic.ts`：

```ts
// meal_verify 純函數斷言腳本。執行：npx -y tsx scripts/verify_meal_logic.ts
// 不依賴測試框架；全過輸出 ALL PASS。
import {
  diffReadings,
  snapshotOf,
  mergeVerifiedIntoForm,
  formatDiffSummary,
  type MealFormValues,
} from '../src/lib/meal_verify';

let passed = 0;
function check(name: string, cond: boolean): void {
  if (!cond) throw new Error(`FAIL: ${name}`);
  passed++;
  console.log(`  ok - ${name}`);
}

const item = (name: string, calories: number) => ({ name, calories, protein: 10, carb: 20, fat: 5 });

const prelim = {
  title: '午餐｜滷肉飯套餐',
  items: [item('滷肉飯', 600), item('燙青菜', 50)],
  totalCalories: 730,
  totalProtein: 24,
  totalCarb: 92,
  totalFat: 26,
};

// --- diffReadings ---
{
  const d = diffReadings(prelim, { ...prelim });
  check('無差異 → 不顯著', !d.significant && d.calorieDeltaPct === 0 && d.addedItems.length === 0);
}
{
  const verified = { ...prelim, items: [...prelim.items, item('滷蛋', 80)], totalCalories: 810 };
  const d = diffReadings(prelim, verified);
  check('新增品項 → 顯著且列名', d.significant && d.addedItems.join() === '滷蛋' && d.removedItems.length === 0);
}
{
  const verified = { ...prelim, items: [prelim.items[0]], totalCalories: 680 };
  const d = diffReadings(prelim, verified);
  check('移除品項 → 顯著且列名', d.significant && d.removedItems.join() === '燙青菜');
}
{
  const d = diffReadings(prelim, { ...prelim, totalCalories: 650 });
  check('熱量 −11% 且品項相同 → 不顯著', !d.significant && d.calorieDeltaPct === -11);
}
{
  const d = diffReadings(prelim, { ...prelim, totalCalories: 580 });
  check('熱量 −21% → 顯著', d.significant && d.calorieDeltaPct === -21);
}

// --- snapshot / mergeVerifiedIntoForm ---
const applied: MealFormValues = {
  title: prelim.title,
  items: prelim.items,
  calories: '730',
  protein: '24',
  carb: '92',
  fat: '26',
};
const snap = snapshotOf(applied);
const verified = {
  title: '午餐｜滷肉飯套餐',
  items: [item('滷肉飯', 520), item('燙青菜', 50), item('滷蛋', 80)],
  totalCalories: 650,
  totalProtein: 31,
  totalCarb: 93,
  totalFat: 28,
};
{
  const next = mergeVerifiedIntoForm(applied, snap, verified);
  check('未動過 → 全部套用', next.calories === '650' && next.items.length === 3 && next.protein === '31');
}
{
  const edited: MealFormValues = { ...applied, calories: '700' }; // 使用者改過熱量
  const next = mergeVerifiedIntoForm(edited, snap, verified);
  check('改過的欄位保留', next.calories === '700');
  check('沒改的欄位仍套用', next.fat === '28' && next.items.length === 3);
}
{
  const edited: MealFormValues = { ...applied, items: [applied.items[0]] }; // 使用者刪過品項
  const next = mergeVerifiedIntoForm(edited, snap, verified);
  check('items 動過 → items 保留使用者版本', next.items.length === 1);
  check('items 動過但 totals 沒動 → totals 仍套用', next.calories === '650');
}

// --- formatDiffSummary ---
{
  const d = diffReadings(prelim, verified);
  const s = formatDiffSummary(730, verified, d);
  check('摘要含熱量變化', s.includes('730→650'));
  check('摘要含新增品項', s.includes('滷蛋'));
}

console.log(`ALL PASS (${passed} checks)`);
```

- [ ] **Step 2: 跑腳本確認失敗**

Run: `npx -y tsx scripts/verify_meal_logic.ts`
Expected: FAIL——`Cannot find module '../src/lib/meal_verify'`（檔案還不存在）

- [ ] **Step 3: 建立 `src/lib/meal_verify.ts`**

```ts
// 複核差異比對與套用合併：純函數、零 runtime 依賴（node 可直接跑，見 scripts/verify_meal_logic.ts）。
import type { MealReading } from './ocr';
import type { MealItem } from '@/db/schema';

export type MealDiff = {
  significant: boolean;
  /** (verified - prelim) / max(prelim, 1)，四捨五入百分比 */
  calorieDeltaPct: number;
  addedItems: string[];
  removedItems: string[];
};

const norm = (s: string) => s.trim().toLowerCase();

/** 顯著差異門檻：總熱量差 >15% 或品項有增刪（spec 核可值） */
export function diffReadings(prelim: MealReading, verified: MealReading): MealDiff {
  const prelimNames = new Set((prelim.items ?? []).map((i) => norm(i.name)));
  const verifiedNames = new Set((verified.items ?? []).map((i) => norm(i.name)));
  const addedItems = (verified.items ?? []).filter((i) => !prelimNames.has(norm(i.name))).map((i) => i.name);
  const removedItems = (prelim.items ?? []).filter((i) => !verifiedNames.has(norm(i.name))).map((i) => i.name);
  const base = Math.max(prelim.totalCalories || 0, 1);
  const calorieDeltaPct = Math.round((((verified.totalCalories || 0) - (prelim.totalCalories || 0)) / base) * 100);
  return {
    significant: Math.abs(calorieDeltaPct) > 15 || addedItems.length > 0 || removedItems.length > 0,
    calorieDeltaPct,
    addedItems,
    removedItems,
  };
}

/** diet/new 表單目前值（totals 以畫面字串為準，比對才不受格式化干擾） */
export type MealFormValues = {
  title: string;
  items: MealItem[];
  calories: string;
  protein: string;
  carb: string;
  fat: string;
};

/** AI 套用當下的表單快照：欄位值與快照相同 = 使用者沒動過 */
export type AppliedSnapshot = {
  title: string;
  itemsJson: string;
  calories: string;
  protein: string;
  carb: string;
  fat: string;
};

export function snapshotOf(v: MealFormValues): AppliedSnapshot {
  return {
    title: v.title,
    itemsJson: JSON.stringify(v.items),
    calories: v.calories,
    protein: v.protein,
    carb: v.carb,
    fat: v.fat,
  };
}

/**
 * 把複核結果套進表單：只覆蓋「使用者沒動過」的欄位（與快照逐欄比對）。
 * items 整組比對（明細列表 UI 只能刪不能改，使用者刪過就整組尊重使用者）。
 */
export function mergeVerifiedIntoForm(
  current: MealFormValues,
  snapshot: AppliedSnapshot,
  verified: MealReading,
): MealFormValues {
  const next: MealFormValues = { ...current };
  if (JSON.stringify(current.items) === snapshot.itemsJson) next.items = verified.items ?? [];
  if (current.title === snapshot.title && verified.title) next.title = verified.title;
  if (current.calories === snapshot.calories) next.calories = String(verified.totalCalories);
  if (current.protein === snapshot.protein) next.protein = String(verified.totalProtein);
  if (current.carb === snapshot.carb) next.carb = String(verified.totalCarb);
  if (current.fat === snapshot.fat) next.fat = String(verified.totalFat);
  return next;
}

/** 差異橫幅文案，例：「總熱量 730→650 kcal（-11%）；新增：滷蛋」 */
export function formatDiffSummary(fromCalories: number, verified: MealReading, diff: MealDiff): string {
  const parts: string[] = [];
  if ((verified.totalCalories || 0) !== fromCalories) {
    const sign = diff.calorieDeltaPct > 0 ? '+' : '';
    parts.push(`總熱量 ${fromCalories}→${verified.totalCalories} kcal（${sign}${diff.calorieDeltaPct}%）`);
  }
  if (diff.addedItems.length > 0) parts.push(`新增：${diff.addedItems.join('、')}`);
  if (diff.removedItems.length > 0) parts.push(`移除：${diff.removedItems.join('、')}`);
  return parts.length > 0 ? parts.join('；') : '內容微調';
}
```

- [ ] **Step 4: 跑腳本確認全過**

Run: `npx -y tsx scripts/verify_meal_logic.ts`
Expected: 逐行 `ok - ...`，最後 `ALL PASS (12 checks)`

- [ ] **Step 5: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出（tsconfig include 含 `**/*.ts`，腳本一併被檢查）

- [ ] **Step 6: Commit**

```bash
git add src/lib/meal_verify.ts scripts/verify_meal_logic.ts
git commit -m "ai: 複核差異比對/快照套用純函數＋斷言腳本"
```

---

### Task 6: ocr.ts 兩段式判讀

**Files:**
- Modify: `src/lib/ocr.ts`

改動總覽：`MealParseOptions` 的 `economy`（無呼叫端的死碼）改為 `skipVerify`；新增 `verifyRead` 與 `readMealTwoPhase`；`readMealFromBase64` 改為「單次＋失敗重試」相容包裝（呼叫端 `app/me/food-library/new.tsx` 不需改）；刪除 `mergeReadings`、`median`、`readMealsFromMultiplePhotos`（唯一呼叫端 diet/new 在 Task 7 改為兩段式）。`mergeMealReadings`、營養標籤、InBody 不動。

- [ ] **Step 1: 改 `MealParseOptions` 與 import**

import 區（Task 4 已改）再加 `VERIFY_PROMPT`：

```ts
import { MEAL_PROMPT, VERIFY_PROMPT, buildPalmRefHint } from './meal_prompts';
```

`MealParseOptions`（line 76-82 附近）改為：

```ts
export type MealParseOptions = {
  extraHint?: string;
  /** 跳過背景複核（低耗模式或呼叫端只要單次結果時用） */
  skipVerify?: boolean;
  capturedAt?: Date | number;
  /** 手掌參照（plan v6）：照片中若有平放手掌，AI 用此 calibrate 真實尺寸 */
  palmRef?: { lengthCm: number; widthCm: number };
};
```

- [ ] **Step 2: 抽共用 JSON 解析（`singleRead` 內邏輯不變、供 `verifyRead` 重用）**

在 `singleRead` 上方新增：

```ts
function parseMealJson(raw: string): MealReading {
  const cleaned = raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');

  if (/^<think>/i.test(cleaned) || cleaned.includes('I cannot see') || cleaned.includes('cannot read')) {
    throw new Error('此模型不支援看圖，請換 OpenAI / Claude / Gemini');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(
      cleaned
        ? `AI 回傳非 JSON（前 150 字）：${cleaned.slice(0, 150)}`
        : 'AI 回傳空白回應（可能是圖太大被拒、內容過濾觸發、或 API 額度問題）',
    );
  }
  if (parsed.error) throw new Error(parsed.error);
  return parsed as MealReading;
}
```

`singleRead` 自 `const cleaned = ...` 到 `return parsed as MealReading;`（原 line 167-184）整段替換為：

```ts
  return parseMealJson(raw);
```

- [ ] **Step 3: 新增 `verifyRead` 與 `readMealTwoPhase`，改寫 `readMealFromBase64`**

刪除整段 `readMealFromBase64`（原 line 385-420）、`mergeReadings`（line 204-238）、`median`（line 196-202）、`readMealsFromMultiplePhotos`（line 240-267），在 `mergeMealReadings` 之後新增：

```ts
async function verifyRead(
  base64: string,
  preliminary: MealReading,
  options: InternalOptions,
): Promise<MealReading> {
  const parts: string[] = [
    '以下是初步判讀結果，請依系統指示複核（漏項＋份量），回傳修正後的完整 JSON：',
    JSON.stringify(preliminary),
  ];
  const timeHint = mealTimeHint(options.capturedAt);
  if (timeHint) parts.push(timeHint);
  if (options.memoryHint) parts.push(options.memoryHint);
  if (options.palmRef) parts.push(buildPalmRefHint(options.palmRef));
  const hint = options.extraHint?.trim();
  if (hint) parts.push(`使用者補充：${hint}`);

  const raw = await callVisionJSON({
    systemPrompt: VERIFY_PROMPT,
    userPrompt: parts.join('\n'),
    base64,
    temperature: 0.1,
    maxTokens: 2500,
  });
  const parsed = parseMealJson(raw);
  if (!isSane(parsed)) throw new Error('複核結果不合理');
  return sanityCheck(parsed);
}

export type TwoPhaseResult = {
  /** 初判（已過 sanityCheck），拿到就能直接顯示 */
  preliminary: MealReading;
  /** 背景複核：skipVerify 或複核失敗時 resolve null（永不 reject） */
  verification: Promise<MealReading | null>;
};

/**
 * 兩段式判讀：1 次初判立即回 + 1 次針對性複核（漏項＋份量）背景跑。
 * 取代舊「3 次取中位數」：首結果快 2~3 倍、總成本 −1/3。
 */
export async function readMealTwoPhase(
  base64: string,
  options: MealParseOptions = {},
): Promise<TwoPhaseResult> {
  const memoryHint = await getMemoryHint(10);
  const t0 = Date.now();

  let preliminary: MealReading;
  try {
    const first = await singleRead(base64, { ...options, memoryHint, temperature: 0.1 });
    if (!isSane(first)) throw new Error('AI 判讀結果不合理，請再試一次');
    preliminary = first;
  } catch (firstErr: any) {
    // 同舊版 fallback：換個 temperature 再試一次，仍失敗就把第一次錯誤丟出去
    let retry: MealReading;
    try {
      retry = await singleRead(base64, { ...options, memoryHint, temperature: 0.4 });
    } catch {
      throw new Error(firstErr?.message ?? 'AI 判讀失敗');
    }
    if (!isSane(retry)) throw new Error('AI 判讀結果不合理，請再試一次');
    preliminary = retry;
  }
  preliminary = sanityCheck(preliminary);
  if (__DEV__) console.log(`[ai] 初判完成 ${Date.now() - t0}ms`);

  const verification: Promise<MealReading | null> = options.skipVerify
    ? Promise.resolve(null)
    : verifyRead(base64, preliminary, { ...options, memoryHint })
        .then((v) => {
          if (__DEV__) console.log(`[ai] 複核完成 ${Date.now() - t0}ms`);
          return v;
        })
        .catch((e) => {
          console.warn('[ai] 複核失敗（保留初判）', e?.message ?? e);
          return null;
        });

  return { preliminary, verification };
}

/** 相容包裝：單次判讀（含一次重試）。現有呼叫端：app/me/food-library/new.tsx */
export async function readMealFromBase64(
  base64: string,
  options: MealParseOptions = {},
): Promise<MealReading> {
  const { preliminary } = await readMealTwoPhase(base64, { ...options, skipVerify: true });
  return preliminary;
}
```

- [ ] **Step 4: 確認舊符號已無人引用**

Run: `npx tsc --noEmit`
Expected: 唯一的錯誤是 `app/diet/new.tsx` 引用已刪除的 `readMealsFromMultiplePhotos`——這是預期的中繼狀態，Task 7 立即處理。除該檔外不得有其他錯誤。

- [ ] **Step 5: 不單獨 commit**

本 task 不 commit（避免留下紅燈 commit）。直接接續 Task 7，其 Step 8 的 `git add` 已包含 `src/lib/ocr.ts`，兩個檔案一起進同一個 commit。

---

### Task 7: diet/new.tsx 接三態 UI

**Files:**
- Modify: `app/diet/new.tsx`

- [ ] **Step 1: imports 與 state**

line 4 改為：

```tsx
import { useEffect, useRef, useState } from 'react';
```

line 8 改為：

```tsx
import { readMealTwoPhase, mergeMealReadings, readNutritionLabelFromBase64, type MealReading, type MergeMode, type TwoPhaseResult } from '@/lib/ocr';
```

import 區加：

```tsx
import { diffReadings, snapshotOf, mergeVerifiedIntoForm, formatDiffSummary, type MealDiff, type AppliedSnapshot } from '@/lib/meal_verify';
```

在 `const [photoMode, ...]`（line 169）之後新增 state：

```tsx
  type VerifyState = 'idle' | 'verifying' | 'verified' | 'diff';
  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [pendingVerified, setPendingVerified] = useState<MealReading | null>(null);
  const [pendingVerifiedList, setPendingVerifiedList] = useState<MealReading[] | null>(null);
  const [verifyDiff, setVerifyDiff] = useState<MealDiff | null>(null);
  const appliedSnapshot = useRef<AppliedSnapshot | null>(null);
  // 每輪判讀遞增；照片增刪/模式切換也遞增，讓過期的背景複核結果自動作廢
  const parseSeq = useRef(0);
```

- [ ] **Step 2: 失效點遞增 parseSeq**

三處在現有 `setAiParsed(false)` 旁加一行 `parseSeq.current++;`：

1. `pick()` 內（原 line 256-258）：

```tsx
    // 加新照片就清掉之前的 AI 結果（避免混淆）
    parseSeq.current++;
    setAiParsed(false);
    setPerPhotoReadings([]);
    setVerifyState('idle');
```

2. `removePhoto()` 內（原 line 269-274）：

```tsx
  const removePhoto = (idx: number) => {
    haptic.tapLight();
    setPhotos((prev) => prev.filter((_, i) => i !== idx));
    parseSeq.current++;
    setPerPhotoReadings([]);
    setAiParsed(false);
    setVerifyState('idle');
  };
```

3. mergeMode 兩顆切換按鈕（原 line 531、542）的 onPress 各改為：

```tsx
onPress={() => { haptic.tapLight(); setMergeMode('sameMeal'); parseSeq.current++; setAiParsed(false); setVerifyState('idle'); }}
```

```tsx
onPress={() => { haptic.tapLight(); setMergeMode('multipleMeals'); parseSeq.current++; setAiParsed(false); setVerifyState('idle'); }}
```

- [ ] **Step 3: `apply` 記快照、新增複核處理函數**

`apply`（原 line 336-345）改為：

```tsx
  const apply = (r: MealReading) => {
    const next = {
      title: r.title ?? '',
      items: r.items ?? [],
      calories: String(r.totalCalories),
      protein: String(r.totalProtein),
      carb: String(r.totalCarb),
      fat: String(r.totalFat),
    };
    setTitle(next.title);
    setItems(next.items);
    setAiOriginalItems(next.items);
    setCalories(next.calories);
    setProtein(next.protein);
    setCarb(next.carb);
    setFat(next.fat);
    appliedSnapshot.current = snapshotOf(next);
    setAiParsed(true);
  };
```

`apply` 之後新增三個函數：

```tsx
  const handleVerified = (prelim: MealReading, verified: MealReading, verifiedList: MealReading[]) => {
    const diff = diffReadings(prelim, verified);
    if (__DEV__) console.log(`[ai] 複核差異 ${diff.calorieDeltaPct}%；新增 ${diff.addedItems.length}、移除 ${diff.removedItems.length}`);
    if (!diff.significant) {
      setVerifyState('verified');
      return;
    }
    setPendingVerified(verified);
    setPendingVerifiedList(verifiedList);
    setVerifyDiff(diff);
    setVerifyState('diff');
  };

  const applyVerifiedFix = () => {
    if (!pendingVerified || !appliedSnapshot.current) return;
    haptic.tapMedium();
    const next = mergeVerifiedIntoForm(
      { title, items, calories, protein, carb, fat },
      appliedSnapshot.current,
      pendingVerified,
    );
    setTitle(next.title);
    setItems(next.items);
    setCalories(next.calories);
    setProtein(next.protein);
    setCarb(next.carb);
    setFat(next.fat);
    setAiOriginalItems(next.items); // 修正後成為 AI 基準，儲存時 memory 學「使用者 vs 複核版」差異
    appliedSnapshot.current = snapshotOf(next);
    if (pendingVerifiedList) setPerPhotoReadings(pendingVerifiedList); // multipleMeals 分筆儲存用同步更新
    setPendingVerified(null);
    setPendingVerifiedList(null);
    setVerifyDiff(null);
    setVerifyState('verified');
  };

  const dismissVerifiedFix = () => {
    haptic.tapLight();
    setPendingVerified(null);
    setPendingVerifiedList(null);
    setVerifyDiff(null);
    setVerifyState('verified');
  };
```

- [ ] **Step 4: 改寫 `onAIParse`**

整段（原 line 276-334）替換為：

```tsx
  const onAIParse = async () => {
    if (photos.length === 0) {
      Alert.alert('請先選照片');
      return;
    }
    const check = await hasActiveProviderKey();
    if (!check.has) {
      Alert.alert(
        `需要 ${check.providerLabel} API Key`,
        `當前模型：${check.modelName}\n\n請到「我 → 設定」填入 ${check.providerLabel} 的 API Key 再試\n\n或直接手動輸入數值`,
      );
      return;
    }

    setOcrLoading(true);
    setVerifyState('idle');
    setPendingVerified(null);
    setPendingVerifiedList(null);
    setVerifyDiff(null);
    const seq = ++parseSeq.current;
    haptic.tapMedium();
    const palmRef = includePalmRef
      ? { lengthCm: healthSettings.body.palmLengthCm, widthCm: healthSettings.body.palmWidthCm }
      : undefined;
    try {
      // 營養標模式：讀取包裝營養表（單次，不複核）
      if (photoMode === 'label') {
        const reading = await readNutritionLabelFromBase64(photos[0].base64);
        setPerPhotoReadings([reading]);
        apply(reading);
        haptic.success();
        return;
      }

      if (photos.length === 1) {
        const { preliminary, verification } = await readMealTwoPhase(photos[0].base64, {
          capturedAt: photos[0].takenAt ?? Date.now(),
          palmRef,
          skipVerify: lowPower, // 低耗模式維持單次、不複核
        });
        setPerPhotoReadings([preliminary]);
        apply(preliminary);
        if (!lowPower) {
          setVerifyState('verifying');
          verification.then((verified) => {
            if (seq !== parseSeq.current) return; // 過期結果作廢
            if (!verified) {
              setVerifyState('idle'); // 複核失敗：保留初判、不打擾
              return;
            }
            handleVerified(preliminary, verified, [verified]);
          });
        }
      } else {
        // 多照片：每張獨立兩段式。低耗 → 序列且跳過複核（同舊行為的單次序列）
        let results: TwoPhaseResult[] = [];
        if (lowPower) {
          for (const p of photos) {
            try {
              results.push(await readMealTwoPhase(p.base64, { palmRef, skipVerify: true }));
            } catch (e) {
              console.warn('Photo read failed', e);
            }
          }
        } else {
          const settled = await Promise.allSettled(photos.map((p) => readMealTwoPhase(p.base64, { palmRef })));
          results = settled
            .filter((s): s is PromiseFulfilledResult<TwoPhaseResult> => s.status === 'fulfilled')
            .map((s) => s.value);
        }
        const prelims = results.map((r) => r.preliminary);
        setPerPhotoReadings(prelims);
        if (prelims.length === 0) {
          Alert.alert('判讀失敗', '所有照片都判讀失敗，請手動輸入');
          return;
        }
        // 同一餐 → 取平均合併成 1 份；不同餐 → 顯示總和供使用者預覽（儲存時拆 N 餐）
        const merged = mergeMealReadings(prelims, mergeMode);
        apply(merged);
        if (!lowPower) {
          setVerifyState('verifying');
          Promise.all(results.map((r) => r.verification)).then((vs) => {
            if (seq !== parseSeq.current) return;
            if (vs.every((v) => v === null)) {
              setVerifyState('idle');
              return;
            }
            const verifiedList = vs.map((v, i) => v ?? prelims[i]); // 個別複核失敗 → 沿用該張初判
            const mergedVerified = mergeMealReadings(verifiedList, mergeMode);
            handleVerified(merged, mergedVerified, verifiedList);
          });
        }
      }
      haptic.success();
    } catch (e: any) {
      haptic.error();
      Alert.alert('判讀失敗', e?.message ?? String(e));
    } finally {
      setOcrLoading(false);
    }
  };
```

- [ ] **Step 5: 複核三態 UI**

AI 按鈕載入文案（原 line 625）`AI 估算中...` 改為 `AI 初判中...`（其餘不變）。

在 AI 按鈕區塊結束的 `</>`（原 line 636）與 `<FoodPickerModal`（原 line 639）之間插入：

```tsx
        {aiParsed && verifyState === 'verifying' && (
          <View className="flex-row items-center gap-2 mb-3">
            <ActivityIndicator size="small" color={palette.mute} />
            <Text className="text-kibo-mute text-xs">AI 複核中…（結果可先用，有差異會提示）</Text>
          </View>
        )}
        {aiParsed && verifyState === 'verified' && (
          <Text className="text-kibo-success text-xs mb-3">✓ 已複核</Text>
        )}
        {aiParsed && verifyState === 'diff' && verifyDiff && pendingVerified && (
          <View className="bg-kibo-surface border border-kibo-accent rounded-2xl p-3 mb-3">
            <Text className="text-kibo-text text-sm font-semibold mb-1">🔍 複核發現差異</Text>
            <Text className="text-kibo-mute text-xs mb-2">
              {formatDiffSummary(Number(calories) || 0, pendingVerified, verifyDiff)}
            </Text>
            <View className="flex-row gap-2">
              <Pressable onPress={applyVerifiedFix} className="flex-1 bg-kibo-primary rounded-xl py-2">
                <Text className="text-kibo-bg text-center text-sm font-bold">套用修正</Text>
              </Pressable>
              <Pressable onPress={dismissVerifiedFix} className="flex-1 bg-kibo-card rounded-xl py-2">
                <Text className="text-kibo-text text-center text-sm">保留原值</Text>
              </Pressable>
            </View>
          </View>
        )}
```

- [ ] **Step 6: 型別檢查（Task 6 若暫留了 `readMealsFromMultiplePhotos`，此時刪掉再查）**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 7: 開發環境煙測（需 API Key；無 Key 時驗證到「初判失敗 alert」為止）**

1. 單張食物照 → 立即填表＋「AI 複核中…」→ 數秒後變「✓ 已複核」或出現差異橫幅。
2. 差異橫幅按「套用修正」→ 數值更新；先手動改熱量再套用 → 熱量保留使用者值、其餘更新。
3. 低耗模式開啟 → 單張判讀無「複核中」標示。
4. 營養標模式 → 行為與舊版相同（無複核標示）。
5. 判讀中改 mergeMode 或刪照片 → 不會出現過期橫幅。

- [ ] **Step 8: Commit**

```bash
git add src/lib/ocr.ts app/diet/new.tsx
git commit -m "ai: diet/new 兩段式接線（複核三態 UI＋快照式欄位保護＋過期作廢）"
```

---

### Task 8: 順手性能掃描（上限 5 處）

**Files:**
- Modify: 依掃描結果，候選：`app/(tabs)/routines.tsx`、`src/components/common/PixelArt.tsx`、`src/components/pet/PixelSprite.tsx`、`app/(tabs)/index.tsx`
- Modify: `docs/superpowers/plans/2026-06-12-app-optimization.md`（本檔附錄記錄結果）

規則：只做「包 `useMemo` / `React.memo` / 抽出 render 內重複計算」這類不改邏輯的修補；單處改動超過 20 行就放棄並記入附錄；總數上限 5 處。

- [ ] **Step 1: 檢查具名候選**

逐一打開確認（已知線索）：
1. `app/(tabs)/routines.tsx:38-50` —— render 路徑上有 `.filter().reduce()` 課表統計；若它在每次 render 重算（無 useMemo 包裹），包 `useMemo`，依賴 `[routines, exercises]`（以實際變數為準）。
2. `src/components/common/PixelArt.tsx` 與 `src/components/pet/PixelSprite.tsx` —— 像素網格若以 N×N 個 `<View>` map 產生且未 memo，元件包 `React.memo`、網格陣列包 `useMemo`。
3. `app/(tabs)/index.tsx:113-122` —— layout parse 已有 `useMemo`；確認 `.filter(isCardVisible)` 鏈也在 memo 內，不在就併入。

- [ ] **Step 2: 補充掃描（找新候選，僅在未達 5 處上限時處理）**

Run:
```bash
npx rg -n "JSON.parse" app/(tabs) src/components --type-add 'tsx:*.tsx' -t tsx
npx rg -n "\.map\(.*\.map\(" app src --type-add 'tsx:*.tsx' -t tsx
```
對命中處判斷是否 render 路徑重複計算；是 → 同樣以 useMemo 處理。

修補範本（統一這個形狀，不發明新模式）：

```tsx
const stats = useMemo(
  () => routines.map((r) => computeStats(r, exercises)),
  [routines, exercises],
);
```

- [ ] **Step 3: 型別檢查**

Run: `npx tsc --noEmit`
Expected: 無輸出

- [ ] **Step 4: 記錄結果到本檔附錄**

在本計畫文件末尾「附錄：性能掃描結果」填入：實際修了哪幾處（檔案:行號＋一句話）、放棄了哪些（原因）。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "perf: 熱點畫面渲染雜訊修補（useMemo/React.memo，N 處）"
```
（commit 訊息中的 `N` 換成實際修補處數，例如 `3 處`。）

---

### Task 9: 回歸驗收＋效能數據

**Files:**
- Modify: `docs/superpowers/specs/2026-06-12-app-optimization-design.md`（附錄基準表）

- [ ] **Step 1: 全量型別檢查與純函數斷言**

Run: `npx tsc --noEmit && npx -y tsx scripts/verify_meal_logic.ts`
Expected: tsc 無輸出；腳本 `ALL PASS (12 checks)`

- [ ] **Step 2: 回歸清單（裝置）**

| # | 項目 | 怎麼驗 |
|---|---|---|
| 1 | 冷啟動正常 | 殺掉 App 重開 ×3，進首頁無錯誤畫面、無主題閃爍 |
| 2 | onboarding 跳轉 | 清 App 資料或新裝置首啟 → 自動進 onboarding |
| 3 | 寵物訊息 | 首頁訊息卡當日有新訊息（背景生成補 refreshHealth） |
| 4 | 登入態 | 「我」分頁顯示登入 email（晚到自動補上）；feedback / delete-account 頁正常 |
| 5 | AI 單張 | 初判秒回填表 → 複核標示流轉正確 |
| 6 | AI 欄位保護 | 手動改過的欄位在「套用修正」後不被覆蓋 |
| 7 | AI 多張（同一餐／不同餐） | 兩種 mergeMode 各跑一次；multipleMeals 儲存筆數正確 |
| 8 | 低耗模式 | 單張無複核；多張序列執行 |
| 9 | 營養標／InBody | 各跑一次，行為同舊版 |
| 10 | 食物庫拍照新增 | `food-library/new` 單次判讀成功 |

- [ ] **Step 3: 效能數據記錄**

與 Task 1 Step 4 同一裝置同程序冷啟動 3 次，取 `[perf]` 中位數，把「改後」欄填入 spec 附錄；AI 首結果／複核耗時各記 3 次中位數。若 Task 1 當時沒拿到基準（無裝置），這裡改前/改後都由使用者協助量測，標注裝置型號。
標籤對應：改前 `startup:total-to-ready` ↔ 改後 `startup:critical`（皆為「放行前總耗時」）；改前 `startup:bootstrap` ↔ 改後 `startup:bootstrap`。
Expected: 放行前總耗時相比基準下降；AI 首結果耗時 ≈ 單次呼叫時間。

- [ ] **Step 4: AI 準度實測（需使用者）**

請使用者用自己的 API Key 實拍 3~5 張（便當、麵食、手搖飲），檢查：漏項是否減少、份量是否不再普遍高估、差異橫幅是否合理。結果記入 spec 附錄文字描述。

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-06-12-app-optimization-design.md docs/superpowers/plans/2026-06-12-app-optimization.md
git commit -m "docs: 優化驗收數據與回歸結果"
```

---

## 附錄：性能掃描結果（Task 8 填寫）

| 處理 | 位置 | 說明 |
|---|---|---|
| — | — | — |

## 附錄：超出上限的發現（後續建議）

| 位置 | 問題 | 建議 |
|---|---|---|
| — | — | — |
