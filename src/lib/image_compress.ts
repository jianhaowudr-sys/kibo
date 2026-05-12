import * as ImageManipulator from 'expo-image-manipulator';

/**
 * 壓縮預設：
 * - 'food' 餐照／自製食物：1280×0.75（食物特徵不靠小字，1.2MP 是三家 API 甜蜜點）
 * - 'label' 營養標籤 / InBody 報表：2048×0.85（小字 OCR 需要更多細節）
 *
 * Gemini server 端會自動把超過 3072 的邊縮小，所以「不壓縮」沒幫助，
 * 反而浪費 bandwidth、增加 token 成本、提高 timeout 機率。
 */
export type CompressPreset = 'food' | 'label';

const PRESETS: Record<CompressPreset, { maxWidth: number; quality: number }> = {
  food: { maxWidth: 1280, quality: 0.75 },
  label: { maxWidth: 2048, quality: 0.85 },
};

export async function compressForVision(uri: string, preset: CompressPreset = 'food'): Promise<string> {
  const { maxWidth, quality } = PRESETS[preset];
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxWidth } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return result.base64 ?? '';
}
