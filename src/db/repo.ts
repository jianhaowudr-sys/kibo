import { sqliteDb } from './client';
import type {
  User, Exercise, Workout, WorkoutSet, Egg, Pet, EggType,
  Routine, RoutineExercise, BodyMeasurement, NewBodyMeasurement,
  Meal, NewMeal, MealType,
} from './schema';

type Row = Record<string, any>;

// 雲端同步：把要從 Supabase 刪除的 (table, local_id) 排隊，由 cloud_sync.flushPendingDeletions 真正打 DELETE
export type PendingDeletion = { id: number; tableName: string; localId: number };

export async function enqueueRemoteDelete(tableName: string, localId: number): Promise<void> {
  await sqliteDb.runAsync(
    `INSERT OR IGNORE INTO pending_deletions (table_name, local_id, enqueued_at) VALUES (?, ?, ?)`,
    [tableName, localId, Date.now()],
  );
}

export async function listPendingDeletions(): Promise<PendingDeletion[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    `SELECT id, table_name as tableName, local_id as localId FROM pending_deletions ORDER BY id ASC`,
  );
  return rs.map((r) => ({ id: r.id, tableName: r.tableName, localId: r.localId }));
}

export async function clearPendingDeletion(id: number): Promise<void> {
  await sqliteDb.runAsync(`DELETE FROM pending_deletions WHERE id = ?`, [id]);
}

const rowToUser = (r: Row): User => ({
  id: r.id,
  name: r.name,
  heightCm: r.height_cm,
  weightKg: r.weight_kg,
  goal: r.goal,
  dailyExpGoal: r.daily_exp_goal,
  weeklyDaysGoal: r.weekly_days_goal ?? 3,
  dailyCaloriesGoal: r.daily_calories_goal ?? 2000,
  dailyProteinGoal: r.daily_protein_goal ?? 100,
  streak: r.streak,
  lastWorkoutDate: r.last_workout_date,
  totalWorkouts: r.total_workouts,
  totalExp: r.total_exp,
  createdAt: new Date(r.created_at),
  healthSettings: r.health_settings ?? null,
  dashboardLayout: r.dashboard_layout ?? null,
  streakFreezeTokens: r.streak_freeze_tokens ?? 0,
  onboardingCompletedAt: r.onboarding_completed_at ? new Date(r.onboarding_completed_at) : null,
});

const rowToRoutine = (r: Row): Routine => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  emoji: r.emoji,
  note: r.note,
  lastSnapshotJson: r.last_snapshot_json ?? null,
  lastSavedAt: r.last_saved_at ? new Date(r.last_saved_at) : null,
  createdAt: new Date(r.created_at),
});

const rowToMeal = (r: Row): Meal => ({
  id: r.id,
  userId: r.user_id,
  loggedAt: new Date(r.logged_at),
  mealType: r.meal_type,
  title: r.title,
  itemsJson: r.items_json,
  caloriesKcal: r.calories_kcal,
  proteinG: r.protein_g,
  carbG: r.carb_g,
  fatG: r.fat_g,
  photoUri: r.photo_uri,
  note: r.note,
  aiParsed: !!r.ai_parsed,
  createdAt: new Date(r.created_at),
});

const rowToBodyMeasurement = (r: Row): BodyMeasurement => ({
  id: r.id,
  userId: r.user_id,
  measuredAt: new Date(r.measured_at),
  weightKg: r.weight_kg,
  bodyFatPct: r.body_fat_pct,
  skeletalMuscleKg: r.skeletal_muscle_kg,
  muscleMassKg: r.muscle_mass_kg,
  proteinKg: r.protein_kg,
  bodyFatKg: r.body_fat_kg,
  mineralKg: r.mineral_kg,
  bodyWaterKg: r.body_water_kg,
  bmr: r.bmr,
  visceralFatLevel: r.visceral_fat_level,
  bodyScore: r.body_score,
  photoUri: r.photo_uri,
  note: r.note,
  createdAt: new Date(r.created_at),
});

const rowToRoutineExercise = (r: Row): RoutineExercise => ({
  id: r.id,
  routineId: r.routine_id,
  exerciseId: r.exercise_id,
  orderIdx: r.order_idx,
  targetSets: r.target_sets,
});

const rowToExercise = (r: Row): Exercise => ({
  id: r.id,
  name: r.name,
  category: r.category,
  muscleGroup: r.muscle_group,
  part: r.part ?? null,
  equipment: r.equipment ?? null,
  unit: r.unit,
  icon: r.icon,
  expPerUnit: r.exp_per_unit,
  isCustom: !!r.is_custom,
  seedVersion: r.seed_version ?? 1,
});

