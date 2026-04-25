import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MealItem } from '@/db/schema';

const KEY = '@kibo/meal_memory/v1';

type Entry = {
  name: string;
  calories: number;
  protein: number;
  carb: number;
  fat: number;
  count: number;
  lastUpdated: number;
};

type MemoryMap = Record<string, Entry>;

async function load(): Promise<MemoryMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as MemoryMap;
  } catch {
    return {};
  }
}

async function save(m: MemoryMap): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(m));
  } catch {}
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function mergeAvg(prev: Entry, it: MealItem): Entry {
  const n = prev.count + 1;
  const w = 1 / n;
  return {
    name: prev.name,
    calories: Math.round(prev.calories * (1 - w) + it.calories * w),
    protein: Math.round(prev.protein * (1 - w) + it.protein * w),
    carb: Math.round(prev.carb * (1 - w) + it.carb * w),
    fat: Math.round(prev.fat * (1 - w) + it.fat * w),
    count: n,
    lastUpdated: Date.now(),
  };
}

export async function recordMealCorrection(original: MealItem[] | null, final: MealItem[]): Promise<void> {
  if (final.length === 0) return;
  const origMap = new Map<string, MealItem>();
  for (const it of original ?? []) origMap.set(normName(it.name), it);

  const m = await load();
  for (const it of final) {
    const key = normName(it.name);
    if (!key) continue;

    const orig = origMap.get(key);
    const unchanged = orig
      && Math.abs(orig.calories - it.calories) < 10
      && Math.abs(orig.protein - it.protein) < 2
      && Math.abs(orig.carb - it.carb) < 2
      && Math.abs(orig.fat - it.fat) < 2;

    if (orig && unchanged) {
      const prev = m[key];
      if (prev) {
        m[key] = { ...prev, count: prev.count + 1, lastUpdated: Date.now() };
      }
      continue;
    }

    if (m[key]) {
      m[key] = mergeAvg(m[key], it);
    } else {
      m[key] = {
        name: it.name.trim(),
        calories: Math.round(it.calories),
        protein: Math.round(it.protein),
        carb: Math.round(it.carb),
        fat: Math.round(it.fat),
        count: 1,
        lastUpdated: Date.now(),
      };
    }
  }
  await save(m);
}

export async function getMemoryHint(limit = 10): Promise<string | null> {
  const m = await load();
  const entries = Object.values(m)
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count || b.lastUpdated - a.lastUpdated)
    .slice(0, limit);

  if (entries.length === 0) return null;

  const lines = entries.map(
    (e) => `- ${e.name}: ${e.calories}kcal (P:${e.protein} C:${e.carb} F:${e.fat})`,
  );
  return `使用者過去記錄這些食物的平均值（優先錨定這些數字）：\n${lines.join('\n')}`;
}

export async function clearMealMemory(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export async function getMemoryStats(): Promise<{ count: number; totalLogs: number; topNames: string[] }> {
  const m = await load();
  const entries = Object.values(m);
  const totalLogs = entries.reduce((s, e) => s + e.count, 0);
  const topNames = entries
    .sort((a, b) => b.count - a.count || b.lastUpdated - a.lastUpdated)
    .slice(0, 5)
    .map((e) => `${e.name}×${e.count}`);
  return { count: entries.length, totalLogs, topNames };
}
