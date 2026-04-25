import { create } from 'zustand';
import type { User, Exercise, Workout, Egg, Pet, EggType, Routine, RoutineExercise, WorkoutSet, BodyMeasurement, Meal, MealType } from '@/db/schema';
import type { ThemeMode } from '@/lib/theme';
import type { Session } from '@supabase/supabase-js';

export type PlannedSet = {
  key: string;
  weight?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
};
import * as repo from '@/db/repo';
import { PET_SPECIES } from '@/data/exercises';
import { calcSetExp, calcVolume } from '@/lib/exp';

let _syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
import { todayKey } from '@/lib/date';

export type ActiveSet = {
  id?: number;
  exercise: Exercise;
  orderIdx: number;
  weight?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  exp: number;
};

type State = {
  user: User | null;
  exercises: Exercise[];
  activeEgg: Egg | null;
  pets: Pet[];
  recentWorkouts: Workout[];
  weeklyExp: Record<string, number>;
  workoutDates: string[];
  weeklyCount: number;
  routines: Routine[];
  bodyMeasurements: BodyMeasurement[];
  todayMeals: Meal[];
  todayNutrition: { calories: number; protein: number; carb: number; fat: number; count: number };
  themeMode: ThemeMode;
  authSession: Session | null;
  authLoading: boolean;

  currentWorkoutId: number | null;
  activeSets: ActiveSet[];
  workoutStartedAt: number | null;
  selectedExerciseId: number | null;
  routineQueue: Exercise[];
  lastSetByExercise: Record<number, WorkoutSet | null>;
  recentSetsByExercise: Record<number, WorkoutSet[]>;
  plannedSetsByExercise: Record<number, PlannedSet[]>;
  tempSelectedExerciseIds: number[];
  currentRoutineId: number | null;

  pendingHatch: { eggId: number; petName: string; emoji: string; type: EggType } | null;
};

type Actions = {
  bootstrap: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshEgg: () => Promise<void>;
  refreshPets: () => Promise<void>;
  refreshHistory: () => Promise<void>;
  updateProfile: (patch: Partial<User>) => Promise<void>;

  startWorkout: () => Promise<number>;
  deleteWorkoutAndRefresh: (workoutId: number) => Promise<void>;
  addActiveSet: (exercise: Exercise, data: Partial<ActiveSet>) => Promise<void>;
  removeActiveSet: (id: number) => Promise<void>;
  finishWorkout: (note?: string) => Promise<{ workoutId: number; totalExp: number; hatched: boolean } | null>;
  cancelWorkout: () => Promise<void>;

  setSelectedExerciseId: (id: number | null) => void;
  fetchLastSetFor: (exerciseId: number) => Promise<void>;
  fetchRecentSetsFor: (exerciseId: number, limit?: number) => Promise<void>;

  setPlannedSets: (exerciseId: number, sets: PlannedSet[]) => void;
  addPlannedSet: (exerciseId: number) => void;
  updatePlannedSet: (exerciseId: number, key: string, patch: Partial<PlannedSet>) => void;
  removePlannedSet: (exerciseId: number, key: string) => void;
  commitPlannedSet: (exerciseId: number, key: string) => Promise<void>;
  uncommitSet: (setId: number) => Promise<void>;

  refreshExercises: () => Promise<void>;
  createCustomExercise: (data: { name: string; part: string; equipment?: string; unit: 'reps' | 'seconds' | 'minutes' | 'meters'; muscleGroup?: string }) => Promise<number>;
  deleteCustomExercise: (id: number) => Promise<void>;

  refreshRoutines: () => Promise<void>;
  refreshBodyMeasurements: () => Promise<void>;
  addBodyMeasurement: (data: Omit<import('@/db/schema').NewBodyMeasurement, 'id' | 'createdAt' | 'userId'> & { measuredAt: Date | number }) => Promise<void>;
  deleteBodyMeasurement: (id: number) => Promise<void>;

  refreshTodayMeals: () => Promise<void>;
  addMeal: (data: Omit<import('@/db/schema').NewMeal, 'id' | 'createdAt' | 'userId'> & { loggedAt: Date | number }) => Promise<number>;
  deleteMeal: (id: number) => Promise<void>;

  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loadThemeMode: () => Promise<void>;

  signUpEmail: (email: string, password: string) => Promise<{ needConfirm: boolean }>;
  signInEmail: (email: string, password: string) => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
  resendConfirmEmail: (email: string) => Promise<void>;
  syncCloud: () => Promise<{ pushed: number; pulled: number }>;
  enqueueSync: () => void;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncedAt: number | null;
  logout: () => Promise<void>;
  loadAuthSession: () => Promise<void>;
  setAuthSession: (session: Session | null) => void;
  createRoutineWithExercises: (data: { name: string; emoji: string; note?: string; exerciseIds: number[] }) => Promise<number>;
  deleteRoutine: (id: number) => Promise<void>;
  duplicateRoutine: (id: number) => Promise<number>;
  loadRoutineAsQueue: (routineId: number) => Promise<void>;
  clearRoutineQueue: () => void;
  popRoutineQueue: () => Exercise | null;
  pickFromQueue: (exerciseId: number) => Exercise | null;
  addExercisesToQueue: (exerciseIds: number[]) => void;
  removeFromQueue: (exerciseId: number) => void;
  saveAsNewRoutine: (name: string, emoji?: string) => Promise<number>;

  setTempSelectedIds: (ids: number[]) => void;
  toggleTempSelectedId: (id: number) => void;
  clearTempSelectedIds: () => void;

  saveRoutineSnapshot: (routineId: number) => Promise<void>;
  overwriteRoutineWithActiveSets: (routineId: number) => Promise<void>;

  setPendingHatch: (p: State['pendingHatch']) => void;
  confirmHatch: (petName: string) => Promise<void>;
};