const rowToWorkout = (r: Row): Workout => ({
  id: r.id,
  userId: r.user_id,
  startedAt: new Date(r.started_at),
  endedAt: r.ended_at ? new Date(r.ended_at) : null,
  note: r.note,
  totalExp: r.total_exp,
  totalVolume: r.total_volume,
  durationSec: r.duration_sec,
});

const rowToSet = (r: Row): WorkoutSet => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  orderIdx: r.order_idx,
  weight: r.weight,
  reps: r.reps,
  durationSec: r.duration_sec,
  distanceM: r.distance_m,
  swimStroke: r.swim_stroke ?? null,
  inclinePct: r.incline_pct ?? null,
  speedKmh: r.speed_kmh ?? null,
  completed: !!r.completed,
  exp: r.exp,
  createdAt: new Date(r.created_at),
});

const rowToEgg = (r: Row): Egg => ({
  id: r.id,
  userId: r.user_id,
  type: r.type,
  currentExp: r.current_exp,
  requiredExp: r.required_exp,
  stage: r.stage,
  hatchedAt: r.hatched_at ? new Date(r.hatched_at) : null,
  petId: r.pet_id,
  createdAt: new Date(r.created_at),
});

const rowToPet = (r: Row): Pet => ({
  id: r.id,
  userId: r.user_id,
  eggId: r.egg_id,
  name: r.name,
  species: r.species,
  type: r.type,
  level: r.level,
  exp: r.exp,
  stage: r.stage,
  emoji: r.emoji,
  createdAt: new Date(r.created_at),
});

export async function getCurrentUser(): Promise<User | null> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT * FROM users ORDER BY id ASC LIMIT 1');
  return r ? rowToUser(r) : null;
}

export async function updateUser(id: number, patch: Partial<User>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.heightCm !== undefined) { fields.push('height_cm = ?'); values.push(patch.heightCm); }
  if (patch.weightKg !== undefined) { fields.push('weight_kg = ?'); values.push(patch.weightKg); }
  if (patch.goal !== undefined) { fields.push('goal = ?'); values.push(patch.goal); }
  if (patch.dailyExpGoal !== undefined) { fields.push('daily_exp_goal = ?'); values.push(patch.dailyExpGoal); }
  if (patch.weeklyDaysGoal !== undefined) { fields.push('weekly_days_goal = ?'); values.push(patch.weeklyDaysGoal); }
  if (patch.dailyCaloriesGoal !== undefined) { fields.push('daily_calories_goal = ?'); values.push(patch.dailyCaloriesGoal); }
  if (patch.dailyProteinGoal !== undefined) { fields.push('daily_protein_goal = ?'); values.push(patch.dailyProteinGoal); }
  if (patch.streak !== undefined) { fields.push('streak = ?'); values.push(patch.streak); }
  if (patch.lastWorkoutDate !== undefined) { fields.push('last_workout_date = ?'); values.push(patch.lastWorkoutDate); }
  if (patch.totalWorkouts !== undefined) { fields.push('total_workouts = ?'); values.push(patch.totalWorkouts); }
  if (patch.totalExp !== undefined) { fields.push('total_exp = ?'); values.push(patch.totalExp); }
  if (!fields.length) return;
  values.push(id);
  await sqliteDb.runAsync(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function listExercises(): Promise<Exercise[]> {
  const rs = await sqliteDb.getAllAsync<Row>('SELECT * FROM exercises ORDER BY category, name');
  return rs.map(rowToExercise);
}

export async function getExercise(id: number): Promise<Exercise | null> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT * FROM exercises WHERE id = ?', [id]);
  return r ? rowToExercise(r) : null;
}

export async function createCustomExercise(data: {
  name: string;
  part: string;
  equipment?: string;
  unit: 'reps' | 'seconds' | 'minutes' | 'meters';
  muscleGroup?: string;
  category?: 'strength' | 'cardio' | 'flexibility';
}): Promise<number> {
  const result = await sqliteDb.runAsync(
    `INSERT INTO exercises (name, category, muscle_group, part, equipment, unit, icon, exp_per_unit, is_custom, seed_version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 2)`,
    [
      data.name,
      data.category ?? 'strength',
      data.muscleGroup ?? data.part,
      data.part,
      data.equipment ?? null,
      data.unit,
      data.part,
      1,
    ],
  );
  return result.lastInsertRowId as number;
}

export async function deleteExercise(id: number): Promise<void> {
  await sqliteDb.runAsync('DELETE FROM exercises WHERE id = ? AND is_custom = 1', [id]);
}

export async function listCustomExercises(): Promise<Exercise[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM exercises WHERE is_custom = 1 ORDER BY id DESC',
  );
  return rs.map(rowToExercise);
}

