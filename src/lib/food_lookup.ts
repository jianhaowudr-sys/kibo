import AsyncStorage from '@react-native-async-storage/async-storage';
import * as repo from '@/db/repo';
import type { CustomFood } from '@/db/schema';
import type { MealReading } from '@/lib/ocr';
import { mapOffProductToReading } from '@/lib/food_lookup_core';

export type BarcodeLookupResult =
  | { tier: 'local'; barcode: string; food: CustomFood }
  | { tier: 'off'; barcode: string; reading: MealReading }
  | { tier: 'notfound'; barcode: string };

const OFF_KEY = '@kibo/barcode_off_lookup';

/** OFF 聯網查詢開關，預設 on。 */
export async function isOffLookupEnabled(): Promise<boolean> {
  try {
    const v = await AsyncStorage.getItem(OFF_KEY);
    return v !== '0';
  } catch {
    return true;
  }
}

export async function setOffLookupEnabled(v: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(OFF_KEY, v ? '1' : '0');
  } catch {
    // best-effort；寫入失敗時 UI 狀態可能與持久值暫時不同步
  }
}

/** GET OFF v2，keyless，6 秒 timeout；status===1 回 product，否則/任何錯誤回 null。 */
export async function fetchOpenFoodFacts(barcode: string): Promise<any | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=product_name,brands,serving_size,nutriments`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'Kibo/1.0 (fitness app)' } });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.status === 1 ? json.product : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 三層：本地快取 → （開關 on）OFF → notfound。 */
export async function lookupBarcode(userId: number, barcode: string): Promise<BarcodeLookupResult> {
  const local = await repo.findCustomFoodByBarcode(userId, barcode).catch(() => null);
  if (local) return { tier: 'local', barcode, food: local };
  if (await isOffLookupEnabled()) {
    const product = await fetchOpenFoodFacts(barcode);
    const reading = mapOffProductToReading(product);
    if (reading) return { tier: 'off', barcode, reading };
  }
  return { tier: 'notfound', barcode };
}
