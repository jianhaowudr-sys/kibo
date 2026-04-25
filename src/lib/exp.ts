import type { Exercise } from '@/db/schema';

export type SetInput = {
  weight?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
};

export function calcSetExp(exercise: Exercise, set: SetInput): number {
  const base = exercise.expPerUnit;
  switch (exercise.unit) {
    case 'reps': {
      const reps = set.reps ?? 0;
      const weight = set.weight ?? 0;
      const intensity = weight > 0 ? 1 + weight / 80 : 1;
      return Math.round(reps * base * intensity);
    }
    case 'seconds': {
      const s = set.durationSec ?? 0;
      return Math.round(s * base);
    }
    case 'minutes': {
      const min = (set.durationSec ?? 0) / 60;
      return Math.round(min * base);
    }
    case 'meters': {
      const m = set.distanceM ?? 0;
      return Math.round((m / 100) * base);
    }
    default:
      return 0;
  }
}

export function calcWorkoutExp(items: { exercise: Exercise; set: SetInput }[]): number {
  return items.reduce((sum, { exercise, set }) => sum + calcSetExp(exercise, set), 0);
}

export function calcVolume(set: SetInput): number {
  const weight = set.weight ?? 0;
  const reps = set.reps ?? 0;
  return weight * reps;
}

export function levelFromExp(exp: number): { level: number; current: number; required: number } {
  let level = 1;
  let required = 100;
  let remaining = exp;

  while (remaining >= required) {
    remaining -= required;
    level += 1;
    required = Math.round(required * 1.3);
  }

  return { level, current: remaining, required };
}

export function petExpForNextStage(stage: number): number {
  const base = 500;
  return Math.round(base * Math.pow(1.5, stage - 1));
}