export async function createWorkout(userId: number): Promise<number> {
  const result = await sqliteDb.runAsync(
    'INSERT INTO workouts (user_id, started_at) VALUES (?, ?)',
    [userId, Date.now()],
  );
  return result.lastInsertRowId as number;
}

export async function getWorkout(id: number): Promise<Workout | null> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT * FROM workouts WHERE id = ?', [id]);
  return r ? rowToWorkout(r) : null;
}

export async function listWorkouts(userId: number, limit = 50): Promise<Workout[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL ORDER BY started_at DESC LIMIT ?',
    [userId, limit],
  );
  return rs.map(rowToWorkout);
}

export async function addSet(data: {
  workoutId: number;
  exerciseId: number;
  orderIdx: number;
  weight?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceM?: number | null;
  swimStroke?: string | null;
  inclinePct?: number | null;
  speedKmh?: number | null;
  exp: number;
}): Promise<number> {
  const result = await sqliteDb.runAsync(
    `INSERT INTO workout_sets (workout_id, exercise_id, order_idx, weight, reps, duration_sec, distance_m, swim_stroke, incline_pct, speed_kmh, completed, exp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      data.workoutId,
      data.exerciseId,
      data.orderIdx,
      data.weight ?? null,
      data.reps ?? null,
      data.durationSec ?? null,
      data.distanceM ?? null,
      data.swimStroke ?? null,
      data.inclinePct ?? null,
      data.speedKmh ?? null,
      data.exp,
      Date.now(),
    ],
  );
  return result.lastInsertRowId as number;
}

export async function deleteSet(id: number): Promise<void> {
  await enqueueRemoteDelete('workout_sets', id);
  await sqliteDb.runAsync('DELETE FROM workout_sets WHERE id = ?', [id]);
}

export async function listSetsForWorkout(workoutId: number): Promise<WorkoutSet[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM workout_sets WHERE workout_id = ? ORDER BY order_idx ASC, id ASC',
    [workoutId],
  );
  return rs.map(rowToSet);
}

export async function finishWorkout(workoutId: number, totals: {
  totalExp: number; totalVolume: number; durationSec: number; note?: string;
}): Promise<void> {
  if (totals.note !== undefined) {
    await sqliteDb.runAsync(
      'UPDATE workouts SET ended_at = ?, total_exp = ?, total_volume = ?, duration_sec = ?, note = ? WHERE id = ?',
      [Date.now(), totals.totalExp, totals.totalVolume, totals.durationSec, totals.note, workoutId],
    );
  } else {
    await sqliteDb.runAsync(
      'UPDATE workouts SET ended_at = ?, total_exp = ?, total_volume = ?, duration_sec = ? WHERE id = ?',
      [Date.now(), totals.totalExp, totals.totalVolume, totals.durationSec, workoutId],
    );
  }
}

export async function cancelWorkout(workoutId: number): Promise<void> {
  await enqueueRemoteDelete('workouts', workoutId);
  await sqliteDb.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);
}

export async function deleteWorkoutAndRecalc(userId: number, workoutId: number): Promise<void> {
  const setRows = await sqliteDb.getAllAsync<Row>('SELECT id FROM workout_sets WHERE workout_id = ?', [workoutId]);
  for (const s of setRows) await enqueueRemoteDelete('workout_sets', s.id);
  await enqueueRemoteDelete('workouts', workoutId);
  await sqliteDb.runAsync('DELETE FROM workout_sets WHERE workout_id = ?', [workoutId]);
  await sqliteDb.runAsync('DELETE FROM workouts WHERE id = ?', [workoutId]);

  const totals = await sqliteDb.getFirstAsync<{ c: number; e: number }>(
    `SELECT COUNT(*) as c, COALESCE(SUM(total_exp), 0) as e
     FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL`,
    [userId],
  );
  const last = await sqliteDb.getFirstAsync<{ d: string }>(
    `SELECT date(started_at / 1000, 'unixepoch', 'localtime') as d
     FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL
     ORDER BY started_at DESC LIMIT 1`,
    [userId],
  );
  await sqliteDb.runAsync(
    'UPDATE users SET total_workouts = ?, total_exp = ?, last_workout_date = ? WHERE id = ?',
    [totals?.c ?? 0, totals?.e ?? 0, last?.d ?? null, userId],
  );
}

export async function getActiveEgg(userId: number): Promise<Egg | null> {
  const r = await sqliteDb.getFirstAsync<Row>(
    'SELECT * FROM eggs WHERE user_id = ? AND hatched_at IS NULL ORDER BY created_at ASC LIMIT 1',
    [userId],
  );
  return r ? rowToEgg(r) : null;
}

export async function createEgg(userId: number, type: EggType, required = 500): Promise<number> {
  const result = await sqliteDb.runAsync(
    'INSERT INTO eggs (user_id, type, current_exp, required_exp, stage, created_at) VALUES (?, ?, 0, ?, 0, ?)',
    [userId, type, required, Date.now()],
  );
  return result.lastInsertRowId as number;
}

export async function addExpToEgg(eggId: number, exp: number): Promise<void> {
  await sqliteDb.runAsync(
    'UPDATE eggs SET current_exp = current_exp + ? WHERE id = ?',
    [exp, eggId],
  );
}

export async function hatchEgg(eggId: number, petId: number): Promise<void> {
  await sqliteDb.runAsync(
    'UPDATE eggs SET hatched_at = ?, pet_id = ? WHERE id = ?',
    [Date.now(), petId, eggId],
  );
}

export async function createPet(data: {
  userId: number; eggId: number; name: string; species: string; type: EggType; emoji: string;
}): Promise<number> {
  const result = await sqliteDb.runAsync(
    `INSERT INTO pets (user_id, egg_id, name, species, type, level, exp, stage, emoji, created_at)
     VALUES (?, ?, ?, ?, ?, 1, 0, 1, ?, ?)`,
    [data.userId, data.eggId, data.name, data.species, data.type, data.emoji, Date.now()],
  );
  return result.lastInsertRowId as number;
}

export async function listPets(userId: number): Promise<Pet[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM pets WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rs.map(rowToPet);
}

export async function addExpToPet(petId: number, exp: number): Promise<void> {
  await sqliteDb.runAsync(
    'UPDATE pets SET exp = exp + ? WHERE id = ?',
    [exp, petId],
  );
  // 進化階段：每 1000 EXP 升一階，上限 stage 5
  const r = await sqliteDb.getFirstAsync<{ exp: number; stage: number }>(
    'SELECT exp, stage FROM pets WHERE id = ?',
    [petId],
  );
  if (r) {
    const target = Math.min(5, 1 + Math.floor(r.exp / 1000));
    if (target > r.stage) {
      await sqliteDb.runAsync('UPDATE pets SET stage = ? WHERE id = ?', [target, petId]);
    }
  }
}

export async function weeklyExpByDay(userId: number, dayKeys: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const k of dayKeys) out[k] = 0;

  const rows = await sqliteDb.getAllAsync<Row>(
    `SELECT started_at, total_exp FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL AND started_at >= ?`,
    [userId, Date.now() - 1000 * 60 * 60 * 24 * 14],
  );

  for (const r of rows) {
    const d = new Date(r.started_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (out[key] !== undefined) out[key] += r.total_exp;
  }
  return out;
}

export async function listSetsForExercise(userId: number, exerciseId: number, limit = 50): Promise<(WorkoutSet & { workoutStartedAt: number })[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    `SELECT ws.*, w.started_at as w_started_at FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE w.user_id = ? AND ws.exercise_id = ? AND ws.completed = 1
     ORDER BY ws.created_at DESC LIMIT ?`,
    [userId, exerciseId, limit],
  );
  return rs.map((r) => ({
    ...rowToSet(r),
    workoutStartedAt: r.w_started_at,
  }));
}

export async function getExercisePRs(userId: number, exerciseId: number): Promise<{ maxWeight: number | null; maxReps: number | null; maxVolume: number | null; totalSets: number; totalReps: number }> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT
       MAX(ws.weight) as max_weight,
       MAX(ws.reps) as max_reps,
       MAX(ws.weight * ws.reps) as max_volume,
       COUNT(*) as total_sets,
       SUM(ws.reps) as total_reps
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE w.user_id = ? AND ws.exercise_id = ? AND ws.completed = 1`,
    [userId, exerciseId],
  );
  return {
    maxWeight: r?.max_weight ?? null,
    maxReps: r?.max_reps ?? null,
    maxVolume: r?.max_volume ?? null,
    totalSets: r?.total_sets ?? 0,
    totalReps: r?.total_reps ?? 0,
  };
}

