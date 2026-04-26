import { getMemoryHint } from './memory';
import { callVisionJSON } from './ai_provider';

export type MealReading = {
  title?: string;
  items: { name: string; portion?: string; calories: number; protein: number; carb: number; fat: number }[];
  totalCalories: number;
  totalProtein: number;
  totalCarb: number;
  totalFat: number;
};

const MEAL_PROMPT = `你是台灣食物營養估算助手。使用者在台灣，會上傳一餐照片（外食、便當、自煮、小吃都有）。

## 判讀流程（內部請依此順序思考，不輸出 reasoning）：

第一步「辨識」：先仔細看照片，列出你看到的所有食物 / 飲料 / 醬料 / 配菜。注意容器大小（飯碗、便當盒、一般盤子直徑約 20cm）作為參照物。別漏了：
- 醬汁（滷肉飯的油脂、酸菜、辣油）
- 配菜（滷蛋、豆乾、酸菜、花生、醃菜）
- 隱藏油脂（三層肉、肥肉、炸物外皮）
- 飲料（含糖飲料、湯底）

第二步「估份量」：根據容器/參照物估每樣的公克 / 份數。台灣一碗白飯 ≈ 200-250g、一個便當盒 ≈ 700-800g 總重。

第三步「估營養素」：用下方台灣常見菜參考表，依實際份量 scale。

## 台灣常見菜與標準熱量參考（per 一般份量）：
- 白飯一碗 (200g) 280 kcal，P:6 C:62 F:0
- 滷肉飯一碗：600 kcal（P:15 C:85 F:20，含肥肉+滷汁油脂）
- 雞腿便當：900 kcal（P:40 C:100 F:35，含三樣配菜）
- 排骨便當：850 kcal
- 牛肉麵大碗：750 kcal（P:35 C:95 F:20）
- 陽春麵 + 小菜：500 kcal
- 鹽酥雞一份：500 kcal（超高油 F:35）
- 雞排一塊：450 kcal（F:25）
- 肉粽一顆：450 kcal
- 飯糰（超商）：300 kcal
- 蛋餅（加蛋）：350 kcal
- 小籠包 8 顆：560 kcal
- 炒麵一盤：600 kcal
- 蚵仔煎：500 kcal
- 擔仔麵：300 kcal
- 滷味一份（中）：400 kcal
- 麥當勞大麥克：550 kcal，套餐 1200 kcal
- 珍珠奶茶 700ml 全糖：550 kcal
- 含糖拿鐵 大杯：250 kcal
- 美式咖啡黑：5 kcal
- 水餃 10 顆：450 kcal
- 燙青菜：50 kcal
- 荷包蛋：90 kcal
- 滷蛋：80 kcal
- 豆干一塊：35 kcal

## 原則：
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

export type MealParseOptions = {
  extraHint?: string;
  economy?: boolean;
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

async function singleRead(base64: string, options: InternalOptions): Promise<MealReading> {
  const parts: string[] = ['請依照系統指示的三步思考流程（辨識 → 估份量 → 估營養素），判讀這一餐。'];
  const timeHint = mealTimeHint(options.capturedAt);
  if (timeHint) parts.push(timeHint);
  if (options.memoryHint) parts.push(options.memoryHint);
  if (options.palmRef) {
    parts.push(
      `## 比例尺參照
使用者的手掌張開時：長 ${options.palmRef.lengthCm} cm（中指尖到手腕）、寬 ${options.palmRef.widthCm} cm（四指根橫寬不含拇指）。
若照片中出現平放且五指張開的手掌，請優先用此 calibrate 食物的真實尺寸再估份量；若手掌姿勢非五指張開或不平放（如握拳、側立、捏東西），可忽略此參照。

