import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlannedSet } from '@/stores/useAppStore';

const KEY = '@kibo/workout_session';

/**
 * 訓練 session 中「只存在於記憶體」的部分。
 * currentWorkoutId / activeSets / workoutStartedAt 都能從 DB 推導（workouts + workout_sets），
 * 但這四項不行——app 被系統回收就消失，是「訓練到一半全沒了」的主因。
 */
export type PersistedSession = {
  workoutId: number;
  routineExerciseIds: number[];
  selectedExerciseId: number | null;
  currentRoutineId: number | null;
  plannedSetsByExercise: Record<number, PlannedSet[]>;
};

export async function saveSession(s: PersistedSession): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // 持久化失敗不該影響訓練本身
  }
}

/** 讀回 session；workoutId 不符（已是另一場訓練）→ 視為無效。 */
export async function loadSession(expectWorkoutId: number): Promise<PersistedSession | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as PersistedSession;
    if (!s || s.workoutId !== expectWorkoutId) return null;
    return s;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {}
}
