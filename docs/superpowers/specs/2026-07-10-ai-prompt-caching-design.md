# AI 提示詞快取（三家）設計

日期：2026-07-10
狀態：已與使用者確認核可（主線批次 ②，讀碼後修正 Gemini 做法）
分支：feature/v1.0.2-libpct-eggs

## 背景與目標

食物判讀（`ocr.ts` → `callVisionJSON`）每次都送一段**靜態大提示**（`MEAL_PROMPT` / `VERIFY_PROMPT`，內含 `REF_TABLE` 台灣食物參考表，約 2k tokens）。兩段式判讀（初判＋複核）與多照片流程會重複送同一段。目標：讓三家供應商都用提示詞快取降低重複輸入 token 成本。

## 讀碼後的現實（重要修正）

`ai_provider.ts` 是多供應商 vision client（OpenAI-compatible / Anthropic / Gemini），使用者自帶 key + 選 model。三家快取機制不同：

| 供應商 | 機制 | 本輪做法 |
|---|---|---|
| **Anthropic** | 明確 `cache_control: ephemeral`（cached input ~90% off；min 1024 tok(Sonnet)/2048 tok(Haiku)，未達門檻自動忽略、不報錯） | **加 cache_control 於 system block**（真正的改動；隔離在 anthropic 路徑，爆炸半徑小） |
| **OpenAI** | **自動**快取 ≥1024 tok 前綴（50% off，零程式碼）；`prompt_cache_key` 可改善命中路由 | 靠自動快取；**加 `prompt_cache_key`，但僅限 `api.openai.com`**（MiniMax 走同函式，不可送未知參數） |
| **Gemini 2.5** | **隱式**快取預設開啟（自動）；明確 `cachedContents` 需建立資源 + TTL 生命週期 | **靠隱式快取**；明確快取**列後續**（見下） |

**為何 Gemini 不做明確快取（cachedContents）：** 提示約 2k tokens 貼近 Gemini 明確快取的最小門檻；每張照片是一次性 vision 呼叫，先建 cache 再用一次是**淨負**（要跨呼叫重用才划算，需持久化 cache name + TTL 過期重建）；且此生命週期在本開發環境**無法驗證**。Gemini 2.5 隱式快取已自動吃到大部分好處。故本輪 Gemini 靠隱式快取（確保靜態內容放 `systemInstruction`，已符合），明確 cachedContents 生命週期列後續（需裝置/帳單驗證的較大工程）。

## 範圍

**做**：
1. 純函數 `ai_cache.ts`：`buildAnthropicSystem`（system block + cache_control）、`openaiCacheParams`（僅 OpenAI 送 cache_key）+ 斷言。
2. `ai_provider.ts`：Anthropic `system` 改用 `buildAnthropicSystem`；OpenAI-compatible body 併入 `openaiCacheParams(baseUrl)`。
3. 文件記錄三家機制與預期（**節省幅度中等**，提示僅約 2k tokens；不誇大）。

**不做（列後續）**：
- Gemini 明確 `cachedContents` 生命週期（建立/重用/TTL/重建）——淨效益需跨呼叫重用、且本環境無法驗證。
- 動態縮短提示 / 拆靜態-動態段以擴大可快取前綴。
- 量測快取命中率（需 API 回應的 usage 欄位，裝置端）。

## 設計

### 純函數（`src/lib/ai_cache.ts`，零 import）

```ts
export type AnthropicSystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

/** Anthropic system 欄位：靜態提示標記 ephemeral 快取（未達 min-token 門檻時 API 自動忽略）。 */
export function buildAnthropicSystem(systemPrompt: string): AnthropicSystemBlock[] {
  return [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }];
}

export const OPENAI_BASE_URL = 'https://api.openai.com/v1';
export const MEAL_CACHE_KEY = 'kibo-meal-v1';

/** 僅對真正的 OpenAI 端點送 prompt_cache_key（MiniMax 等 OpenAI-compatible 不可收未知參數）。 */
export function openaiCacheParams(baseUrl: string): { prompt_cache_key?: string } {
  return baseUrl === OPENAI_BASE_URL ? { prompt_cache_key: MEAL_CACHE_KEY } : {};
}
```

### `ai_provider.ts` 接線

- `import { buildAnthropicSystem, openaiCacheParams } from './ai_cache';`
- `callAnthropic`：`system: p.systemPrompt` → `system: buildAnthropicSystem(p.systemPrompt)`（Anthropic API `system` 接受 string 或 content block 陣列）。
- `callOpenAICompatible`：其參數型別已含 `baseUrl: string`（line 241），`callVisionJSON` 呼叫時也已傳入。body 內併入 `...openaiCacheParams(p.baseUrl)` 即可（僅 `api.openai.com` 會得到 cache_key）。
- Gemini：不改程式（隱式快取），加一行註解說明。

