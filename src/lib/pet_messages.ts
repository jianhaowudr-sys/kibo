/**
 * 寵物訊息生成（plan v2 §4.2 Hook 1）。純 template + 行為觸發，不用 LLM。
 * 每天清晨 06:00 由 useAppStore.refreshHealth 後 + bootstrap 時觸發。
 */

import type { Pet, Workout, Meal, WaterLog, SleepLog, PetMessageCategory } from '@/db/schema';
import * as healthRepo from '@/db/health_repo';
import * as repo from '@/db/repo';

export type PetMood = 'energetic' | 'satisfied' | 'happy' | 'concerned' | 'missing' | 'worried' | 'neutral';

export type PetActivity7d = {
  workoutDays: number;
  mealDays: number;
  waterDailyAvgMl: number;
  sleepHoursAvg: number;
  daysSinceLastOpen: number;
};

const TEMPLATES: Record<PetMessageCategory, ((data: any) => string)[]> = {
  greeting: [
    () => '早安，新的一天～',
    () => '今天也要好好過喔',
    (d: any) => d.petName ? `${d.petName} 在等你回家` : '',
  ],
  concern: [
    (d: any) => d.daysSinceLastOpen >= 3 ? `好久不見，已經 ${d.daysSinceLastOpen} 天了 🥺` : '',
    (d: any) => d.waterDailyAvgMl < 1200 ? '最近喝水有點少，要多補水' : '',
    (d: any) => d.sleepHoursAvg < 5 ? '你最近睡得不夠，要不要早點睡？' : '',
    (d: any) => d.workoutDays === 0 ? '這週還沒運動，今天動一動吧！' : '',
  ],
  celebration: [
    (d: any) => d.workoutDays >= 5 ? `這週運動 ${d.workoutDays} 天，太強了！` : '',
    (d: any) => d.streak && d.streak > 0 && d.streak % 7 === 0 ? `連續 ${d.streak} 天 🔥 我們是搭擋` : '',
    (d: any) => d.streak && d.streak === 30 ? '我們一起堅持 30 天了 🎉 紀念日 ✨' : '',
  ],
  reminder: [
    () => '別忘了今天的喝水目標',
    () => '記得幫我加營養（飲食記錄）',
  ],
};

export function computePetMood(activity: PetActivity7d): PetMood {
  if (activity.daysSinceLastOpen >= 3) return 'missing';
  if (activity.workoutDays >= 5) return 'energetic';
  if (activity.mealDays >= 5) return 'satisfied';
  if (activity.sleepHoursAvg < 5 || activity.waterDailyAvgMl < 1000) return 'worried';
  if (activity.workoutDays === 0) return 'concerned';
  return 'happy';
}

export async function gatherActivity(userId: number, petId: number | null): Promise<PetActivity7d> {
  const now = Date.now();
  const since = now - 7 * 86400_000;

  const recent = await repo.listWorkouts(userId, 50);
  const workoutDays = new Set(
    recent
      .filter((w: any) => +new Date(w.startedAt) >= since)
      .map((w: any) => new Date(w.startedAt).toDateString())
  ).size;

  // 簡化：用今日餐數（之後有 listMealsBetween 再 swap）
  const todayKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const todayMeals = await repo.listMealsByDate(userId, todayKey).catch(() => []);
  const mealDays = todayMeals.length > 0 ? 1 : 0;

  const water = await healthRepo.listWaterBetween(userId, since, now);
  const totalMl = water.reduce((s, w) => s + w.amountMl, 0);
  const waterDailyAvgMl = Math.round(totalMl / 7);

  const sleeps = await healthRepo.listSleepRecent(userId, 7);
  const sleepHoursAvg = sleeps.length > 0
    ? sleeps.reduce((s, x) => s + x.durationMin, 0) / sleeps.length / 60
    : 0;

  // daysSinceLastOpen — 簡化：用最近 workoutDays 是否近 3 天
  const lastWorkoutTs = recent[0] ? +new Date(recent[0].startedAt) : 0;
  const lastWaterTs = water[0] ? +water[0].loggedAt : 0;
  const lastActiveTs = Math.max(lastWorkoutTs, lastWaterTs);
  const daysSinceLastOpen = lastActiveTs > 0
    ? Math.floor((now - lastActiveTs) / 86400_000)
    : 99;

  return { workoutDays, mealDays, waterDailyAvgMl, sleepHoursAvg, daysSinceLastOpen };
}

export async function generateDailyMessages(userId: number, pet: Pet | null, streak: number): Promise<number[]> {
  const activity = await gatherActivity(userId, pet?.id ?? null);
  const data = { ...activity, streak, petName: pet?.name };

  const cats: PetMessageCategory[] = ['greeting', 'concern', 'celebration', 'reminder'];
  const insertedIds: number[] = [];
  const today = new Date().toDateString();

  // 一天最多 2 則
  let count = 0;
  for (const cat of cats) {
    if (count >= 2) break;
    const tmpls = TEMPLATES[cat];
    for (const tmpl of tmpls) {
      const text = tmpl(data).trim();
      if (!text) continue;
      // 去重：同 category 同 text 同天不重複
      const existing = await healthRepo.listPetMessages(userId, 50);
      const dupe = existing.find((m) =>
        m.category === cat && m.text === text &&
        new Date(m.generatedAt).toDateString() === today
      );
      if (dupe) continue;
      const id = await healthRepo.addPetMessage({
        userId, petId: pet?.id ?? null,
        generatedAt: new Date(),
        category: cat, text, read: 0,
        triggerData: JSON.stringify(data),
      });
      insertedIds.push(id);
      count++;
      if (count >= 2) break;
    }
  }
  return insertedIds;
}
