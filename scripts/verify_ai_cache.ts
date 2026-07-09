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
