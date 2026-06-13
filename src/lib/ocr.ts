import { getMemoryHint } from './memory';
import { callVisionJSON } from './ai_provider';
import { MEAL_PROMPT, VERIFY_PROMPT, buildPalmRefHint } from './meal_prompts';

export type MealReading = {
  title?: string;
  items: { name: string; portion?: string; calories: number; protein: number; carb: number; fat: number }[];
  totalCalories: number;
  totalProtein: number;
  totalCarb: number;
  totalFat: number;
};

export type MealParseOptions = {
  extraHint?: string;
  /** 跳過背景複核（低耗模式或呼叫端只要單次結果時用） */
  skipVerify?: boolean;
  capturedAt?: Date | number;
  /** 手掌參照（plan v6）：照片中若有平放手掌，AI 用此 calibrate 真實尺寸 */
  palmRef?: { lengthCm: number; widthCm: number };
};

function mealTimeHint(ts?: Date | number): string {
  if (ts == null) return '';
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  const h = d.getHours();
  let tag = '點心時段';
  if (h >= 5 && h < 10) tag = '早餐時段';
  else if (h >= 10 && h < 14) tag = '午餐時段';
  else if (h >= 17 && h < 21) tag = '晚餐時段';
  else if (h >= 21 || h < 5) tag = '消夜時段';
  return `拍攝時間：${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(h).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} (${tag})`;
}

function sanityCheck(r: MealReading): MealReading {
  const fixedItems = (r.items ?? []).map((it) => {
    const cal = Math.max(0, Math.min(3000, Math.round(it.calories || 0)));
    const p = Math.max(0, Math.round(it.protein || 0));
    const c = Math.max(0, Math.round(it.carb || 0));
    const f = Math.max(0, Math.round(it.fat || 0));
    const calcCal = p * 4 + c * 4 + f * 9;
    const useCalc = cal === 0 || (calcCal > 0 && Math.abs(cal - calcCal) / Math.max(cal, calcCal) > 0.35);
    return {
      ...it,
      calories: useCalc && calcCal > 0 ? calcCal : cal,
      protein: p,
      carb: c,
      fat: f,
    };
  });

  const sumCal = fixedItems.reduce((s, x) => s + x.calories, 0);
  const sumP = fixedItems.reduce((s, x) => s + x.protein, 0);
  const sumC = fixedItems.reduce((s, x) => s + x.carb, 0);
  const sumF = fixedItems.reduce((s, x) => s + x.fat, 0);

  const totalCalcCal = sumP * 4 + sumC * 4 + sumF * 9;
  const reportedTotal = Math.round(r.totalCalories || 0);
  let finalTotal = reportedTotal;
  if (reportedTotal === 0 && sumCal > 0) finalTotal = sumCal;
  else if (totalCalcCal > 0 && Math.abs(reportedTotal - totalCalcCal) / Math.max(reportedTotal, totalCalcCal) > 0.3) {
    finalTotal = sumCal > 0 ? sumCal : totalCalcCal;
  }

  return {
    ...r,
    items: fixedItems,
    totalCalories: finalTotal,
    totalProtein: Math.round(r.totalProtein || sumP),
    totalCarb: Math.round(r.totalCarb || sumC),
    totalFat: Math.round(r.totalFat || sumF),
  };
}

type InternalOptions = MealParseOptions & {
  memoryHint?: string | null;
  temperature?: number;
};

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

async function singleRead(base64: string, options: InternalOptions): Promise<MealReading> {
  const parts: string[] = ['請依照系統指示的四步判讀流程（辨識 → 估份量 → 估營養素 → 自我檢查），判讀這一餐。'];
  const timeHint = mealTimeHint(options.capturedAt);
  if (timeHint) parts.push(timeHint);
  if (options.memoryHint) parts.push(options.memoryHint);
  if (options.palmRef) {
    parts.push(buildPalmRefHint(options.palmRef));
  }
  const hint = options.extraHint?.trim();
  if (hint) parts.push(`使用者補充：${hint}`);
  const userText = parts.join('\n');

  const raw = await callVisionJSON({
    systemPrompt: MEAL_PROMPT,
    userPrompt: userText,
    base64,
    temperature: options.temperature ?? 0.1,
    maxTokens: 2500,
  });

  return parseMealJson(raw);
}

