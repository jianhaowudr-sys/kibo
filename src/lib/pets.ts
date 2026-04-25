import { PET_SPECIES, EGG_CONFIG } from '@/data/exercises';
import type { EggType } from '@/db/schema';

export function pickPetForEgg(type: EggType) {
  const list = PET_SPECIES[type];
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

export function eggProgress(current: number, required: number): number {
  return Math.min(1, current / required);
}

export function eggStage(current: number, required: number): number {
  const pct = eggProgress(current, required);
  if (pct < 0.33) return 0;
  if (pct < 0.66) return 1;
  if (pct < 1) return 2;
  return 3;
}

export const EGG_STAGE_LABEL = ['安靜的蛋', '蛋殼有裂痕', '快要孵化了', '孵化中'];

export function eggConfigFor(type: EggType) {
  return EGG_CONFIG[type];
}
