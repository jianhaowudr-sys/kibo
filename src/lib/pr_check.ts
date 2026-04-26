/**
 * PR (Personal Record) 偵測（plan v4 §v4-8）。
 * 給定 exerciseId + 當前 set，比對歷史最佳是否打破紀錄。
 */

import * as repo from '@/db/repo';

export type PRSet = { weight?: number | null; reps?: number | null; durationSec?: number | null; distanceM?: number | null };

export type PRType = 'volume' | 'duration' | 'distance' | null;

/**
 * 檢查當前 set 是否打破歷史最佳。
 *
 * 規則：
 *  - 重訓（unit reps）：volume = weight × reps，比歷史 max
 *  - 時間型（unit seconds）：durationSec 比歷史 max
 *  - 距離型（unit meters）：distanceM 比歷史 max
 */
export async function checkPR(
  userId: number,
  exerciseId: number,
  current: PRSet,
): Promise<PRType> {
  try {
    const history = await repo.listSetsForExercise?.(userId, exerciseId, 200);
    if (!history || history.length === 0) {
      // 第一次訓練該動作，不算 PR（避免每次都跳）
      return null;
    }
    const completed = history.filter((s: any) => s.completed);
    if (completed.length === 0) return null;

    const curVolume = (current.weight ?? 0) * (current.reps ?? 0);
    if (curVolume > 0) {
      const maxVolume = Math.max(...completed.map((s: any) => (s.weight ?? 0) * (s.reps ?? 0)));
      if (curVolume > maxVolume) return 'volume';
    }

    const curDur = current.durationSec ?? 0;
    if (curDur > 0) {
      const maxDur = Math.max(...completed.map((s: any) => s.durationSec ?? 0));
      if (curDur > maxDur) return 'duration';
    }

    const curDist = current.distanceM ?? 0;
    if (curDist > 0) {
      const maxDist = Math.max(...completed.map((s: any) => s.distanceM ?? 0));
      if (curDist > maxDist) return 'distance';
    }

    return null;
  } catch (e) {
    console.warn('PR check failed', e);
    return null;
  }
}
