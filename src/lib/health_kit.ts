import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { nutritionSamples, waterSample, weightSample, HK_ID, type HKQuantityInput } from './health_core';

// 本地最小介面（避免 static import；裝置 build 時**務必**對照已安裝的 @kingstinct/react-native-healthkit v14 實際 API 調整
// 此 adapter 的函數名/簽名——v14 為 Nitro 版，名稱可能與此不同；不符時只會靜默 no-op（graceful），不會 crash）。
type HealthKitModule = {
  isHealthDataAvailable: () => boolean;
  requestAuthorization: (share: string[], read: string[]) => Promise<boolean>;
  saveQuantitySample: (identifier: string, unit: string, value: number, options?: unknown) => Promise<boolean>;
  saveWorkoutSample: (activityType: number, quantities: unknown[], start: Date, end: Date, options?: unknown) => Promise<boolean>;
  queryStatisticsForQuantity: (identifier: string, unit: string, from: Date, to?: Date) => Promise<{ sumQuantity?: { quantity: number } } | null>;
};

const HEALTHKIT_MODULE = '@kingstinct/react-native-healthkit';
let HK: HealthKitModule | null = null;
try { HK = require(HEALTHKIT_MODULE) as HealthKitModule; } catch { HK = null; }

const SYNC_KEY = '@kibo/health_sync_enabled';
// workout 需獨立的 HKWorkoutType 授權；漏掉會讓 saveWorkoutSample 在裝置上靜默 no-op。
const SHARE = [HK_ID.dietaryEnergy, HK_ID.protein, HK_ID.carb, HK_ID.fat, HK_ID.water, HK_ID.bodyMass, HK_ID.workout];
const READ = [HK_ID.stepCount, HK_ID.activeEnergy];

export function isHealthAvailable(): boolean {
  try { return Platform.OS === 'ios' && !!HK && HK.isHealthDataAvailable(); } catch { return false; }
}

export async function getHealthSyncEnabled(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(SYNC_KEY)) === '1'; } catch { return false; }
}
export async function setHealthSyncEnabled(on: boolean): Promise<void> {
  try { await AsyncStorage.setItem(SYNC_KEY, on ? '1' : '0'); } catch {}
}

export async function requestHealthPermissions(): Promise<boolean> {
  if (!isHealthAvailable() || !HK) return false;
  try { return await HK.requestAuthorization(SHARE, READ); }
  catch (e) { console.warn('[health] auth failed', e); return false; }
}

async function saveSamples(samples: HKQuantityInput[]): Promise<void> {
  if (!HK) return;
  for (const s of samples) {
    try { await HK.saveQuantitySample(s.identifier, s.unit, s.value); }
    catch (e) { console.warn('[health] save failed', s.identifier, e); }
  }
}

async function guardedWrite(fn: () => Promise<void>): Promise<void> {
  if (!isHealthAvailable()) return;
  if (!(await getHealthSyncEnabled())) return;
  try { await fn(); } catch (e) { console.warn('[health] write failed', e); }
}

export async function writeNutritionToHealth(m: { calories?: number; protein?: number; carb?: number; fat?: number }): Promise<void> {
  await guardedWrite(() => saveSamples(nutritionSamples(m)));
}
export async function writeWaterToHealth(ml: number): Promise<void> {
  await guardedWrite(async () => { const s = waterSample(ml); if (s) await saveSamples([s]); });
}
export async function writeWeightToHealth(kg: number): Promise<void> {
  await guardedWrite(async () => { const s = weightSample(kg); if (s) await saveSamples([s]); });
}
export async function writeWorkoutToHealth(w: { start: Date; end: Date; kcal?: number }): Promise<void> {
  await guardedWrite(async () => {
    if (!HK) return;
    // activityType 3000 = HKWorkoutActivityTypeOther；裝置 build 對照調整
    await HK.saveWorkoutSample(3000, [], w.start, w.end);
  });
}

async function readTodaySum(identifier: string, unit: string): Promise<number> {
  if (!isHealthAvailable() || !HK) return 0;
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const stats = await HK.queryStatisticsForQuantity(identifier, unit, start, new Date());
    return Math.round(stats?.sumQuantity?.quantity ?? 0);
  } catch (e) { console.warn('[health] read failed', identifier, e); return 0; }
}
export async function readTodaySteps(): Promise<number> { return readTodaySum(HK_ID.stepCount, 'count'); }
export async function readTodayActiveEnergy(): Promise<number> { return readTodaySum(HK_ID.activeEnergy, 'kcal'); }
