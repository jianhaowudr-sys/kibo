import AsyncStorage from '@react-native-async-storage/async-storage';

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'minimax' | 'minimax-cn';

export type AIModelId =
  | 'openai-gpt-4o'
  | 'openai-gpt-4o-mini'
  | 'anthropic-sonnet-4-5'
  | 'anthropic-haiku-4-5'
  | 'gemini-2-5-pro'
  | 'gemini-2-5-flash'
  | 'minimax-m2-5'
  | 'minimax-cn-m2-5';

export type ModelInfo = {
  id: AIModelId;
  provider: AIProvider;
  apiModelId: string;
  displayName: string;
  tier: 'economy' | 'balanced' | 'premium';
  estCostPerImage: string;
  estCostNtd: string;
  visionQuality: '普通' | '好' | '極佳';
  notes: string;
};

export const MODELS: ModelInfo[] = [
  {
    id: 'gemini-2-5-flash',
    provider: 'gemini',
    apiModelId: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    tier: 'economy',
    estCostPerImage: '$0.0005',
    estCostNtd: '~0.015 NTD',
    visionQuality: '好',
    notes: '🪙 最便宜！Google 免費額度大，適合高頻拍照',
  },
  {
    id: 'openai-gpt-4o-mini',
    provider: 'openai',
    apiModelId: 'gpt-4o-mini',
    displayName: 'OpenAI GPT-4o mini',
    tier: 'economy',
    estCostPerImage: '$0.001',
    estCostNtd: '~0.03 NTD',
    visionQuality: '普通',
    notes: '💨 快速便宜，適合輕度使用',
  },
  {
    id: 'anthropic-haiku-4-5',
    provider: 'anthropic',
    apiModelId: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    tier: 'economy',
    estCostPerImage: '$0.003',
    estCostNtd: '~0.09 NTD',
    visionQuality: '好',
    notes: '⚡ 中文描述細膩，Anthropic 最便宜款',
  },
  {
    id: 'gemini-2-5-pro',
    provider: 'gemini',
    apiModelId: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    tier: 'balanced',
    estCostPerImage: '$0.005',
    estCostNtd: '~0.15 NTD',
    visionQuality: '極佳',
    notes: '🎯 CP 值高，準度接近頂級',
  },
  {
    id: 'openai-gpt-4o',
    provider: 'openai',
    apiModelId: 'gpt-4o',
    displayName: 'OpenAI GPT-4o',
    tier: 'premium',
    estCostPerImage: '$0.01',
    estCostNtd: '~0.3 NTD',
    visionQuality: '極佳',
    notes: '🏆 目前使用中的預設，中文穩定',
  },
  {
    id: 'anthropic-sonnet-4-5',
    provider: 'anthropic',
    apiModelId: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    tier: 'premium',
    estCostPerImage: '$0.015',
    estCostNtd: '~0.45 NTD',
    visionQuality: '極佳',
    notes: '🧠 最新 Sonnet 4.6，推理與中文極強',
  },
  {
    id: 'minimax-m2-5',
    provider: 'minimax',
    apiModelId: 'MiniMax-M2.5',
    displayName: 'MiniMax M2.5（國際）',
    tier: 'balanced',
    estCostPerImage: '$0.003',
    estCostNtd: '~0.09 NTD',
    visionQuality: '普通',
    notes: '❌ 目前 API 不支援看圖（只會回文字推理），請用其他模型',
  },
  {
    id: 'minimax-cn-m2-5',
    provider: 'minimax-cn',
    apiModelId: 'MiniMax-M2.5',
    displayName: 'MiniMax M2.5（中國）',
    tier: 'balanced',
    estCostPerImage: '$0.003',
    estCostNtd: '~0.09 NTD',
    visionQuality: '普通',
    notes: '❌ 同上，api.minimaxi.com 也不支援看圖',
  },
];

export const PROVIDER_LABEL: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google Gemini',
  minimax: 'MiniMax（國際）',
  'minimax-cn': 'MiniMax（中國）',
};

export const PROVIDER_SIGNUP_URL: Record<AIProvider, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  gemini: 'https://aistudio.google.com/apikey',
  minimax: 'https://platform.minimax.io/user-center/basic-information/interface-key',
  'minimax-cn': 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
};

const KEY_PROVIDER_KEYS: Record<AIProvider, string> = {
  openai: '@kibo/openai_api_key',
  anthropic: '@kibo/anthropic_api_key',
  gemini: '@kibo/gemini_api_key',
  minimax: '@kibo/minimax_api_key',
  'minimax-cn': '@kibo/minimax_cn_api_key',
};

const KEY_ACTIVE_MODEL = '@kibo/active_ai_model';
const DEFAULT_MODEL: AIModelId = 'openai-gpt-4o';

export async function getProviderKey(provider: AIProvider): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY_PROVIDER_KEYS[provider]);
  } catch {
    return null;
  }
}