### 影響面

- 所有走 Anthropic 的 vision 呼叫（食物初判/複核、營養標、InBody）都會帶 cache_control；提示較小者 API 自動忽略、無副作用。
- OpenAI 的 `prompt_cache_key` 僅加在 `api.openai.com`；MiniMax 走同函式但 `baseUrl` 不同 → 回 `{}`，不受影響。

## 檔案異動

| 動作 | 檔案 | 職責 |
|---|---|---|
| Create | `src/lib/ai_cache.ts` | 純函數 `buildAnthropicSystem`/`openaiCacheParams` + 常數 |
| Create | `scripts/verify_ai_cache.ts` | 斷言：Anthropic block 形狀含 cache_control；OpenAI 端點→帶 cache_key、MiniMax 端點→ `{}` |
| Modify | `src/lib/ai_provider.ts` | Anthropic system 改 block；OpenAI body 併 cache params；Gemini 註解 |

## 測試與驗收

| 項目 | 方式 |
|---|---|
| 純函數 | `npx -y tsx scripts/verify_ai_cache.ts`：`buildAnthropicSystem` 回單一 text block 帶 `cache_control.type==='ephemeral'`、text 原文保留；`openaiCacheParams('https://api.openai.com/v1')` 有 key、`openaiCacheParams('https://api.minimax.io/v1')`／其他 → `{}` |
| 型別 | `npx tsc --noEmit` 乾淨 |
| 裝置/帳單（需使用者） | Anthropic：連續多次判讀，觀察後續呼叫 usage 的 `cache_read_input_tokens` > 0、input 成本下降；OpenAI：usage 的 `cached_tokens` > 0；Gemini 2.5：usage 的 `cachedContentTokenCount`（隱式）。判讀結果與現況一致（快取不改語意） |

## 風險與對策

| 風險 | 對策 |
|---|---|
| OpenAI `prompt_cache_key` 破壞預設路徑（gpt-4o 是預設） | 僅送 `api.openai.com`；此為 OpenAI 文件化參數；MiniMax gated 掉 |
| Anthropic `system` 改陣列型別不合 | Anthropic API `system` 明確支援 content block 陣列；型別以 `any` body（fetch JSON.stringify）不受 SDK 型別限制 |
| 節省被高估 | 文件明列「提示僅約 2k tokens、節省中等」；不誇大 |
| Gemini 明確快取未做 = 未完成使用者選項 | 讀碼後判定明確快取此情境淨負且不可驗；隱式快取已自動生效；明確列後續並說明理由 |

## 後續建議（本輪不做）

- Gemini `cachedContents` 明確快取（跨呼叫重用 system instruction + TTL 生命週期）——需裝置/帳單驗證。
- 快取命中率量測（讀 usage 欄位）。
- 靜態/動態提示分段以擴大可快取前綴（把 palmRef 等動態段移到 user 訊息）。

## 驗收狀態（2026-07-10 實作完成）

**已自動驗證（本機）：**
- `npx -y tsx scripts/verify_ai_cache.ts` → ALL PASS (9 checks)：`buildAnthropicSystem`（單 text block、cache_control ephemeral、原文保留）、`openaiCacheParams`（OpenAI→帶 key、兩個 MiniMax→ `{}`）。
- `npx tsc --noEmit` 全綠。
- 逐 task 雙審 + 最終整功能審查（f044725..0d3e4c2）＝ **Ready to merge Yes**；**五家路徑零請求語意變更**（判讀輸出不變、不會 400）；gating 字面精確相符。

**實作摘要（2 commits，24df21a..0d3e4c2）：**
- `ai_cache.ts` 純函數 + 斷言；`ai_provider.ts` Anthropic `system` 改 cache_control block、OpenAI body 併 `prompt_cache_key`（僅 `api.openai.com`）、Gemini 隱式（僅註解）。

**待使用者在裝置/帳單驗收（本機無 API Key 無法驗快取實效）：**
- 連續多次判讀後，觀察 usage：Anthropic `cache_read_input_tokens` > 0、OpenAI `cached_tokens` > 0、Gemini 2.5 `cachedContentTokenCount` > 0；input 成本下降；判讀結果與現況一致。
- Anthropic prompt caching 於 `anthropic-version: 2023-06-01` 為 GA（免 beta header）；實測確認 cache_control 被接受。

**已知（列後續，非阻擋）：**
- Gemini 明確 `cachedContents` 生命週期（跨呼叫重用 + TTL）——本情境淨負且不可驗，延後。
- `ai_provider.ts` 的 OpenAI baseUrl 字面可改為 import `OPENAI_BASE_URL`（單一真相源；今相符，漂移則安全失效）。
- 提示僅約 2k tokens → **節省幅度中等**，非大幅。
