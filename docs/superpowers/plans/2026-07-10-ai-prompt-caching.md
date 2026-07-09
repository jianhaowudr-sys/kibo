# AI 提示詞快取（三家）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 三家供應商都用提示詞快取降低重複靜態提示的 token 成本（Anthropic 明確 cache_control、OpenAI 自動 + cache_key、Gemini 隱式）。

**Architecture:** 純函數 `ai_cache.ts`（零 import）產生 Anthropic system block 與 OpenAI cache 參數，斷言驗形狀/gating。`ai_provider.ts` 的兩個 caller 併入。Gemini 靠 2.5 隱式快取、不改程式。

**Tech Stack:** TypeScript strict、fetch、`npx -y tsx` 斷言、`npx tsc --noEmit`。

## Global Constraints

- TypeScript strict；每 task 結束 `npx tsc --noEmit` 乾淨（OOM 時 `node --max-old-space-size=2048 ./node_modules/typescript/bin/tsc --noEmit`）。
- `ai_cache.ts` 維持零 runtime import。
- `prompt_cache_key` **僅**可加在 `baseUrl === 'https://api.openai.com/v1'`；MiniMax/其他 OpenAI-compatible 端點不得帶（回 `{}`）。
- 快取不得改變判讀語意（同輸入同輸出）。

---

### Task 1: ai_cache.ts 純函數 + 斷言

**Files:**
- Create: `src/lib/ai_cache.ts`
- Create: `scripts/verify_ai_cache.ts`

**Interfaces:**
- Produces:
  - `type AnthropicSystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }`
  - `buildAnthropicSystem(systemPrompt: string): AnthropicSystemBlock[]`
  - `OPENAI_BASE_URL = 'https://api.openai.com/v1'`、`MEAL_CACHE_KEY = 'kibo-meal-v1'`
  - `openaiCacheParams(baseUrl: string): { prompt_cache_key?: string }`

- [ ] **Step 1: 寫 `src/lib/ai_cache.ts`**

```ts
// AI 提示詞快取純函數（零 import）。見 scripts/verify_ai_cache.ts。

export type AnthropicSystemBlock = { type: 'text'; text: string; cache_control?: { type: 'ephemeral' } };

/** Anthropic system 欄位：靜態提示標記 ephemeral 快取（未達 min-token 門檻時 API 自動忽略、不報錯）。 */
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

- [ ] **Step 2: 寫 `scripts/verify_ai_cache.ts`**

```ts
import { buildAnthropicSystem, openaiCacheParams, OPENAI_BASE_URL, MEAL_CACHE_KEY } from '../src/lib/ai_cache';

let pass = 0;
function ok(cond: boolean, msg: string) { if (!cond) throw new Error('FAIL: ' + msg); pass++; }

// ---- buildAnthropicSystem ----
{
  const s = buildAnthropicSystem('HELLO PROMPT');
  ok(Array.isArray(s) && s.length === 1, 'single-block array');
  ok(s[0].type === 'text', "block type 'text'");
  ok(s[0].text === 'HELLO PROMPT', 'text preserved verbatim');
  ok(s[0].cache_control?.type === 'ephemeral', 'cache_control ephemeral');
}

// ---- openaiCacheParams gating ----
ok(openaiCacheParams(OPENAI_BASE_URL).prompt_cache_key === MEAL_CACHE_KEY, 'openai endpoint → cache key');
ok(Object.keys(openaiCacheParams(OPENAI_BASE_URL)).length === 1, 'openai → exactly one key');
ok(openaiCacheParams('https://api.minimax.io/v1').prompt_cache_key === undefined, 'minimax intl → no key');
ok(openaiCacheParams('https://api.minimaxi.com/v1').prompt_cache_key === undefined, 'minimax cn → no key');
ok(JSON.stringify(openaiCacheParams('https://api.minimax.io/v1')) === '{}', 'non-openai → {}');