export async function getLastSetForExercise(userId: number, exerciseId: number): Promise<WorkoutSet | null> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT ws.* FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     WHERE w.user_id = ? AND ws.exercise_id = ? AND ws.completed = 1
     ORDER BY ws.created_at DESC LIMIT 1`,
    [userId, exerciseId],
  );
  return r ? rowToSet(r) : null;
}

export async function workoutsByDate(userId: number, dateKey: string): Promise<Workout[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    `SELECT * FROM workouts
     WHERE user_id = ? AND ended_at IS NOT NULL
       AND date(started_at / 1000, 'unixepoch', 'localtime') = ?
     ORDER BY started_at DESC`,
    [userId, dateKey],
  );
  return rs.map(rowToWorkout);
}

export async function rangeWorkoutSummary(userId: number, startMs: number, endMs: number): Promise<{
  count: number; totalExp: number; totalVolume: number; totalDurSec: number; uniqueDays: number;
}> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT COUNT(*) as c,
       COALESCE(SUM(total_exp), 0) as e,
       COALESCE(SUM(total_volume), 0) as v,
       COALESCE(SUM(duration_sec), 0) as d,
       COUNT(DISTINCT date(started_at / 1000, 'unixepoch', 'localtime')) as ud
     FROM workouts
     WHERE user_id = ? AND ended_at IS NOT NULL
     AND started_at BETWEEN ? AND ?`,
    [userId, startMs, endMs],
  );
  return {
    count: r?.c ?? 0,
    totalExp: r?.e ?? 0,
    totalVolume: r?.v ?? 0,
    totalDurSec: r?.d ?? 0,
    uniqueDays: r?.ud ?? 0,
  };
}