⚠️ 重要校正：你過往對台灣食物份量普遍高估 20~40%（特別是便當、麵食、油脂類），這次有比例尺請重新檢視，不要套用「便當盒一定 700~800g」這類預設先驗——以實際照片中食物相對於手掌的尺寸為準。`,
    );
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

  const cleaned = raw.trim().replace(/^```json\s*/, '').replace(/```\s*$/, '');

  if (/^<think>/i.test(cleaned) || cleaned.includes('I cannot see') || cleaned.includes('cannot read')) {
    throw new Error('此模型不支援看圖，請換 OpenAI / Claude / Gemini');
  }

  const parsed = JSON.parse(cleaned);
  if (parsed.error) throw new Error(parsed.error);
  return parsed as MealReading;
}

function isSane(r: MealReading): boolean {
  if (!r.items || r.items.length === 0) return false;
  const cal = r.totalCalories || 0;
  if (cal <= 0 || cal > 6000) return false;
  const sum = r.items.reduce((s, x) => s + (x.calories || 0), 0);
  if (sum > 0 && Math.abs(cal - sum) / Math.max(cal, sum) > 0.5) return false;
  return true;
}

function median(nums: number[]): number {
  const arr = [...nums].sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return 0;
  if (n % 2) return arr[(n - 1) / 2];
  return Math.round((arr[n / 2 - 1] + arr[n / 2]) / 2);
}

function mergeReadings(readings: MealReading[]): MealReading {
  if (readings.length === 1) return readings[0];

  const itemCounts = readings.map((r) => r.items?.length ?? 0);
  const frameIdx = itemCounts.indexOf(Math.max(...itemCounts));
  const frame = readings[frameIdx];

  const mergedItems = (frame.items ?? []).map((frameIt) => {
    const same: typeof frameIt[] = [frameIt];
    for (let i = 0; i < readings.length; i++) {
      if (i === frameIdx) continue;
      const match = readings[i].items?.find(
        (x) => x.name.trim().toLowerCase() === frameIt.name.trim().toLowerCase(),
      );
      if (match) same.push(match);
    }
    return {
      name: frameIt.name,
      portion: frameIt.portion,
      calories: median(same.map((x) => x.calories)),
      protein: median(same.map((x) => x.protein)),
      carb: median(same.map((x) => x.carb)),
      fat: median(same.map((x) => x.fat)),
    };
  });

  return {
    title: frame.title,
    items: mergedItems,
    totalCalories: median(readings.map((r) => r.totalCalories || 0)),
    totalProtein: median(readings.map((r) => r.totalProtein || 0)),
    totalCarb: median(readings.map((r) => r.totalCarb || 0)),
    totalFat: median(readings.map((r) => r.totalFat || 0)),
  };
}

/**
 * 讀多張照片，回傳每張獨立的 MealReading 結果。
 * @param photos base64 陣列
 * @param options 同 readMealFromBase64；每張可獨立 temperature
 * @param sequential 低負擔模式下序列執行，預設 false（並行）
 */
export async function readMealsFromMultiplePhotos(
  photos: string[],
  options: MealParseOptions = {},
  sequential: boolean = false,
): Promise<MealReading[]> {
  if (sequential) {
    const out: MealReading[] = [];
    for (const p of photos) {
      try {
        const r = await readMealFromBase64(p, options);
        out.push(r);
      } catch (e) {
        console.warn('Photo OCR failed', e);
      }
    }
    return out;
  }
  const results = await Promise.allSettled(photos.map((p) => readMealFromBase64(p, options)));
  return results
    .filter((r): r is PromiseFulfilledResult<MealReading> => r.status === 'fulfilled')
    .map((r) => r.value);
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

export async function readMealFromBase64(base64: string, options: MealParseOptions = {}): Promise<MealReading> {
  const memoryHint = await getMemoryHint(10);

  const runs = options.economy ? 1 : 3;
  const seeds: number[] = runs === 1 ? [0.1] : [0.1, 0.3, 0.2];

  let results: MealReading[] = [];
  const errors: string[] = [];

  await Promise.all(
    seeds.map(async (temp) => {
      try {
        const r = await singleRead(base64, { ...options, memoryHint, temperature: temp });
        if (isSane(r)) results.push(r);
      } catch (e: any) {
        errors.push(e?.message ?? String(e));
      }
    }),
  );

  if (results.length === 0 && errors.length > 0) {
    try {
      const retry = await singleRead(base64, { ...options, memoryHint, temperature: 0.4 });
      if (isSane(retry)) results.push(retry);
    } catch (e: any) {
      throw new Error(errors[0] || e?.message || 'AI 判讀失敗');
    }
  }

  if (results.length === 0) {
    throw new Error(errors[0] || 'AI 判讀結果不合理，請再試一次');
  }

  const merged = mergeReadings(results);
  return sanityCheck(merged);
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