function isSane(r: MealReading): boolean {
  if (!r.items || r.items.length === 0) return false;
  const cal = r.totalCalories || 0;
  if (cal <= 0 || cal > 6000) return false;
  const sum = r.items.reduce((s, x) => s + (x.calories || 0), 0);
  if (sum > 0 && Math.abs(cal - sum) / Math.max(cal, sum) > 0.5) return false;
  return true;
}

export type MergeMode = 'sameMeal' | 'multipleMeals';

/**
 * 把多張照片的判讀結果合併成單一 meal。
 *
 * mode = 'sameMeal'（同一餐多角度）：
 *  - totals 取所有照片的平均（避免 double-count 同樣食物）
 *  - items 取資訊最豐富那張（item 數量最多）
 *
 * mode = 'multipleMeals'（不同餐合在一起算一個總量）：
 *  - totals 直接相加
 *  - items 同名相加、不同名累加
 *  注意：呼叫端若要存成 N 筆 meal，應該不要呼叫此函數，直接 forEach 即可。
 */
export function mergeMealReadings(readings: MealReading[], mode: MergeMode = 'sameMeal'): MealReading {
  if (readings.length === 0) {
    return { items: [], totalCalories: 0, totalProtein: 0, totalCarb: 0, totalFat: 0 };
  }
  if (readings.length === 1) return readings[0];

  if (mode === 'sameMeal') {
    const avg = (key: keyof MealReading) =>
      Math.round(readings.reduce((s, r) => s + ((r[key] as number) ?? 0), 0) / readings.length);
    const richest = [...readings].sort((a, b) => (b.items?.length ?? 0) - (a.items?.length ?? 0))[0];
    return {
      title: readings.find((r) => r.title)?.title,
      items: richest.items ?? [],
      totalCalories: avg('totalCalories'),
      totalProtein: avg('totalProtein'),
      totalCarb: avg('totalCarb'),
      totalFat: avg('totalFat'),
    };
  }

  // multipleMeals fallback：相加
  const itemMap = new Map<string, MealReading['items'][number]>();
  for (const r of readings) {
    for (const it of r.items ?? []) {
      const key = it.name?.trim() || '未知';
      const existing = itemMap.get(key);
      if (existing) {
        existing.calories += it.calories || 0;
        existing.protein += it.protein || 0;
        existing.carb += it.carb || 0;
        existing.fat += it.fat || 0;
        if (!existing.portion && it.portion) existing.portion = it.portion;
      } else {
        itemMap.set(key, { ...it });
      }
    }
  }
  const items = Array.from(itemMap.values());
  return {
    title: readings.find((r) => r.title)?.title,
    items,
    totalCalories: items.reduce((s, x) => s + (x.calories || 0), 0),
    totalProtein: items.reduce((s, x) => s + (x.protein || 0), 0),
    totalCarb: items.reduce((s, x) => s + (x.carb || 0), 0),
    totalFat: items.reduce((s, x) => s + (x.fat || 0), 0),
  };
}

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

// ===== 營養標籤識別（plan v7）=====

const NUTRITION_LABEL_PROMPT = `你是營養標籤判讀助手。使用者上傳的是包裝食品的「營養標示」表格照片（小方框內含每份/每100g 的數據）。

判讀流程：
1. 先確認照片是否為營養標籤。如果不是，回傳 {"error":"不是營養標籤"}。
2. 找標示的「**每份**」量或「每包」量（不要用每 100g，除非沒寫每份）。
3. 讀取該欄的：熱量 (kcal)、蛋白質 (g)、碳水化合物 (g)、脂肪 (g)。糖、鈉、飽和脂肪可忽略。
4. 找產品名稱（包裝上的中文/英文名）。
5. 找一份的描述（如「30g」「1 包」「200ml」等）。

請嚴格只回 JSON：
{
  "title": "產品名稱",
  "items": [{
    "name": "產品名稱",
    "portion": "每份 30g",
    "calories": 數字,
    "protein": 數字,
    "carb": 數字,
    "fat": 數字
  }],
  "totalCalories": 數字,
  "totalProtein": 數字,
  "totalCarb": 數字,
  "totalFat": 數字
}

注意：營養標籤通常很小且字體模糊，請仔細看清楚每個數字。如果某欄位看不清楚，留 0 不要猜。`;