export async function rangeMealSummary(userId: number, startMs: number, endMs: number): Promise<{
  count: number; uniqueDays: number;
  totalCalories: number; totalProtein: number; totalCarb: number; totalFat: number;
  avgCalPerDay: number; avgProteinPerDay: number;
}> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT COUNT(*) as c,
       COUNT(DISTINCT date(logged_at / 1000, 'unixepoch', 'localtime')) as ud,
       COALESCE(SUM(calories_kcal), 0) as cal,
       COALESCE(SUM(protein_g), 0) as p,
       COALESCE(SUM(carb_g), 0) as cb,
       COALESCE(SUM(fat_g), 0) as f
     FROM meals WHERE user_id = ?
     AND logged_at BETWEEN ? AND ?`,
    [userId, startMs, endMs],
  );
  const days = Math.max(1, r?.ud ?? 0);
  return {
    count: r?.c ?? 0,
    uniqueDays: r?.ud ?? 0,
    totalCalories: r?.cal ?? 0,
    totalProtein: r?.p ?? 0,
    totalCarb: r?.cb ?? 0,
    totalFat: r?.f ?? 0,
    avgCalPerDay: Math.round((r?.cal ?? 0) / days),
    avgProteinPerDay: Math.round((r?.p ?? 0) / days),
  };
}

export async function rangeBodyDelta(userId: number, startMs: number, endMs: number): Promise<{
  count: number;
  first: BodyMeasurement | null;
  last: BodyMeasurement | null;
  weightDelta: number | null;
  bodyFatDelta: number | null;
  muscleDelta: number | null;
}> {
  const rows = await sqliteDb.getAllAsync<Row>(
    `SELECT * FROM body_measurements
     WHERE user_id = ? AND measured_at BETWEEN ? AND ?
     ORDER BY measured_at ASC`,
    [userId, startMs, endMs],
  );
  const mapped = rows.map(rowToBodyMeasurement);
  if (mapped.length === 0) {
    return { count: 0, first: null, last: null, weightDelta: null, bodyFatDelta: null, muscleDelta: null };
  }
  const first = mapped[0];
  const last = mapped[mapped.length - 1];
  const diff = (a: number | null, b: number | null): number | null =>
    (a == null || b == null) ? null : Math.round((b - a) * 10) / 10;
  return {
    count: mapped.length,
    first,
    last,
    weightDelta: diff(first.weightKg, last.weightKg),
    bodyFatDelta: diff(first.bodyFatPct, last.bodyFatPct),
    muscleDelta: diff(first.skeletalMuscleKg, last.skeletalMuscleKg),
  };
}

export async function weeklyWorkoutCount(userId: number): Promise<number> {
  const monday = new Date();
  const day = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(monday.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);

  const r = await sqliteDb.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT date(started_at / 1000, 'unixepoch', 'localtime')) as count
     FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL AND started_at >= ?`,
    [userId, monday.getTime()],
  );
  return r?.count ?? 0;
}

export async function listRoutines(userId: number): Promise<Routine[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM routines WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rs.map(rowToRoutine);
}

export async function getRoutine(id: number): Promise<Routine | null> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT * FROM routines WHERE id = ?', [id]);
  return r ? rowToRoutine(r) : null;
}

export async function createRoutine(data: { userId: number; name: string; emoji?: string; note?: string }): Promise<number> {
  const result = await sqliteDb.runAsync(
    'INSERT INTO routines (user_id, name, emoji, note, created_at) VALUES (?, ?, ?, ?, ?)',
    [data.userId, data.name, data.emoji ?? '💪', data.note ?? null, Date.now()],
  );
  return result.lastInsertRowId as number;
}