export async function setProviderKey(provider: AIProvider, key: string): Promise<void> {
  if (!key) {
    await AsyncStorage.removeItem(KEY_PROVIDER_KEYS[provider]);
  } else {
    await AsyncStorage.setItem(KEY_PROVIDER_KEYS[provider], key);
  }
}

export async function hasProviderKey(provider: AIProvider): Promise<boolean> {
  const k = await getProviderKey(provider);
  return !!(k && k.trim().length > 10);
}

export async function getActiveModelId(): Promise<AIModelId> {
  try {
    const v = await AsyncStorage.getItem(KEY_ACTIVE_MODEL);
    if (v && MODELS.some((m) => m.id === v)) return v as AIModelId;
  } catch {}
  return DEFAULT_MODEL;
}

export async function setActiveModelId(id: AIModelId): Promise<void> {
  await AsyncStorage.setItem(KEY_ACTIVE_MODEL, id);
}

export async function getActiveModel(): Promise<ModelInfo> {
  const id = await getActiveModelId();
  return MODELS.find((m) => m.id === id) ?? MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}

export async function hasActiveProviderKey(): Promise<{ has: boolean; providerLabel: string; modelName: string }> {
  const model = await getActiveModel();
  const has = await hasProviderKey(model.provider);
  return { has, providerLabel: PROVIDER_LABEL[model.provider], modelName: model.displayName };
}

export type VisionCallParams = {
  systemPrompt: string;
  userPrompt: string;
  base64: string;
  temperature?: number;
  maxTokens?: number;
  overrideModelId?: AIModelId;
};

export async function callVisionJSON(params: VisionCallParams): Promise<string> {
  const model = params.overrideModelId
    ? MODELS.find((m) => m.id === params.overrideModelId)!
    : await getActiveModel();
  const apiKey = await getProviderKey(model.provider);
  if (!apiKey) {
    throw new Error(`請先在「我 → 設定」填入 ${PROVIDER_LABEL[model.provider]} API Key`);
  }

  const temperature = params.temperature ?? 0.1;
  const maxTokens = params.maxTokens ?? 1200;

  if (model.provider === 'openai') {
    return callOpenAICompatible({
      baseUrl: 'https://api.openai.com/v1',
      apiKey, model: model.apiModelId, ...params, temperature, maxTokens,
      detail: model.apiModelId.includes('mini') ? 'auto' : 'high',
    });
  }
  if (model.provider === 'anthropic') {
    return callAnthropic({ apiKey, model: model.apiModelId, ...params, temperature, maxTokens });
  }
  if (model.provider === 'gemini') {
    return callGemini({ apiKey, model: model.apiModelId, ...params, temperature, maxTokens });
  }
  if (model.provider === 'minimax') {
    return callOpenAICompatible({
      baseUrl: 'https://api.minimax.io/v1',
      apiKey, model: model.apiModelId, ...params, temperature, maxTokens,
      detail: 'high',
    });
  }
  if (model.provider === 'minimax-cn') {
    return callOpenAICompatible({
      baseUrl: 'https://api.minimaxi.com/v1',
      apiKey, model: model.apiModelId, ...params, temperature, maxTokens,
      detail: 'high',
    });
  }
  throw new Error(`不支援的 provider: ${model.provider}`);
}

async function callOpenAICompatible(p: {
  baseUrl: string; apiKey: string; model: string; systemPrompt: string; userPrompt: string;
  base64: string; temperature: number; maxTokens: number; detail: 'auto' | 'high';
}): Promise<string> {
  const res = await fetch(`${p.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${p.apiKey}`,
    },
    body: JSON.stringify({
      model: p.model,
      temperature: p.temperature,
      max_tokens: p.maxTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: p.systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: p.userPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${p.base64}`,
                detail: p.detail,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API 錯誤 (${res.status}) @ ${p.baseUrl}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(p: {
  apiKey: string; model: string; systemPrompt: string; userPrompt: string;
  base64: string; temperature: number; maxTokens: number;
}): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': p.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: p.model,
      max_tokens: p.maxTokens,
      temperature: p.temperature,
      system: p.systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: p.base64,
              },
            },
            {
              type: 'text',
              text: `${p.userPrompt}\n\n務必只回傳嚴格 JSON，不要 markdown fence、不要解釋文字。`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Anthropic API 錯誤 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const block = (json.content ?? []).find((b: any) => b.type === 'text');
  return block?.text ?? '';
}

async function callGemini(p: {
  apiKey: string; model: string; systemPrompt: string; userPrompt: string;
  base64: string; temperature: number; maxTokens: number;
}): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(p.model)}:generateContent?key=${encodeURIComponent(p.apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: p.systemPrompt }] },
      contents: [
        {
          role: 'user',
          parts: [
            { text: p.userPrompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: p.base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: p.temperature,
        maxOutputTokens: p.maxTokens,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API 錯誤 (${res.status}): ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return text;
}
