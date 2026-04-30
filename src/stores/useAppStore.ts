import { create } from 'zustand';
import type { User, Exercise, Workout, Egg, Pet, EggType, Routine, RoutineExercise, WorkoutSet, BodyMeasurement, Meal, MealType } from '@/db/schema';
import type { ThemeMode, ThemeStyle } from '@/lib/theme';
import type { Session } from '@supabase/supabase-js';
import type { WaterLog, BowelLog, SleepLog, PeriodDay, PetMessage, BristolType, PeriodFlow, CustomFood } from '@/db/schema';
import { DEFAULT_HEALTH_SETTINGS, parseHealthSettings, stringifyHealthSettings, type HealthSettings } from '@/lib/health_settings';
import { QUICK_ADD_BATCH_MS } from '@/lib/gestures';
import * as healthRepo from '@/db/health_repo';

export type PlannedSet = {
  key: string;
  weight?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  swimStroke?: string | null;
  inclinePct?: number | null;
  speedKmh?: number | null;
};
import * as repo from '@/db/repo';
import { PET_SPECIES } from '@/data/exercises';
import { calcSetExp, calcVolume } from '@/lib/exp';
import {
  addLiberationPoints,
  tickConsecutiveDay,
  workoutPointsFor,
  LIBERATION_PER_EVENT,
  type WorkoutKind,
} from '@/lib/liberation_score';
import { rollRarity, rollSkin, getSkinById, EGG_SKINS } from '@/data/egg_skins';
import type { ScoreSource, EggRarity } from '@/db/schema';

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
  swimStroke?: string | null;
  inclinePct?: number | null;
  speedKmh?: number | null;
  exp: number;
  isPR?: 'volume' | 'duration' | 'distance' | null;
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
  themeStyle: ThemeStyle;
  lowPowerMode: boolean;
  calendarViewMode: 'month' | 'week' | 'last7days';
  statsLayoutJson: string | null;
  /** Onboarding 第 4 頁使用者輸入的寵物名，孵化時用 */
  onboardingPetName: string | null;
  /** 自訂食物庫（plan v5）*/
  customFoods: CustomFood[];
  authSession: Session | null;
  authLoading: boolean;

  // 健康四模組 state
  waterToday: WaterLog[];
  bowelToday: BowelLog[];
  sleepLast: SleepLog | null;
  periodRecent: PeriodDay[];
  petMessages: PetMessage[];
  healthSettings: HealthSettings;
  /** dashboard layout JSON 字串；未設定就 null */
  dashboardLayoutJson: string | null;
  /** streak 補課券 */
  streakFreezeTokens: number;

  // Undo stack（最多 1 筆）
  undoStack: { id: string; type: string; message: string; expiresAt: number; undo: () => Promise<void> | void }[];

  // Surprise Box 待開獎
  pendingReward: { id: string; label: string; rarity: string } | null;

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

  pendingHatch: {
    eggId: number;
    petName: string;
    emoji: string;
    type: EggType;
    skinId?: string | null;
    rarity?: EggRarity | null;
    isLegacy?: boolean;
  } | null;
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
  reorderRoutines: (orderedIds: number[]) => Promise<void>;
  refreshBodyMeasurements: () => Promise<void>;
  addBodyMeasurement: (data: Omit<import('@/db/schema').NewBodyMeasurement, 'id' | 'createdAt' | 'userId'> & { measuredAt: Date | number }) => Promise<void>;
  deleteBodyMeasurement: (id: number) => Promise<void>;

  refreshTodayMeals: () => Promise<void>;
  addMeal: (data: Omit<import('@/db/schema').NewMeal, 'id' | 'createdAt' | 'userId'> & { loggedAt: Date | number }) => Promise<number>;
  deleteMeal: (id: number) => Promise<void>;
  updateMealById: (id: number, patch: any) => Promise<void>;

  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loadThemeMode: () => Promise<void>;
  setThemeStyle: (style: ThemeStyle) => Promise<void>;
  loadThemeStyle: () => Promise<void>;
  setLowPowerMode: (v: boolean) => Promise<void>;
  loadLowPowerMode: () => Promise<void>;
  setCalendarViewMode: (m: 'month' | 'week' | 'last7days') => Promise<void>;
  loadCalendarViewMode: () => Promise<void>;
  setStatsLayoutJson: (json: string) => Promise<void>;
  loadStatsLayoutJson: () => Promise<void>;
  setOnboardingPetName: (name: string | null) => Promise<void>;
  loadOnboardingPetName: () => Promise<void>;

  // 食物庫（v5）
  refreshCustomFoods: (searchQuery?: string) => Promise<void>;
  addCustomFood: (data: Omit<import('@/db/schema').NewCustomFood, 'id' | 'userId' | 'useCount' | 'createdAt' | 'lastUsedAt'>) => Promise<number>;
  updateCustomFood: (id: number, patch: any) => Promise<void>;
  deleteCustomFood: (id: number) => Promise<void>;
  useCustomFood: (id: number, multiplier: number) => Promise<{ name: string; portion?: string; calories: number; protein: number; carb: number; fat: number } | null>;

  // 健康模組 actions
  refreshHealth: () => Promise<void>;
  addWater: (amountMl: number, opts?: { batch?: boolean }) => Promise<void>;
  addBowel: (opts?: { bristol?: number; hasBlood?: number; hasPain?: number; notes?: string }) => Promise<number>;
  upsertBowel: (id: number, patch: { bristol?: number; hasBlood?: number; hasPain?: number; notes?: string }) => Promise<void>;
  upsertSleep: (data: { bedtimeAt: number; wakeAt: number; quality?: number; forceNew?: boolean }) => Promise<void>;
  addNap: (data: { bedtimeAt: number; wakeAt: number; quality?: number }) => Promise<void>;
  awardLiberation: (source: ScoreSource, opts?: {
    sourceId?: number | null;
    basePoints?: number;
    workoutKind?: WorkoutKind;
  }) => Promise<{ pointsGranted: number; hatched: boolean } | null>;
  upsertPeriodDay: (data: { date: number; flow?: PeriodFlow; symptoms?: string[]; notes?: string; isCycleStart?: boolean }) => Promise<void>;
  endCurrentPeriod: () => Promise<void>;
  loadHealthSettings: () => Promise<void>;
  updateHealthSettings: (patch: Partial<HealthSettings>) => Promise<void>;
  loadDashboardLayout: () => Promise<void>;
  setDashboardLayoutJson: (json: string) => Promise<void>;

  // Undo
  pushUndo: (entry: { id: string; type: string; message: string; undo: () => Promise<void> | void }) => void;
  popUndo: () => void;
  triggerUndo: () => Promise<void>;
  clearExpiredUndo: () => void;

  // Surprise Box（Trinity 完成觸發）
  checkTrinityCompletion: () => Promise<void>;
  consumePendingReward: () => void;

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
  themeStyle: 'modern' as ThemeStyle,
  lowPowerMode: false,
  calendarViewMode: 'month' as 'month' | 'week' | 'last7days',
  statsLayoutJson: null,
  onboardingPetName: null,
  customFoods: [],
  authSession: null,
  waterToday: [],
  bowelToday: [],
  sleepLast: null,
  periodRecent: [],
  petMessages: [],
  healthSettings: DEFAULT_HEALTH_SETTINGS,
  dashboardLayoutJson: null,
  streakFreezeTokens: 0,
  undoStack: [],
  pendingReward: null,
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

    // 健康模組初始化
    if (user) {
      const [hsRaw, dlRaw, tokens] = await Promise.all([
        healthRepo.getHealthSettings(user.id),
        healthRepo.getDashboardLayout(user.id),
        healthRepo.getStreakFreezeTokens(user.id),
      ]);
      set({
        healthSettings: parseHealthSettings(hsRaw),
        dashboardLayoutJson: dlRaw,
        streakFreezeTokens: tokens,
      });

      // 嘗試自動消耗補課券救 streak
      try {
        const { tryAutoFreeze } = await import('@/lib/streak_freeze');
        const result = await tryAutoFreeze(user);
        if (result.used) {
          await get().refreshUser();
          // 寫一則寵物訊息通知使用者
          await healthRepo.addPetMessage({
            userId: user.id,
            petId: pets[0]?.id ?? null,
            generatedAt: new Date(),
            category: 'celebration',
            text: `補課券救了你的 ${user.streak} 天連續紀錄！還有 ${result.tokensLeft} 張`,
            read: 0,
            triggerData: JSON.stringify({ type: 'freeze-used', tokensLeft: result.tokensLeft }),
          });
          set({ streakFreezeTokens: result.tokensLeft });
        }
      } catch (e) {
        console.warn('Auto freeze failed', e);
      }

      // 每天首次 bootstrap 生成寵物訊息（同天不重複，pet_messages 內部會去重）
      try {
        const { generateDailyMessages } = await import('@/lib/pet_messages');
        await generateDailyMessages(user.id, pets[0] ?? null, user.streak);
      } catch (e) {
        console.warn('Pet messages generate failed', e);
      }

      await get().refreshHealth();
      await get().refreshCustomFoods();
    }
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
    const { currentWorkoutId, activeSets, user } = get();
    if (!currentWorkoutId) return;
    const orderIdx = activeSets.length;
    const setInput = {
      weight: data.weight ?? null,
      reps: data.reps ?? null,
      durationSec: data.durationSec ?? null,
      distanceM: data.distanceM ?? null,
      swimStroke: data.swimStroke ?? null,
      inclinePct: data.inclinePct ?? null,
      speedKmh: data.speedKmh ?? null,
    };
    const exp = calcSetExp(exercise, setInput);
    const id = await repo.addSet({
      workoutId: currentWorkoutId,
      exerciseId: exercise.id,
      orderIdx,
      ...setInput,
      exp,
    });
    // PR 偵測：set 寫入 DB 後（this includes current）查歷史最佳是否被當前打破
    let isPR: 'volume' | 'duration' | 'distance' | null = null;
    try {
      if (user) {
        const { checkPR } = await import('@/lib/pr_check');
        isPR = await checkPR(user.id, exercise.id, setInput);
        if (isPR) {
          // 寵物送 celebration 訊息
          await healthRepo.addPetMessage({
            userId: user.id,
            petId: get().pets[0]?.id ?? null,
            generatedAt: new Date(),
            category: 'celebration',
            text: `🏆 打破個人紀錄！${exercise.name}`,
            read: 0,
            triggerData: JSON.stringify({ type: 'pr', exerciseId: exercise.id, prType: isPR }),
          });
        }
      }
    } catch {}
    set({
      activeSets: [...activeSets, { id, exercise, orderIdx, ...setInput, exp, isPR }],
    });
  },

  removeActiveSet: async (id) => {
    await repo.deleteSet(id);
    set({ activeSets: get().activeSets.filter(s => s.id !== id) });
  },

  finishWorkout: async (note?: string) => {
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

    await repo.finishWorkout(currentWorkoutId, { totalExp, totalVolume, durationSec, note });

    const today = todayKey();
    let streak = user.streak;
    let tokenDelta = 0;
    if (user.lastWorkoutDate !== today) {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yesterday = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      const next = user.lastWorkoutDate === yesterday ? streak + 1 : 1;
      // 每 7 天連續 → 發 1 張補課券（streak 2.0）
      if (next > streak && next % 7 === 0) tokenDelta = 1;
      streak = next;
    }

    await repo.updateUser(user.id, {
      totalWorkouts: user.totalWorkouts + 1,
      totalExp: user.totalExp + totalExp,
      streak,
      lastWorkoutDate: today,
    });

    if (tokenDelta !== 0) {
      const newTokens = await healthRepo.updateStreakFreezeTokens(user.id, tokenDelta);
      set({ streakFreezeTokens: newTokens });
    }

    let hatched = false;
    // Legacy 蛋繼續走舊 EXP 路徑（保留歷史用戶體驗）；新蛋（is_legacy=0）由下方 awardLiberation 處理
    if (activeEgg && (activeEgg as any).isLegacy === 1) {
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
            isLegacy: true,
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

    // v1.0.2 解放健力% 引擎：判定 workoutKind（取最多 set 對應的 category）
    const kindCount: Record<string, number> = {};
    for (const s of activeSets) {
      const c = s.exercise.category;
      kindCount[c] = (kindCount[c] ?? 0) + 1;
    }
    const dominantKind = (Object.entries(kindCount).sort((a, b) => b[1] - a[1])[0]?.[0]) as WorkoutKind | undefined;
    const workoutKind: WorkoutKind = dominantKind === 'cardio' || dominantKind === 'flex' ? dominantKind : 'strength';
    const liberation = await get().awardLiberation('workout', { sourceId: currentWorkoutId, workoutKind });
    if (liberation?.hatched) hatched = true;

    await get().refreshUser();
    await get().refreshEgg();
    await get().refreshPets();
    await get().refreshHistory();
    // 訓練完成 → 動圈勾掉 → 觸發 Trinity 檢查
    try { await get().checkTrinityCompletion(); } catch {}
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
      swimStroke: planned.swimStroke ?? null,
      inclinePct: planned.inclinePct ?? null,
      speedKmh: planned.speedKmh ?? null,
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

  reorderRoutines: async (orderedIds: number[]) => {
    const current = get().routines;
    const byId = new Map(current.map((r) => [r.id, r]));
    const next = orderedIds
      .map((id, idx) => {
        const r = byId.get(id);
        return r ? { ...r, sortOrder: idx } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    set({ routines: next });
    await repo.reorderRoutines(orderedIds);
    get().enqueueSync?.();
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
    const bodyId = await repo.createBodyMeasurement({ ...data, userId: user.id });
    if (data.weightKg) {
      await repo.updateUser(user.id, { weightKg: data.weightKg });
    }
    await get().refreshBodyMeasurements();
    await get().refreshUser();
    await get().awardLiberation('body', { sourceId: bodyId });
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
    await get().awardLiberation('meal', { sourceId: id });
    get().enqueueSync?.();
    return id;
  },

  updateMealById: async (id, patch) => {
    await repo.updateMeal(id, patch);
    await get().refreshTodayMeals();
    get().enqueueSync?.();
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

  setThemeStyle: async (style) => {
    set({ themeStyle: style });
    const { setThemeStyle: persist } = await import('@/lib/theme');
    await persist(style);
  },

  loadThemeStyle: async () => {
    const { getThemeStyle } = await import('@/lib/theme');
    const style = await getThemeStyle();
    set({ themeStyle: style });
  },

  setLowPowerMode: async (v) => {
    set({ lowPowerMode: v });
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('@kibo/low_power', v ? '1' : '0');
  },

  loadLowPowerMode: async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const v = await AsyncStorage.getItem('@kibo/low_power');
    set({ lowPowerMode: v === '1' });
  },

  setCalendarViewMode: async (m) => {
    set({ calendarViewMode: m });
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('@kibo/calendar_view', m);
  },

  loadCalendarViewMode: async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const v = await AsyncStorage.getItem('@kibo/calendar_view');
    if (v === 'month' || v === 'week' || v === 'last7days') set({ calendarViewMode: v });
  },

  setStatsLayoutJson: async (json) => {
    set({ statsLayoutJson: json });
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.setItem('@kibo/stats_layout', json);
  },

  loadStatsLayoutJson: async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const v = await AsyncStorage.getItem('@kibo/stats_layout');
    set({ statsLayoutJson: v });
  },

  setOnboardingPetName: async (name) => {
    set({ onboardingPetName: name });
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    if (name) await AsyncStorage.setItem('@kibo/onboarding_pet_name', name);
    else await AsyncStorage.removeItem('@kibo/onboarding_pet_name');
  },

  loadOnboardingPetName: async () => {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const v = await AsyncStorage.getItem('@kibo/onboarding_pet_name');
    set({ onboardingPetName: v });
  },

  refreshCustomFoods: async (searchQuery) => {
    const u = get().user;
    if (!u) return;
    const list = await repo.listCustomFoods(u.id, { searchQuery });
    set({ customFoods: list });
  },

  addCustomFood: async (data) => {
    const u = get().user;
    if (!u) return 0;
    const id = await repo.createCustomFood({
      userId: u.id,
      name: data.name,
      emoji: data.emoji,
      caloriesKcal: data.caloriesKcal ?? 0,
      proteinG: data.proteinG ?? 0,
      carbG: data.carbG ?? 0,
      fatG: data.fatG ?? 0,
      portion: data.portion,
      photoUri: data.photoUri,
      source: data.source as 'manual' | 'ai',
    });
    await get().refreshCustomFoods();
    get().enqueueSync?.();
    return id;
  },

  updateCustomFood: async (id, patch) => {
    await repo.updateCustomFood(id, patch);
    await get().refreshCustomFoods();
    get().enqueueSync?.();
  },

  deleteCustomFood: async (id) => {
    await repo.deleteCustomFood(id);
    await get().refreshCustomFoods();
    get().enqueueSync?.();
  },

  useCustomFood: async (id, multiplier) => {
    const food = await repo.getCustomFood(id);
    if (!food) return null;
    await repo.incrementCustomFoodUse(id);
    await get().refreshCustomFoods();
    return {
      name: food.name,
      portion: food.portion ? `${multiplier} × ${food.portion}` : `${multiplier} 份`,
      calories: Math.round(food.caloriesKcal * multiplier),
      protein: Math.round(food.proteinG * multiplier * 10) / 10,
      carb: Math.round(food.carbG * multiplier * 10) / 10,
      fat: Math.round(food.fatG * multiplier * 10) / 10,
    };
  },

  // ===== 健康模組 =====

  refreshHealth: async () => {
    const u = get().user;
    if (!u) return;
    const [water, bowel, sleep, period, msgs, tokens] = await Promise.all([
      healthRepo.listWaterToday(u.id),
      healthRepo.listBowelToday(u.id),
      healthRepo.getSleepLast(u.id),
      healthRepo.listPeriodDays(u.id, 90),
      healthRepo.listPetMessages(u.id, 30),
      healthRepo.getStreakFreezeTokens(u.id),
    ]);
    set({
      waterToday: water,
      bowelToday: bowel,
      sleepLast: sleep,
      periodRecent: period,
      petMessages: msgs,
      streakFreezeTokens: tokens,
    });
    // 任何健康資料變動後檢查 Trinity 完成
    try { await get().checkTrinityCompletion(); } catch {}
  },

  addWater: async (amountMl, opts) => {
    const u = get().user;
    if (!u) return;
    // 連點合併 batch 檢查：找最近的 water log 是否在 batch window 內
    const now = Date.now();
    const recent = get().waterToday[0];
    let batchKey: string | undefined;
    if (recent && opts?.batch !== false) {
      const recentTs = recent.loggedAt instanceof Date ? recent.loggedAt.getTime() : Number(recent.loggedAt);
      if (now - recentTs <= QUICK_ADD_BATCH_MS && recent.batchKey) {
        batchKey = recent.batchKey;
      }
    }
    if (!batchKey && opts?.batch !== false) {
      batchKey = `b_${now}`;
    }
    // 加水前的當日總量
    const beforeTotal = get().waterToday.reduce((s, w) => s + (w.amountMl ?? 0), 0);
    const goal = get().healthSettings.water.dailyGoalMl;
    const id = await healthRepo.addWater({ userId: u.id, amountMl, loggedAt: now, batchKey });
    await get().refreshHealth();
    // 第一次達標才加分（避免重複）
    if (beforeTotal < goal && beforeTotal + amountMl >= goal) {
      await get().awardLiberation('water', { sourceId: id });
    }
    get().enqueueSync?.();
    // push undo（以 batchKey 為主）
    if (batchKey) {
      get().pushUndo({
        id: `water-${batchKey}`,
        type: 'water',
        message: `已記錄水量`,
        undo: async () => {
          await healthRepo.deleteWaterBatch(batchKey!);
          await get().refreshHealth();
        },
      });
    } else {
      get().pushUndo({
        id: `water-${id}`,
        type: 'water',
        message: `已記錄 +${amountMl}ml`,
        undo: async () => {
          await healthRepo.deleteWater(id);
          await get().refreshHealth();
        },
      });
    }
  },

  addBowel: async (opts) => {
    const u = get().user;
    if (!u) return 0;
    const id = await healthRepo.addBowel({ userId: u.id, ...(opts ?? {}) });
    await get().refreshHealth();
    await get().awardLiberation('bowel', { sourceId: id });
    get().enqueueSync?.();
    get().pushUndo({
      id: `bowel-${id}`,
      type: 'bowel',
      message: `已記錄排便`,
      undo: async () => {
        await healthRepo.deleteBowel(id);
        await get().refreshHealth();
      },
    });
    return id;
  },

  upsertBowel: async (id, patch) => {
    await healthRepo.updateBowel(id, patch);
    await get().refreshHealth();
    get().enqueueSync?.();
  },

  upsertSleep: async (data) => {
    const u = get().user;
    if (!u) return;
    const id = await healthRepo.upsertSleep({ userId: u.id, ...data });
    await get().refreshHealth();
    await get().awardLiberation('sleep', { sourceId: id });
    get().enqueueSync?.();
  },

  addNap: async (data) => {
    const u = get().user;
    if (!u) return;
    const id = await healthRepo.addNap({ userId: u.id, ...data });
    await get().refreshHealth();
    await get().awardLiberation('nap', { sourceId: id });
    get().enqueueSync?.();
  },

  awardLiberation: async (source, opts) => {
    const u = get().user;
    if (!u) return null;
    // 連續簽到先 tick（內部冪等：同天只做一次）
    const tick = await tickConsecutiveDay(u.id);
    const base = source === 'workout'
      ? workoutPointsFor(opts?.workoutKind ?? 'strength')
      : (opts?.basePoints ?? LIBERATION_PER_EVENT[source]);
    const result = await addLiberationPoints(u.id, source, base, opts?.sourceId ?? null);

    if (result.hatched && result.hatchEggId) {
      // 抽稀有度（用 user.next_egg_rarity_floor 保底）→ 抽皮膚
      const rarity = rollRarity(tick.rarityFloor);
      const skin = rollSkin(rarity);
      // 把皮膚寫到蛋上（孵化前定型，confirmHatch 時建立 pet）
      await repo.setEggSkin(result.hatchEggId, skin.id, rarity);
      set({
        pendingHatch: {
          eggId: result.hatchEggId,
          petName: skin.label,
          emoji: skin.emojiFallback,
          type: 'strength',  // 新蛋系統不再分類，但保留欄位給舊 UI 相容
          skinId: skin.id,
          rarity,
          isLegacy: false,
        },
      });
      // 用過的稀有度保底要清掉（下顆蛋重新走機率）
      await repo.updateUser(u.id, { nextEggRarityFloor: null } as any);
    }
    await get().refreshUser();
    await get().refreshEgg();
    return { pointsGranted: result.pointsGranted, hatched: result.hatched };
  },

  upsertPeriodDay: async (data) => {
    const u = get().user;
    if (!u) return;
    const id = await healthRepo.upsertPeriodDay({
      userId: u.id,
      date: data.date,
      flow: data.flow,
      symptoms: data.symptoms,
      notes: data.notes,
      isCycleStart: data.isCycleStart ? 1 : 0,
    });
    await get().refreshHealth();
    get().enqueueSync?.();
    if (data.isCycleStart) {
      // 不放入 undo（explicit save）
    } else {
      get().pushUndo({
        id: `period-${id}`,
        type: 'period',
        message: `已記錄經期`,
        undo: async () => {
          await healthRepo.deletePeriodDay(id);
          await get().refreshHealth();
        },
      });
    }
  },

  endCurrentPeriod: async () => {
    // 不刪除任何資料，只是接下來不再記日。實作方式：當下次 isCycleStart=true 才會啟新週期。
    // 此處不變動 DB，僅刷新 UI。
    await get().refreshHealth();
  },

  loadHealthSettings: async () => {
    const u = get().user;
    if (!u) return;
    const raw = await healthRepo.getHealthSettings(u.id);
    set({ healthSettings: parseHealthSettings(raw) });
  },

  updateHealthSettings: async (patch) => {
    const u = get().user;
    if (!u) return;
    const merged: HealthSettings = {
      ...get().healthSettings,
      ...patch,
      water: { ...get().healthSettings.water, ...(patch.water ?? {}) },
      bowel: { ...get().healthSettings.bowel, ...(patch.bowel ?? {}) },
      sleep: { ...get().healthSettings.sleep, ...(patch.sleep ?? {}) },
      period: { ...get().healthSettings.period, ...(patch.period ?? {}) },
    };
    set({ healthSettings: merged });
    await healthRepo.setHealthSettings(u.id, stringifyHealthSettings(merged));
    get().enqueueSync?.();
    // 重排提醒
    try {
      const { rescheduleAll } = await import('@/lib/reminders');
      await rescheduleAll(merged);
    } catch {}
  },

  loadDashboardLayout: async () => {
    const u = get().user;
    if (!u) return;
    const raw = await healthRepo.getDashboardLayout(u.id);
    set({ dashboardLayoutJson: raw });
  },

  setDashboardLayoutJson: async (json) => {
    const u = get().user;
    if (!u) return;
    set({ dashboardLayoutJson: json });
    await healthRepo.setDashboardLayout(u.id, json);
    get().enqueueSync?.();
  },

  pushUndo: (entry) => {
    const expiresAt = Date.now() + 5000;
    set({ undoStack: [{ ...entry, expiresAt }] });
  },

  popUndo: () => {
    set({ undoStack: [] });
  },

  triggerUndo: async () => {
    const top = get().undoStack[0];
    if (!top) return;
    set({ undoStack: [] });
    try {
      await top.undo();
    } catch (e) {
      console.warn('Undo failed', e);
    }
  },

  clearExpiredUndo: () => {
    const now = Date.now();
    const stack = get().undoStack.filter((e) => e.expiresAt > now);
    if (stack.length !== get().undoStack.length) set({ undoStack: stack });
  },

  checkTrinityCompletion: async () => {
    const u = get().user;
    if (!u) return;
    // 已完成今天 → 不重複抽
    const existing = await healthRepo.getTrinityToday(u.id);
    if (existing) return;

    // 計算當日 trinity
    const { evaluateTrinity, rollSurpriseBox } = await import('@/lib/daily_trinity');
    const recent = get().recentWorkouts.filter((w: any) => {
      const d = new Date(w.startedAt); const today = new Date();
      return d.toDateString() === today.toDateString();
    });
    const todayKey = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const todayPeriodDays = get().periodRecent.filter((p) => p.dayKey === todayKey);

    const trinity = evaluateTrinity({
      todayWorkouts: recent as any,
      todayMeals: get().todayMeals,
      todayWater: get().waterToday,
      waterGoalMl: get().healthSettings.water.dailyGoalMl,
      todayBowel: get().bowelToday,
      sleepLast: get().sleepLast,
      todayPeriodDays: todayPeriodDays as any,
    });
    if (!trinity.complete) return;

    // 抽獎 + 記錄
    const consecutive = (await healthRepo.countTrinityConsecutive(u.id)) + 1;
    const reward = rollSurpriseBox(consecutive);
    await healthRepo.recordTrinityCompletion({
      userId: u.id,
      rewardId: reward.id,
      rewardLabel: reward.label,
      rewardRarity: reward.rarity,
      consecutiveDays: consecutive,
    });
    await healthRepo.addInventoryItem({
      userId: u.id,
      itemId: reward.id,
      itemLabel: reward.label,
      rarity: reward.rarity,
      source: 'trinity',
    });
    // 補課券特殊：直接 +1 token
    if (reward.id === 'freeze-token') {
      const newTokens = await healthRepo.updateStreakFreezeTokens(u.id, 1);
      set({ streakFreezeTokens: newTokens });
    }
    set({ pendingReward: { id: reward.id, label: reward.label, rarity: reward.rarity } });
  },

  consumePendingReward: () => {
    set({ pendingReward: null });
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
          swimStroke?: string | null;
          inclinePct?: number | null;
          speedKmh?: number | null;
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
            swimStroke: s.swimStroke ?? null,
            inclinePct: s.inclinePct ?? null,
            speedKmh: s.speedKmh ?? null,
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
    // snapshot = activeSets（這次完成的）+ 仍 planned 但未做的
    // 保留未做動作的舊重量／次數，下次開啟課表仍 pre-fill
    const { activeSets, plannedSetsByExercise, routineQueue } = get();
    const snap: Array<{
      exerciseId: number; orderIdx: number;
      weight: number | null; reps: number | null;
      durationSec: number | null; distanceM: number | null;
      swimStroke?: string | null; inclinePct?: number | null; speedKmh?: number | null;
    }> = [];

    activeSets.forEach((s) => {
      snap.push({
        exerciseId: s.exercise.id,
        orderIdx: s.orderIdx,
        weight: s.weight ?? null,
        reps: s.reps ?? null,
        durationSec: s.durationSec ?? null,
        distanceM: s.distanceM ?? null,
        swimStroke: s.swimStroke ?? null,
        inclinePct: s.inclinePct ?? null,
        speedKmh: s.speedKmh ?? null,
      });
    });

    // 加入仍在 routineQueue 但這次沒完成的動作的 planned set（保留 pre-fill 值）
    let nextOrder = activeSets.length;
    for (const ex of routineQueue) {
      const planned = plannedSetsByExercise[ex.id] ?? [];
      for (const p of planned) {
        snap.push({
          exerciseId: ex.id,
          orderIdx: nextOrder++,
          weight: p.weight ?? null,
          reps: p.reps ?? null,
          durationSec: p.durationSec ?? null,
          distanceM: p.distanceM ?? null,
          swimStroke: p.swimStroke ?? null,
          inclinePct: p.inclinePct ?? null,
          speedKmh: p.speedKmh ?? null,
        });
      }
    }

    await repo.updateRoutineSnapshot(routineId, JSON.stringify(snap));
  },

  overwriteRoutineWithActiveSets: async (routineId) => {
    // 用 routineQueue（使用者本次規劃的動作清單，包含這次未做完的）作為新課表結構
    // 這樣這次未做的動作下次開啟課表還是在
    const { routineQueue, activeSets, plannedSetsByExercise } = get();
    const exerciseIds = routineQueue.map((e) => e.id);
    const existing = await repo.listRoutineExercises(routineId);
    for (const r of existing) {
      await repo.removeExerciseFromRoutine(r.id);
    }
    for (let i = 0; i < exerciseIds.length; i++) {
      const exId = exerciseIds[i];
      const doneCount = activeSets.filter((s) => s.exercise.id === exId).length;
      const plannedCount = plannedSetsByExercise[exId]?.length ?? 0;
      // targetSets = 這次完成的 + 還沒做的 planned，至少 1
      const setCount = Math.max(1, doneCount + plannedCount);
      await repo.addExerciseToRoutine({
        routineId,
        exerciseId: exId,
        orderIdx: i,
        targetSets: setCount,
      });
    }
    await get().saveRoutineSnapshot(routineId);
    await get().refreshRoutines();
  },

  setPendingHatch: (p) => set({ pendingHatch: p }),

  confirmHatch: async (petName) => {
    const { pendingHatch, user, onboardingPetName } = get();
    if (!pendingHatch || !user) return;

    // 優先順序：使用者孵化時填的名字 > onboarding 命名 > pendingHatch 預設
    const finalName = (petName && petName.trim())
      || (onboardingPetName && onboardingPetName.trim())
      || pendingHatch.petName;

    const petId = await repo.createPet({
      userId: user.id,
      eggId: pendingHatch.eggId,
      name: finalName,
      species: pendingHatch.petName,
      type: pendingHatch.type,
      emoji: pendingHatch.emoji,
      skinId: pendingHatch.skinId ?? null,
      rarity: pendingHatch.rarity ?? null,
      isLegacy: pendingHatch.isLegacy ? 1 : 0,
    });

    await repo.hatchEgg(pendingHatch.eggId, petId);

    // 用過的 onboarding 名字清掉，下次孵化不再 reuse
    if (onboardingPetName) {
      await get().setOnboardingPetName(null);
    }

    // 新蛋（is_legacy=0）走 v1.0.2 新流程：建一顆乾淨的新蛋（liberation_pct=0），不再分三類
    const nextTypes: EggType[] = ['strength', 'cardio', 'flex'];
    const idx = Math.floor(Math.random() * nextTypes.length);
    await repo.createEgg(user.id, nextTypes[idx], 500);

    set({ pendingHatch: null });
    await get().refreshEgg();
    await get().refreshPets();
  },
}));