export async function updateRoutine(id: number, patch: { name?: string; emoji?: string; note?: string }): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.emoji !== undefined) { fields.push('emoji = ?'); values.push(patch.emoji); }
  if (patch.note !== undefined) { fields.push('note = ?'); values.push(patch.note); }
  if (!fields.length) return;
  values.push(id);
  await sqliteDb.runAsync(`UPDATE routines SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteRoutine(id: number): Promise<void> {
  const reRows = await sqliteDb.getAllAsync<Row>('SELECT id FROM routine_exercises WHERE routine_id = ?', [id]);
  for (const re of reRows) await enqueueRemoteDelete('routine_exercises', re.id);
  await enqueueRemoteDelete('routines', id);
  await sqliteDb.runAsync('DELETE FROM routine_exercises WHERE routine_id = ?', [id]);
  await sqliteDb.runAsync('DELETE FROM routines WHERE id = ?', [id]);
}

export async function updateRoutineSnapshot(id: number, snapshotJson: string): Promise<void> {
  await sqliteDb.runAsync(
    'UPDATE routines SET last_snapshot_json = ?, last_saved_at = ? WHERE id = ?',
    [snapshotJson, Date.now(), id],
  );
}

export async function listRoutineExercises(routineId: number): Promise<RoutineExercise[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY order_idx ASC',
    [routineId],
  );
  return rs.map(rowToRoutineExercise);
}

export async function addExerciseToRoutine(data: { routineId: number; exerciseId: number; orderIdx: number; targetSets?: number }): Promise<number> {
  const result = await sqliteDb.runAsync(
    'INSERT INTO routine_exercises (routine_id, exercise_id, order_idx, target_sets) VALUES (?, ?, ?, ?)',
    [data.routineId, data.exerciseId, data.orderIdx, data.targetSets ?? 3],
  );
  return result.lastInsertRowId as number;
}

export async function removeExerciseFromRoutine(id: number): Promise<void> {
  await enqueueRemoteDelete('routine_exercises', id);
  await sqliteDb.runAsync('DELETE FROM routine_exercises WHERE id = ?', [id]);
}

export async function duplicateRoutine(routineId: number, userId: number): Promise<number> {
  const orig = await getRoutine(routineId);
  if (!orig) throw new Error('routine not found');
  const newId = await createRoutine({
    userId,
    name: `${orig.name} (複本)`,
    emoji: orig.emoji,
    note: orig.note ?? undefined,
  });
  const rexs = await listRoutineExercises(routineId);
  for (const r of rexs) {
    await addExerciseToRoutine({
      routineId: newId,
      exerciseId: r.exerciseId,
      orderIdx: r.orderIdx,
      targetSets: r.targetSets,
    });
  }
  return newId;
}

export async function updateRoutineExercise(id: number, patch: { targetSets?: number; orderIdx?: number }): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];
  if (patch.targetSets !== undefined) { fields.push('target_sets = ?'); values.push(patch.targetSets); }
  if (patch.orderIdx !== undefined) { fields.push('order_idx = ?'); values.push(patch.orderIdx); }
  if (!fields.length) return;
  values.push(id);
  await sqliteDb.runAsync(`UPDATE routine_exercises SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function listMealsByDate(userId: number, dateKey: string): Promise<Meal[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    `SELECT * FROM meals
     WHERE user_id = ?
       AND date(logged_at / 1000, 'unixepoch', 'localtime') = ?
     ORDER BY logged_at ASC`,
    [userId, dateKey],
  );
  return rs.map(rowToMeal);
}

export async function listMealDates(userId: number, limit = 30): Promise<string[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    `SELECT DISTINCT date(logged_at / 1000, 'unixepoch', 'localtime') as d
     FROM meals WHERE user_id = ?
     ORDER BY d DESC LIMIT ?`,
    [userId, limit],
  );
  return rs.map((r) => r.d);
}

export async function getMeal(id: number): Promise<Meal | null> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT * FROM meals WHERE id = ?', [id]);
  return r ? rowToMeal(r) : null;
}