export const useAppStore = create<State & Actions>()((set, get) => ({
  user: null,
  exercises: [],
  activeEgg: null,
  pets: [],
  recentWorkouts: [],
  weeklyExp: {},
  workoutDates: [],
  weeklyCount: 0,
  routines: [],
  bodyMeasurements: [],
  todayMeals: [],
  todayNutrition: { calories: 0, protein: 0, carb: 0, fat: 0, count: 0 },
  themeMode: 'dark' as ThemeMode,
  authSession: null,
  authLoading: false,
  syncStatus: 'idle',
  lastSyncedAt: null,
  currentWorkoutId: null,
  activeSets: [],
  workoutStartedAt: null,
  selectedExerciseId: null,
  routineQueue: [],
  lastSetByExercise: {},
  recentSetsByExercise: {},
  plannedSetsByExercise: {},
  tempSelectedExerciseIds: [],
  currentRoutineId: null,
  pendingHatch: null,

  bootstrap: async () => {
    const user = await repo.getCurrentUser();
    const exercises = await repo.listExercises();
    const activeEgg = user ? await repo.getActiveEgg(user.id) : null;
    const pets = user ? await repo.listPets(user.id) : [];
    const recentWorkouts = user ? await repo.listWorkouts(user.id, 20) : [];
    const routines = user ? await repo.listRoutines(user.id) : [];
    const weeklyCount = user ? await repo.weeklyWorkoutCount(user.id) : 0;
    set({ user, exercises, activeEgg, pets, recentWorkouts, routines, weeklyCount });
  },

  refreshUser: async () => {
    const user = await repo.getCurrentUser();
    set({ user });
  },

  refreshEgg: async () => {
    const { user } = get();
    if (!user) return;
    const activeEgg = await repo.getActiveEgg(user.id);
    set({ activeEgg });
  },

  refreshPets: async () => {
    const { user } = get();
    if (!user) return;
    const pets = await repo.listPets(user.id);
    set({ pets });
  },

  refreshHistory: async () => {
    const { user } = get();
    if (!user) return;
    const recentWorkouts = await repo.listWorkouts(user.id, 20);
    const { last7Days } = await import('@/lib/date');
    const keys = last7Days();
    const weeklyExp = await repo.weeklyExpByDay(user.id, keys);
    const workoutDates = await repo.recentWorkoutDates(user.id, 60);
    const weeklyCount = await repo.weeklyWorkoutCount(user.id);
    set({ recentWorkouts, weeklyExp, workoutDates, weeklyCount });
  },

  updateProfile: async (patch) => {
    const { user } = get();
    if (!user) return;
    await repo.updateUser(user.id, patch);
    const fresh = await repo.getCurrentUser();
    set({ user: fresh });
  },

  startWorkout: async () => {
    const { user } = get();
    if (!user) throw new Error('no user');
    const id = await repo.createWorkout(user.id);
    set({ currentWorkoutId: id, activeSets: [], workoutStartedAt: Date.now() });
    return id;
  },

  deleteWorkoutAndRefresh: async (workoutId) => {
    const { user } = get();
    if (!user) return;
    await repo.deleteWorkoutAndRecalc(user.id, workoutId);
    await get().refreshUser();
    await get().refreshHistory();
  },

  addActiveSet: async (exercise, data) => {
    const { currentWorkoutId, activeSets } = get();
    if (!currentWorkoutId) return;
    const orderIdx = activeSets.length;
    const setInput = {
      weight: data.weight ?? null,
      reps: data.reps ?? null,
      durationSec: data.durationSec ?? null,
      distanceM: data.distanceM ?? null,
    };
    const exp = calcSetExp(exercise, setInput);
    const id = await repo.addSet({
      workoutId: currentWorkoutId,
      exerciseId: exercise.id,
      orderIdx,
      ...setInput,
      exp,
    });
    set({
      activeSets: [...activeSets, { id, exercise, orderIdx, ...setInput, exp }],
    });
  },

  removeActiveSet: async (id) => {
    await repo.deleteSet(id);
    set({ activeSets: get().activeSets.filter(s => s.id !== id) });
  },

  finishWorkout: async () => {
    const { currentWorkoutId, activeSets, workoutStartedAt, user, activeEgg } = get();
    if (!currentWorkoutId || !user) return null;
    if (activeSets.length === 0) {
      await repo.cancelWorkout(currentWorkoutId);
      set({ currentWorkoutId: null, activeSets: [], workoutStartedAt: null });
      return null;
    }

    const totalExp = activeSets.reduce((s, v) => s + v.exp, 0);
    const totalVolume = activeSets.reduce((s, v) => s + calcVolume(v), 0);
    const durationSec = workoutStartedAt ? Math.floor((Date.now() - workoutStartedAt) / 1000) : 0;

    await repo.finishWorkout(currentWorkoutId, { totalExp, totalVolume, durationSec });

    const today = todayKey();
    let streak = user.streak;
    if (user.lastWorkoutDate !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      streak = user.lastWorkoutDate === yesterday ? streak + 1 : 1;
    }

    await repo.updateUser(user.id, {
      totalWorkouts: user.totalWorkouts + 1,
      totalExp: user.totalExp + totalExp,
      streak,
      lastWorkoutDate: today,
    });

    let hatched = false;
    if (activeEgg) {
      await repo.addExpToEgg(activeEgg.id, totalExp);
      const newCurrent = activeEgg.currentExp + totalExp;
      if (newCurrent >= activeEgg.requiredExp) {
        const species = PET_SPECIES[activeEgg.type as EggType];
        const pick = species[Math.floor(Math.random() * species.length)];
        hatched = true;
        set({
          pendingHatch: {
            eggId: activeEgg.id,
            petName: pick.name,
            emoji: pick.emoji,
            type: activeEgg.type as EggType,
          },
        });
      } else {
        for (const pet of get().pets) {
          if (pet.type === activeEgg.type) {
            await repo.addExpToPet(pet.id, Math.round(totalExp * 0.2));
          }
        }
      }
    }

    set({ currentWorkoutId: null, activeSets: [], workoutStartedAt: null });
    await get().refreshUser();
    await get().refreshEgg();
    await get().refreshPets();
    await get().refreshHistory();
    get().enqueueSync?.();

    return { workoutId: currentWorkoutId, totalExp, hatched };
  },

  cancelWorkout: async () => {
    const { currentWorkoutId } = get();
    if (currentWorkoutId) {
      await repo.cancelWorkout(currentWorkoutId);
    }
    set({ currentWorkoutId: null, activeSets: [], workoutStartedAt: null });
  },

  setSelectedExerciseId: (id) => set({ selectedExerciseId: id }),

  fetchLastSetFor: async (exerciseId) => {
    const { user, lastSetByExercise } = get();
    if (!user) return;
    if (lastSetByExercise[exerciseId] !== undefined) return;
    const lastSet = await repo.getLastSetForExercise(user.id, exerciseId);
    set({ lastSetByExercise: { ...get().lastSetByExercise, [exerciseId]: lastSet } });
  },

  fetchRecentSetsFor: async (exerciseId, limit = 5) => {
    const { user } = get();
    if (!user) return;
    const rows = await repo.listSetsForExercise(user.id, exerciseId, limit);
    set({ recentSetsByExercise: { ...get().recentSetsByExercise, [exerciseId]: rows } });
  },

  setPlannedSets: (exerciseId, sets) => {
    set({ plannedSetsByExercise: { ...get().plannedSetsByExercise, [exerciseId]: sets } });
  },

  addPlannedSet: (exerciseId) => {
    const current = get().plannedSetsByExercise[exerciseId] ?? [];
    const lastSet = get().lastSetByExercise[exerciseId];
    const lastPlanned = current[current.length - 1];
    const nextKey = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const seed: PlannedSet = {
      key: nextKey,
      weight: lastPlanned?.weight ?? lastSet?.weight ?? null,
      reps: lastPlanned?.reps ?? lastSet?.reps ?? null,
      durationSec: lastPlanned?.durationSec ?? lastSet?.durationSec ?? null,
      distanceM: lastPlanned?.distanceM ?? lastSet?.distanceM ?? null,
    };
    set({
      plannedSetsByExercise: {
        ...get().plannedSetsByExercise,
        [exerciseId]: [...current, seed],
      },
    });
  },

  updatePlannedSet: (exerciseId, key, patch) => {
    const current = get().plannedSetsByExercise[exerciseId] ?? [];
    set({
      plannedSetsByExercise: {
        ...get().plannedSetsByExercise,
        [exerciseId]: current.map((p) => (p.key === key ? { ...p, ...patch } : p)),
      },
    });
  },

  removePlannedSet: (exerciseId, key) => {
    const current = get().plannedSetsByExercise[exerciseId] ?? [];
    set({
      plannedSetsByExercise: {
        ...get().plannedSetsByExercise,
        [exerciseId]: current.filter((p) => p.key !== key),
      },
    });
  },

  commitPlannedSet: async (exerciseId, key) => {
    const planned = (get().plannedSetsByExercise[exerciseId] ?? []).find((p) => p.key === key);
    if (!planned) return;
    const ex = get().exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    await get().addActiveSet(ex, {
      weight: planned.weight ?? null,
      reps: planned.reps ?? null,
      durationSec: planned.durationSec ?? null,
      distanceM: planned.distanceM ?? null,
    });
    get().removePlannedSet(exerciseId, key);
  },

  uncommitSet: async (setId) => {
    await get().removeActiveSet(setId);
  },

  refreshExercises: async () => {
    const exercises = await repo.listExercises();
    set({ exercises });
  },

  createCustomExercise: async (data) => {
    const id = await repo.createCustomExercise(data);
    await get().refreshExercises();
    return id;
  },

  deleteCustomExercise: async (id) => {
    await repo.deleteExercise(id);
    await get().refreshExercises();
  },

  refreshRoutines: async () => {
    const { user } = get();
    if (!user) return;
    const routines = await repo.listRoutines(user.id);
    set({ routines });
  },

  refreshBodyMeasurements: async () => {
    const { user } = get();
    if (!user) return;
    const bodyMeasurements = await repo.listBodyMeasurements(user.id);
    set({ bodyMeasurements });
  },

  addBodyMeasurement: async (data) => {
    const { user } = get();
    if (!user) throw new Error('no user');
    await repo.createBodyMeasurement({ ...data, userId: user.id });
    if (data.weightKg) {
      await repo.updateUser(user.id, { weightKg: data.weightKg });
    }
    await get().refreshBodyMeasurements();
    await get().refreshUser();
    get().enqueueSync?.();
  },

  deleteBodyMeasurement: async (id) => {
    await repo.deleteBodyMeasurement(id);
    await get().refreshBodyMeasurements();
    get().enqueueSync?.();
  },

  refreshTodayMeals: async () => {
    const { user } = get();
    if (!user) return;
    const { todayKey } = await import('@/lib/date');
    const key = todayKey();
    const todayMeals = await repo.listMealsByDate(user.id, key);
    const todayNutrition = await repo.dailyNutritionTotals(user.id, key);
    set({ todayMeals, todayNutrition });
  },

  addMeal: async (data) => {
    const { user } = get();
    if (!user) throw new Error('no user');
    const id = await repo.createMeal({ ...data, userId: user.id });
    await get().refreshTodayMeals();
    get().enqueueSync?.();
    return id;
  },

  deleteMeal: async (id) => {
    await repo.deleteMeal(id);
    await get().refreshTodayMeals();
    get().enqueueSync?.();
  },

  setThemeMode: async (mode) => {
    set({ themeMode: mode });
    const { setThemeMode: persist } = await import('@/lib/theme');
    const { colorScheme } = await import('nativewind');
    await persist(mode);
    colorScheme.set(mode);
  },

  loadThemeMode: async () => {
    const { getThemeMode } = await import('@/lib/theme');
    const { colorScheme } = await import('nativewind');
    const mode = await getThemeMode();
    set({ themeMode: mode });
    colorScheme.set(mode);
  },

  signUpEmail: async (email, password) => {
    const { signUpWithEmail } = await import('@/lib/auth');
    set({ authLoading: true });
    try {
      const r = await signUpWithEmail(email, password);
      if (r.session) {
        set({ authSession: r.session });
        get().enqueueSync?.();
      }
      return { needConfirm: r.needConfirm };
    } finally {
      set({ authLoading: false });
    }
  },

  signInEmail: async (email, password) => {
    const { signInWithEmail } = await import('@/lib/auth');
    set({ authLoading: true });
    try {
      const { session } = await signInWithEmail(email, password);
      set({ authSession: session });
      get().enqueueSync?.();
    } finally {
      set({ authLoading: false });
    }
  },

  resetPasswordEmail: async (email) => {
    const { resetPassword } = await import('@/lib/auth');
    await resetPassword(email);
  },

  resendConfirmEmail: async (email) => {
    const { resendConfirmationEmail } = await import('@/lib/auth');
    await resendConfirmationEmail(email);
  },

  syncCloud: async () => {
    const session = get().authSession;
    if (!session?.user?.id) throw new Error('請先登入雲端');
    set({ syncStatus: 'syncing' });
    try {
      const { fullSync } = await import('@/lib/cloud_sync');
      const stats = await fullSync(session.user.id);
      const pushed = stats.pushedWorkouts + stats.pushedSets + stats.pushedMeals + stats.pushedBody;
      const pulled = stats.pulledWorkouts + stats.pulledSets + stats.pulledMeals + stats.pulledBody;
      await get().refreshTodayMeals?.();
      set({ syncStatus: 'idle', lastSyncedAt: Date.now() });
      return { pushed, pulled };
    } catch (e) {
      set({ syncStatus: 'error' });
      throw e;
    }
  },

  enqueueSync: () => {
    if (!get().authSession?.user?.id) return;
    if (_syncDebounceTimer) clearTimeout(_syncDebounceTimer);
    _syncDebounceTimer = setTimeout(() => {
      _syncDebounceTimer = null;
      get().syncCloud().catch((e) => console.warn('[sync] background sync failed:', e?.message ?? e));
    }, 5000);
  },

  logout: async () => {
    const { signOut } = await import('@/lib/auth');
    await signOut();
    set({ authSession: null });
  },

  loadAuthSession: async () => {
    const { getCurrentSession, isSupabaseConfigured } = await Promise.all([
      import('@/lib/auth'),
      import('@/lib/supabase'),
    ]).then(([a, s]) => ({ getCurrentSession: a.getCurrentSession, isSupabaseConfigured: s.isSupabaseConfigured }));
    if (!isSupabaseConfigured()) return;
    try {
      const session = await getCurrentSession();
      set({ authSession: session });
    } catch {}
  },

  setAuthSession: (session) => set({ authSession: session }),

  createRoutineWithExercises: async ({ name, emoji, note, exerciseIds }) => {
    const { user } = get();
    if (!user) throw new Error('no user');
    const routineId = await repo.createRoutine({ userId: user.id, name, emoji, note });
    for (let i = 0; i < exerciseIds.length; i++) {
      await repo.addExerciseToRoutine({ routineId, exerciseId: exerciseIds[i], orderIdx: i });
    }
    await get().refreshRoutines();
    get().enqueueSync?.();
    return routineId;
  },

  deleteRoutine: async (id) => {
    await repo.deleteRoutine(id);
    await get().refreshRoutines();
    get().enqueueSync?.();
  },

  duplicateRoutine: async (id: number) => {
    const { user } = get();
    if (!user) throw new Error('no user');
    const newId = await repo.duplicateRoutine(id, user.id);
    await get().refreshRoutines();
    return newId;
  },

  loadRoutineAsQueue: async (routineId) => {
    const rexs = await repo.listRoutineExercises(routineId);
    const { exercises } = get();
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const queue = rexs.map((r) => byId.get(r.exerciseId)).filter((e): e is Exercise => !!e);
    set({ routineQueue: queue, currentRoutineId: routineId });

    const routine = await repo.getRoutine(routineId);
    const plannedMap: Record<number, PlannedSet[]> = {};

    if (routine?.lastSnapshotJson) {
      try {
        const snap = JSON.parse(routine.lastSnapshotJson) as Array<{
          exerciseId: number;
          orderIdx: number;
          weight: number | null;
          reps: number | null;
          durationSec: number | null;
          distanceM: number | null;
        }>;
        for (const s of snap) {
          const ex = byId.get(s.exerciseId);
          if (!ex) continue;
          if (!plannedMap[ex.id]) plannedMap[ex.id] = [];
          plannedMap[ex.id].push({
            key: `p_snap_${ex.id}_${plannedMap[ex.id].length}_${Math.random().toString(36).slice(2, 6)}`,
            weight: s.weight,
            reps: s.reps,
            durationSec: s.durationSec,
            distanceM: s.distanceM,
          });
        }
      } catch {}
    }

    for (const rex of rexs) {
      if (plannedMap[rex.exerciseId]) continue;
      const targetSets = Math.max(1, rex.targetSets ?? 1);
      plannedMap[rex.exerciseId] = Array.from({ length: targetSets }, (_, i) => ({
        key: `p_target_${rex.exerciseId}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      }));
    }

    set({ plannedSetsByExercise: plannedMap });
  },

  clearRoutineQueue: () => set({ routineQueue: [], currentRoutineId: null, plannedSetsByExercise: {} }),

  popRoutineQueue: () => {
    const { routineQueue } = get();
    if (routineQueue.length === 0) return null;
    const [first, ...rest] = routineQueue;
    set({ routineQueue: rest });
    return first;
  },

  pickFromQueue: (exerciseId) => {
    const { routineQueue } = get();
    const picked = routineQueue.find((e) => e.id === exerciseId);
    if (!picked) return null;
    set({ routineQueue: routineQueue.filter((e) => e.id !== exerciseId) });
    return picked;
  },

  addExercisesToQueue: (ids) => {
    const { routineQueue, exercises } = get();
    const existing = new Set(routineQueue.map((e) => e.id));
    const byId = new Map(exercises.map((e) => [e.id, e]));
    const toAdd = ids
      .filter((id) => !existing.has(id))
      .map((id) => byId.get(id))
      .filter((e): e is Exercise => !!e);
    if (toAdd.length === 0) return;
    set({ routineQueue: [...routineQueue, ...toAdd] });
  },

  removeFromQueue: (exerciseId) => {
    const { routineQueue } = get();
    set({ routineQueue: routineQueue.filter((e) => e.id !== exerciseId) });
  },

  saveAsNewRoutine: async (name, emoji = '💪') => {
    const { user, activeSets } = get();
    if (!user) throw new Error('no user');
    const exerciseIds = Array.from(new Set(activeSets.map((s) => s.exercise.id)));
    if (exerciseIds.length === 0) throw new Error('no exercises');
    const routineId = await repo.createRoutine({ userId: user.id, name, emoji });
    for (let i = 0; i < exerciseIds.length; i++) {
      const setCount = activeSets.filter((s) => s.exercise.id === exerciseIds[i]).length;
      await repo.addExerciseToRoutine({
        routineId,
        exerciseId: exerciseIds[i],
        orderIdx: i,
        targetSets: setCount,
      });
    }
    const snap = activeSets.map((s) => ({
      exerciseId: s.exercise.id,
      orderIdx: s.orderIdx,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      durationSec: s.durationSec ?? null,
      distanceM: s.distanceM ?? null,
    }));
    await repo.updateRoutineSnapshot(routineId, JSON.stringify(snap));
    await get().refreshRoutines();
    return routineId;
  },

  setTempSelectedIds: (ids) => set({ tempSelectedExerciseIds: ids }),
  toggleTempSelectedId: (id) => {
    const { tempSelectedExerciseIds } = get();
    set({
      tempSelectedExerciseIds: tempSelectedExerciseIds.includes(id)
        ? tempSelectedExerciseIds.filter((x) => x !== id)
        : [...tempSelectedExerciseIds, id],
    });
  },
  clearTempSelectedIds: () => set({ tempSelectedExerciseIds: [] }),

  saveRoutineSnapshot: async (routineId) => {
    const { activeSets } = get();
    const snap = activeSets.map((s) => ({
      exerciseId: s.exercise.id,
      orderIdx: s.orderIdx,
      weight: s.weight ?? null,
      reps: s.reps ?? null,
      durationSec: s.durationSec ?? null,
      distanceM: s.distanceM ?? null,
    }));
    await repo.updateRoutineSnapshot(routineId, JSON.stringify(snap));
  },

  overwriteRoutineWithActiveSets: async (routineId) => {
    const { activeSets } = get();
    const exerciseIds = Array.from(new Set(activeSets.map((s) => s.exercise.id)));
    const existing = await repo.listRoutineExercises(routineId);
    for (const r of existing) {
      await repo.removeExerciseFromRoutine(r.id);
    }
    for (let i = 0; i < exerciseIds.length; i++) {
      const setCount = activeSets.filter((s) => s.exercise.id === exerciseIds[i]).length;
      await repo.addExerciseToRoutine({
        routineId,
        exerciseId: exerciseIds[i],
        orderIdx: i,
        targetSets: Math.max(1, setCount),
      });
    }
    await get().saveRoutineSnapshot(routineId);
    await get().refreshRoutines();
  },

  setPendingHatch: (p) => set({ pendingHatch: p }),

  confirmHatch: async (petName) => {
    const { pendingHatch, user } = get();
    if (!pendingHatch || !user) return;

    const petId = await repo.createPet({
      userId: user.id,
      eggId: pendingHatch.eggId,
      name: petName || pendingHatch.petName,
      species: pendingHatch.petName,
      type: pendingHatch.type,
      emoji: pendingHatch.emoji,
    });

    await repo.hatchEgg(pendingHatch.eggId, petId);

    const nextTypes: EggType[] = ['strength', 'cardio', 'flex'];
    const idx = Math.floor(Math.random() * nextTypes.length);
    await repo.createEgg(user.id, nextTypes[idx], 500);

    set({ pendingHatch: null });
    await get().refreshEgg();
    await get().refreshPets();
  },
}));