console.log(`ALL PASS (${pass} checks)`);
```

- [ ] **Step 3:** Run `npx -y tsx scripts/verify_ai_cache.ts` → expect `ALL PASS (9 checks)`
- [ ] **Step 4:** Run `npx tsc --noEmit` → clean
- [ ] **Step 5: Commit**

```bash
git add src/lib/ai_cache.ts scripts/verify_ai_cache.ts
git commit -m "feat(ai): ai_cache 純函數（Anthropic system block / OpenAI cache key）+ 斷言（主線批次②）"
```

---

### Task 2: ai_provider.ts 接線快取

**Files:**
- Modify: `src/lib/ai_provider.ts`

**Interfaces:**
- Consumes: `buildAnthropicSystem`, `openaiCacheParams` from `./ai_cache`（Task 1）。
- Produces: 無新對外介面（`callVisionJSON` 等簽名不變）。

**Context:** `callAnthropic` 目前 `system: p.systemPrompt`（字串）。`callOpenAICompatible` 的參數型別已含 `baseUrl: string`，body 是 `JSON.stringify({...})`。`callGemini` 不改。

- [ ] **Step 1: 加 import（第 1 行 AsyncStorage import 之後）**

```ts
import { buildAnthropicSystem, openaiCacheParams } from './ai_cache';
```

- [ ] **Step 2: `callAnthropic` 的 body 內，`system` 改用 block 陣列**

把：
```ts
      system: p.systemPrompt,
```
改成：
```ts
      system: buildAnthropicSystem(p.systemPrompt),
```

- [ ] **Step 3: `callOpenAICompatible` 的 body，`model` 之後併入 cache 參數**

把 body 開頭：
```ts
    body: JSON.stringify({
      model: p.model,
      temperature: p.temperature,
```
改成：
```ts
    body: JSON.stringify({
      model: p.model,
      ...openaiCacheParams(p.baseUrl),
      temperature: p.temperature,
```

- [ ] **Step 4: `callGemini` 加一行說明註解（不改行為）**

在 `callGemini` 函式的 `const url = ...` 上方加：
```ts
  // Gemini 2.5 隱式快取預設開啟：靜態 systemInstruction 會自動被快取，無需明確 cachedContents。
```

- [ ] **Step 5: 型別檢查** — Run `npx tsc --noEmit` → 乾淨
- [ ] **Step 6: 全套斷言回歸** — Run `npx -y tsx scripts/verify_ai_cache.ts` → `ALL PASS (9 checks)`
- [ ] **Step 7: Commit**

```bash
git add src/lib/ai_provider.ts
git commit -m "feat(ai): 接線提示詞快取（Anthropic cache_control + OpenAI cache_key gated；Gemini 隱式）（主線批次②）"
```

---

## Self-Review

**Spec coverage:**
- `ai_cache.ts` 純函數 + 斷言 → Task 1 ✓
- Anthropic system block cache_control → Task 2 Step 2 ✓
- OpenAI cache_key gated to api.openai.com → Task 1 `openaiCacheParams` + Task 2 Step 3 ✓
- Gemini 隱式（不改程式 + 註解）→ Task 2 Step 4 ✓
- Gemini 明確快取列後續 → spec 明列，計畫無 task（符合預期）✓

**Placeholder scan:** 無 TBD；每 code step 完整。

**Type consistency:** `buildAnthropicSystem(string): AnthropicSystemBlock[]`、`openaiCacheParams(string): { prompt_cache_key?: string }`、常數 `OPENAI_BASE_URL`/`MEAL_CACHE_KEY` 於 Task 1 定義；Task 2 依相同簽名使用。`openaiCacheParams(p.baseUrl)` 的 `p.baseUrl` 存在於 `callOpenAICompatible` 參數型別。

**驗收：** Task 1/2 斷言 9；tsc 乾淨；快取實效由裝置/帳單驗（見 spec）。