export async function createMeal(data: Omit<NewMeal, 'id' | 'createdAt'> & { loggedAt: Date | number }): Promise<number> {
  const result = await sqliteDb.runAsync(
    `INSERT INTO meals
       (user_id, logged_at, meal_type, title, items_json, calories_kcal, protein_g, carb_g, fat_g, photo_uri, note, ai_parsed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      typeof data.loggedAt === 'number' ? data.loggedAt : data.loggedAt.getTime(),
      data.mealType,
      data.title ?? null,
      data.itemsJson ?? null,
      data.caloriesKcal ?? null,
      data.proteinG ?? null,
      data.carbG ?? null,
      data.fatG ?? null,
      data.photoUri ?? null,
      data.note ?? null,
      data.aiParsed ? 1 : 0,
      Date.now(),
    ],
  );
  return result.lastInsertRowId as number;
}

export async function updateMeal(id: number, patch: Partial<{
  loggedAt: number; mealType: string; title: string | null; itemsJson: string | null;
  caloriesKcal: number | null; proteinG: number | null; carbG: number | null; fatG: number | null;
  photoUri: string | null; note: string | null;
}>): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  if (patch.loggedAt !== undefined) { fields.push('logged_at = ?'); values.push(patch.loggedAt); }
  if (patch.mealType !== undefined) { fields.push('meal_type = ?'); values.push(patch.mealType); }
  if (patch.title !== undefined) { fields.push('title = ?'); values.push(patch.title); }
  if (patch.itemsJson !== undefined) { fields.push('items_json = ?'); values.push(patch.itemsJson); }
  if (patch.caloriesKcal !== undefined) { fields.push('calories_kcal = ?'); values.push(patch.caloriesKcal); }
  if (patch.proteinG !== undefined) { fields.push('protein_g = ?'); values.push(patch.proteinG); }
  if (patch.carbG !== undefined) { fields.push('carb_g = ?'); values.push(patch.carbG); }
  if (patch.fatG !== undefined) { fields.push('fat_g = ?'); values.push(patch.fatG); }
  if (patch.photoUri !== undefined) { fields.push('photo_uri = ?'); values.push(patch.photoUri); }
  if (patch.note !== undefined) { fields.push('note = ?'); values.push(patch.note); }
  if (fields.length === 0) return;
  values.push(id);
  await sqliteDb.runAsync(`UPDATE meals SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteMeal(id: number): Promise<void> {
  await enqueueRemoteDelete('meals', id);
  await sqliteDb.runAsync('DELETE FROM meals WHERE id = ?', [id]);
}

export async function dailyNutritionTotals(userId: number, dateKey: string): Promise<{ calories: number; protein: number; carb: number; fat: number; count: number }> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT
       COALESCE(SUM(calories_kcal), 0) as c,
       COALESCE(SUM(protein_g), 0) as p,
       COALESCE(SUM(carb_g), 0) as cb,
       COALESCE(SUM(fat_g), 0) as f,
       COUNT(*) as n
     FROM meals WHERE user_id = ?
     AND date(logged_at / 1000, 'unixepoch', 'localtime') = ?`,
    [userId, dateKey],
  );
  return {
    calories: r?.c ?? 0,
    protein: r?.p ?? 0,
    carb: r?.cb ?? 0,
    fat: r?.f ?? 0,
    count: r?.n ?? 0,
  };
}

export async function listBodyMeasurements(userId: number, limit = 100): Promise<BodyMeasurement[]> {
  const rs = await sqliteDb.getAllAsync<Row>(
    'SELECT * FROM body_measurements WHERE user_id = ? ORDER BY measured_at DESC LIMIT ?',
    [userId, limit],
  );
  return rs.map(rowToBodyMeasurement);
}

export async function getBodyMeasurement(id: number): Promise<BodyMeasurement | null> {
  const r = await sqliteDb.getFirstAsync<Row>('SELECT * FROM body_measurements WHERE id = ?', [id]);
  return r ? rowToBodyMeasurement(r) : null;
}

export async function createBodyMeasurement(data: Omit<NewBodyMeasurement, 'id' | 'createdAt'> & { measuredAt: Date | number }): Promise<number> {
  const result = await sqliteDb.runAsync(
    `INSERT INTO body_measurements
      (user_id, measured_at, weight_kg, body_fat_pct, skeletal_muscle_kg, muscle_mass_kg,
       protein_kg, body_fat_kg, mineral_kg, body_water_kg, bmr, visceral_fat_level,
       body_score, photo_uri, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.userId,
      typeof data.measuredAt === 'number' ? data.measuredAt : data.measuredAt.getTime(),
      data.weightKg ?? null,
      data.bodyFatPct ?? null,
      data.skeletalMuscleKg ?? null,
      data.muscleMassKg ?? null,
      data.proteinKg ?? null,
      data.bodyFatKg ?? null,
      data.mineralKg ?? null,
      data.bodyWaterKg ?? null,
      data.bmr ?? null,
      data.visceralFatLevel ?? null,
      data.bodyScore ?? null,
      data.photoUri ?? null,
      data.note ?? null,
      Date.now(),
    ],
  );
  return result.lastInsertRowId as number;
}

export async function deleteBodyMeasurement(id: number): Promise<void> {
  await enqueueRemoteDelete('body_measurements', id);
  await sqliteDb.runAsync('DELETE FROM body_measurements WHERE id = ?', [id]);
}

export async function recentWorkoutDates(userId: number, limit = 30): Promise<string[]> {
  const rows = await sqliteDb.getAllAsync<Row>(
    `SELECT DISTINCT date(started_at / 1000, 'unixepoch', 'localtime') as d
     FROM workouts WHERE user_id = ? AND ended_at IS NOT NULL
     ORDER BY d DESC LIMIT ?`,
    [userId, limit],
  );
  return rows.map(r => r.d);
}