export async function readNutritionLabelFromBase64(base64: string): Promise<MealReading> {
  const raw = await callVisionJSON({
    systemPrompt: NUTRITION_LABEL_PROMPT,
    userPrompt: '請判讀這張營養標籤照片，回傳每份的營養素 JSON。',
    base64,
    temperature: 0,  // 標籤是確定數字，不要 hallucinate
    maxTokens: 800,
  });
  const cleaned = raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');
  let parsed: any;
  try { parsed = JSON.parse(cleaned); } catch {
    throw new Error('AI 回傳格式錯誤，無法解析');
  }
  if (parsed.error) throw new Error(parsed.error);
  return {
    title: parsed.title,
    items: parsed.items ?? [],
    totalCalories: parsed.totalCalories ?? 0,
    totalProtein: parsed.totalProtein ?? 0,
    totalCarb: parsed.totalCarb ?? 0,
    totalFat: parsed.totalFat ?? 0,
  };
}

export type InBodyReading = {
  measuredAt?: string;
  weightKg?: number;
  bodyFatPct?: number;
  skeletalMuscleKg?: number;
  muscleMassKg?: number;
  proteinKg?: number;
  bodyFatKg?: number;
  mineralKg?: number;
  bodyWaterKg?: number;
  bmr?: number;
  visceralFatLevel?: number;
  bodyScore?: number;
};

const SYSTEM_PROMPT = `你是 InBody 體組成報告的判讀助手。
使用者會上傳一張 InBody（或類似體組成分析儀）的報告截圖。
請仔細閱讀圖片內的所有數字，擷取以下欄位並用 JSON 回傳。

欄位（全部可選，抓不到就不要放那 key）：
- measuredAt: 測量日期，格式 YYYY-MM-DD（若圖上有印測量日期）
- weightKg: 體重 (kg)
- bodyFatPct: 體脂肪率 (%)，PBF / Percent Body Fat
- skeletalMuscleKg: 骨骼肌量 (kg)，SMM / Skeletal Muscle Mass
- muscleMassKg: 肌肉量 (kg)，Muscle Mass（若只有 SMM 一個值，放進 skeletalMuscleKg 即可）
- proteinKg: 蛋白質量 (kg)，Protein
- bodyFatKg: 體脂肪量 (kg)，Body Fat Mass / BFM
- mineralKg: 骨鹽量 / 無機鹽 (kg)，Mineral
- bodyWaterKg: 身體水分 (kg)，Total Body Water / TBW
- bmr: 基礎代謝率 (kcal)，BMR / Basal Metabolic Rate
- visceralFatLevel: 內臟脂肪等級（整數 1-20）
- bodyScore: InBody 分數 / Body Score / Fitness Score（整數 0-100）

嚴格只輸出 JSON（不要 markdown code fence、不要其他文字）。
範例：{"weightKg":70.5,"bodyFatPct":18.2,"skeletalMuscleKg":32.8,"proteinKg":11.3}
如果圖片不是 InBody 或無法判讀，回傳 {"error":"無法判讀"}`;

export async function readInBodyFromBase64(base64: string): Promise<InBodyReading> {
  const raw = await callVisionJSON({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: '請判讀這張 InBody 報告。',
    base64,
    temperature: 0,
    maxTokens: 2000,
  });
  const cleaned = raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');

  if (/^<think>/i.test(cleaned) || cleaned.includes('I cannot see') || cleaned.includes('cannot read')) {
    throw new Error('此模型目前不支援看圖（只回了文字推理）。請換 OpenAI / Claude / Gemini 試試');
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object' && 'error' in parsed && parsed.error) {
      throw new Error(String(parsed.error));
    }
    return parsed as InBodyReading;
  } catch (e: any) {
    if (e?.message?.includes('無法') || e?.message?.includes('不支援')) throw e;
    throw new Error(`判讀回傳格式錯誤（可能 token 太短被截斷或模型不支援 JSON 輸出）：\n${raw.slice(0, 150)}`);
  }
}
