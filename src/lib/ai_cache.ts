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