// ===== Custom Foods（plan v5）=====

import type { CustomFood, NewCustomFood } from './schema';

const rowToCustomFood = (r: Row): CustomFood => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  emoji: r.emoji,
  caloriesKcal: r.calories_kcal,
  proteinG: r.protein_g,
  carbG: r.carb_g,
  fatG: r.fat_g,
  portion: r.portion,
  photoUri: r.photo_uri,
  source: r.source,
  useCount: r.use_count,
  lastUsedAt: r.last_used_at ? new Date(r.last_used_at) : null,
  createdAt: new Date(r.created_at),
});

export async function listCustomFoods(userId: number, opts?: { searchQuery?: string }): Promise<CustomFood[]> {
  const q = opts?.searchQuery?.trim();
  let rows: Row[];
  if (q) {
    rows = await sqliteDb.getAllAsync<Row>(
      `SELECT * FROM custom_foods WHERE user_id = ? AND name LIKE ?
       ORDER BY use_count DESC, last_used_at DESC, created_at DESC`,
      [userId, `%${q}%`],
    );
  } else {
    rows = await sqliteDb.getAllAsync<Row>(
      `SELECT * FROM custom_foods WHERE user_id = ?
       ORDER BY use_count DESC, last_used_at DESC, created_at DESC`,
      [userId],
    );
  }
  return rows.map(rowToCustomFood);
}

export async function getCustomFood(id: number): Promise<CustomFood | null> {
  const r = await sqliteDb.getFirstAsync<Row>(`SELECT * FROM custom_foods WHERE id = ?`, [id]);
  return r ? rowToCustomFood(r) : null;
}

export async function findCustomFoodByName(userId: number, name: string): Promise<CustomFood | null> {
  const r = await sqliteDb.getFirstAsync<Row>(
    `SELECT * FROM custom_foods WHERE user_id = ? AND LOWER(name) = LOWER(?)`,
    [userId, name],
  );
  return r ? rowToCustomFood(r) : null;
}

export async function createCustomFood(data: {
  userId: number; name: string; emoji?: string;
  caloriesKcal: number; proteinG: number; carbG: number; fatG: number;
  portion?: string | null; photoUri?: string | null; source?: 'manual' | 'ai';
}): Promise<number> {
  const r = await sqliteDb.runAsync(
    `INSERT INTO custom_foods (user_id, name, emoji, calories_kcal, protein_g, carb_g, fat_g, portion, photo_uri, source, use_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      data.userId, data.name, data.emoji ?? '🍽',
      data.caloriesKcal, data.proteinG, data.carbG, data.fatG,
      data.portion ?? null, data.photoUri ?? null, data.source ?? 'manual',
      Date.now(),
    ],
  );
  return Number(r.lastInsertRowId);
}

export async function updateCustomFood(id: number, patch: Partial<{
  name: string; emoji: string;
  caloriesKcal: number; proteinG: number; carbG: number; fatG: number;
  portion: string | null; photoUri: string | null;
}>): Promise<void> {
  const fields: string[] = []; const values: any[] = [];
  if (patch.name !== undefined) { fields.push('name = ?'); values.push(patch.name); }
  if (patch.emoji !== undefined) { fields.push('emoji = ?'); values.push(patch.emoji); }
  if (patch.caloriesKcal !== undefined) { fields.push('calories_kcal = ?'); values.push(patch.caloriesKcal); }
  if (patch.proteinG !== undefined) { fields.push('protein_g = ?'); values.push(patch.proteinG); }
  if (patch.carbG !== undefined) { fields.push('carb_g = ?'); values.push(patch.carbG); }
  if (patch.fatG !== undefined) { fields.push('fat_g = ?'); values.push(patch.fatG); }
  if (patch.portion !== undefined) { fields.push('portion = ?'); values.push(patch.portion); }
  if (patch.photoUri !== undefined) { fields.push('photo_uri = ?'); values.push(patch.photoUri); }
  if (fields.length === 0) return;
  values.push(id);
  await sqliteDb.runAsync(`UPDATE custom_foods SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteCustomFood(id: number): Promise<void> {
  await enqueueRemoteDelete('custom_foods', id);
  await sqliteDb.runAsync(`DELETE FROM custom_foods WHERE id = ?`, [id]);
}

export async function incrementCustomFoodUse(id: number): Promise<void> {
  await sqliteDb.runAsync(
    `UPDATE custom_foods SET use_count = use_count + 1, last_used_at = ? WHERE id = ?`,
    [Date.now(), id],
  );
}
