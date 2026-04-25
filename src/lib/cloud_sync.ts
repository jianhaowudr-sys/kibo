import { supabase, isSupabaseConfigured } from './supabase';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// Convert ms timestamp / Date / string → ISO string for Supabase timestamptz
function toISO(v: any): string | null {
  if (v == null) return null;
  if (typeof v === 'number') return new Date(v).toISOString();
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

// Convert ISO string from Supabase → ms number for SQLite timestamp_ms
function toMs(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  return new Date(v).getTime();
}

async function getExerciseNameUnit(exerciseId: number): Promise<{ name: string; unit: string }> {
  const ex = await db.select().from(schema.exercises).where(eq(schema.exercises.id, exerciseId)).limit(1);
  if (ex.length === 0) return { name: 'Unknown', unit: 'reps' };
  return { name: ex[0].name, unit: ex[0].unit };
}

async function findOrCreateExercise(name: string, unit: string): Promise<number> {
  const found = await db.select().from(schema.exercises).where(eq(schema.exercises.name, name)).limit(1);
  if (found.length > 0) return found[0].id;
  const inserted = await db.insert(schema.exercises).values({
    name,
    category: 'strength',
    muscleGroup: '其他',
    part: '其他',
    equipment: '其他',
    unit: unit as any,
    icon: 'dumbbell',
    expPerUnit: 1,
    isCustom: true,
    seedVersion: 1,
  }).returning({ id: schema.exercises.id });
  return inserted[0].id;
}

// ============================================================
// Push: local SQLite → Supabase (upsert by user_id+local_id)
// ============================================================
async function pushProfile(userId: string) {
  const rows = await db.select().from(schema.users).limit(1);
  if (rows.length === 0) return;
  const u = rows[0];
  await supabase.from('profiles').upsert({
    user_id: userId,
    name: u.name,
    height_cm: u.heightCm,
    weight_kg: u.weightKg,
    goal: u.goal,
    daily_exp_goal: u.dailyExpGoal,
    weekly_days_goal: u.weeklyDaysGoal,
    daily_calories_goal: u.dailyCaloriesGoal,
    daily_protein_goal: u.dailyProteinGoal,
    streak: u.streak,
    last_workout_date: u.lastWorkoutDate,
    total_workouts: u.totalWorkouts,
    total_exp: u.totalExp,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

async function pushWorkouts(userId: string) {
  const rows = await db.select().from(schema.workouts);
  if (rows.length === 0) return;
  const payload = rows.map((w) => ({
    user_id: userId,
    local_id: w.id,
    started_at: toISO(w.startedAt),
    ended_at: toISO(w.endedAt),
    note: w.note,
    total_exp: w.totalExp,
    total_volume: w.totalVolume,
    duration_sec: w.durationSec,
    updated_at: new Date().toISOString(),
  }));
  await supabase.from('workouts').upsert(payload, { onConflict: 'user_id,local_id' });
}

async function pushWorkoutSets(userId: string) {
  const rows = await db.select().from(schema.workoutSets);
  if (rows.length === 0) return;
  const payload = await Promise.all(rows.map(async (s) => {
    const { name, unit } = await getExerciseNameUnit(s.exerciseId);
    return {
      user_id: userId,
      local_id: s.id,
      workout_local_id: s.workoutId,
      exercise_name: name,
      exercise_unit: unit,
      order_idx: s.orderIdx,
      weight: s.weight,
      reps: s.reps,
      duration_sec: s.durationSec,
      distance_m: s.distanceM,
      completed: s.completed,
      exp: s.exp,
      created_at: toISO(s.createdAt),
      updated_at: new Date().toISOString(),
    };
  }));
  // Chunk by 500 to avoid request size limit
  for (let i = 0; i < payload.length; i += 500) {
    await supabase.from('workout_sets').upsert(payload.slice(i, i + 500), { onConflict: 'user_id,local_id' });
  }
}

async function pushMeals(userId: string) {
  const rows = await db.select().from(schema.meals);
  if (rows.length === 0) return;
  const payload = rows.map((m) => ({
    user_id: userId,
    local_id: m.id,
    logged_at: toISO(m.loggedAt),
    meal_type: m.mealType,
    title: m.title,
    items_json: m.itemsJson ? JSON.parse(m.itemsJson) : null,
    calories_kcal: m.caloriesKcal,
    protein_g: m.proteinG,
    carb_g: m.carbG,
    fat_g: m.fatG,
    photo_uri: m.photoUri,
    note: m.note,
    ai_parsed: m.aiParsed,
    created_at: toISO(m.createdAt),
    updated_at: new Date().toISOString(),
  }));
  await supabase.from('meals').upsert(payload, { onConflict: 'user_id,local_id' });
}

async function pushBody(userId: string) {
  const rows = await db.select().from(schema.bodyMeasurements);
  if (rows.length === 0) return;
  const payload = rows.map((b) => ({
    user_id: userId,
    local_id: b.id,
    measured_at: toISO(b.measuredAt),
    weight_kg: b.weightKg,
    body_fat_pct: b.bodyFatPct,
    skeletal_muscle_kg: b.skeletalMuscleKg,
    muscle_mass_kg: b.muscleMassKg,
    protein_kg: b.proteinKg,
    body_fat_kg: b.bodyFatKg,
    mineral_kg: b.mineralKg,
    body_water_kg: b.bodyWaterKg,
    bmr: b.bmr,
    visceral_fat_level: b.visceralFatLevel,
    body_score: b.bodyScore,
    photo_uri: b.photoUri,
    note: b.note,
    created_at: toISO(b.createdAt),
    updated_at: new Date().toISOString(),
  }));
  await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,local_id' });
}

async function pushRoutines(userId: string) {
  const rs = await db.select().from(schema.routines);
  if (rs.length > 0) {
    const payload = rs.map((r) => ({
      user_id: userId,
      local_id: r.id,
      name: r.name,
      emoji: r.emoji,
      note: r.note,
      last_snapshot_json: r.lastSnapshotJson ? JSON.parse(r.lastSnapshotJson) : null,
      last_saved_at: toISO(r.lastSavedAt),
      created_at: toISO(r.createdAt),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('routines').upsert(payload, { onConflict: 'user_id,local_id' });
  }
  const re = await db.select().from(schema.routineExercises);
  if (re.length > 0) {
    const payload = await Promise.all(re.map(async (x) => {
      const { name, unit } = await getExerciseNameUnit(x.exerciseId);
      return {
        user_id: userId,
        local_id: x.id,
        routine_local_id: x.routineId,
        exercise_name: name,
        exercise_unit: unit,
        order_idx: x.orderIdx,
        target_sets: x.targetSets,
        updated_at: new Date().toISOString(),
      };
    }));
    await supabase.from('routine_exercises').upsert(payload, { onConflict: 'user_id,local_id' });
  }
}

async function pushEggsPets(userId: string) {
  const eggs = await db.select().from(schema.eggs);
  if (eggs.length > 0) {
    const payload = eggs.map((e) => ({
      user_id: userId,
      local_id: e.id,
      type: e.type,
      current_exp: e.currentExp,
      required_exp: e.requiredExp,
      stage: e.stage,
      hatched_at: toISO(e.hatchedAt),
      pet_local_id: e.petId,
      created_at: toISO(e.createdAt),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('eggs').upsert(payload, { onConflict: 'user_id,local_id' });
  }
  const pets = await db.select().from(schema.pets);
  if (pets.length > 0) {
    const payload = pets.map((p) => ({
      user_id: userId,
      local_id: p.id,
      egg_local_id: p.eggId,
      name: p.name,
      species: p.species,
      type: p.type,
      level: p.level,
      exp: p.exp,
      stage: p.stage,
      emoji: p.emoji,
      created_at: toISO(p.createdAt),
      updated_at: new Date().toISOString(),
    }));
    await supabase.from('pets').upsert(payload, { onConflict: 'user_id,local_id' });
  }
}

async function pushAchievements(userId: string) {
  const rows = await db.select().from(schema.achievements);
  if (rows.length === 0) return;
  const payload = rows.map((a) => ({
    user_id: userId,
    local_id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    unlocked_at: toISO(a.unlockedAt),
    updated_at: new Date().toISOString(),
  }));
  await supabase.from('achievements').upsert(payload, { onConflict: 'user_id,local_id' });
}

// ============================================================
// Pull: Supabase → local SQLite (insert if local doesn't have local_id; skip if exists)
// First sync only — afterwards both sides authoritative via updated_at
// ============================================================
async function pullProfile(userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (!data) return;
  const existing = await db.select().from(schema.users).limit(1);
  if (existing.length === 0) return;
  await db.update(schema.users).set({
    name: data.name,
    heightCm: data.height_cm,
    weightKg: data.weight_kg,
    goal: data.goal,
    dailyExpGoal: data.daily_exp_goal,
    weeklyDaysGoal: data.weekly_days_goal,
    dailyCaloriesGoal: data.daily_calories_goal,
    dailyProteinGoal: data.daily_protein_goal,
    streak: data.streak,
    lastWorkoutDate: data.last_workout_date,
    totalWorkouts: data.total_workouts,
    totalExp: data.total_exp,
  }).where(eq(schema.users.id, existing[0].id));
}

async function pullTable<T extends { local_id: number }>(
  userId: string,
  table: string,
): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as T[];
}

async function pullWorkouts(userId: string) {
  const cloud = await pullTable<any>(userId, 'workouts');
  if (cloud.length === 0) return;
  const localIds = new Set((await db.select({ id: schema.workouts.id }).from(schema.workouts)).map((r) => r.id));
  for (const w of cloud) {
    if (localIds.has(w.local_id)) continue;
    const meId = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id;
    if (!meId) continue;
    await db.insert(schema.workouts).values({
      id: w.local_id,
      userId: meId,
      startedAt: new Date(w.started_at),
      endedAt: w.ended_at ? new Date(w.ended_at) : null,
      note: w.note,
      totalExp: w.total_exp,
      totalVolume: w.total_volume,
      durationSec: w.duration_sec,
    } as any);
  }
}

async function pullWorkoutSets(userId: string) {
  const cloud = await pullTable<any>(userId, 'workout_sets');
  if (cloud.length === 0) return;
  const localIds = new Set((await db.select({ id: schema.workoutSets.id }).from(schema.workoutSets)).map((r) => r.id));
  for (const s of cloud) {
    if (localIds.has(s.local_id)) continue;
    const exId = await findOrCreateExercise(s.exercise_name, s.exercise_unit);
    await db.insert(schema.workoutSets).values({
      id: s.local_id,
      workoutId: s.workout_local_id,
      exerciseId: exId,
      orderIdx: s.order_idx,
      weight: s.weight,
      reps: s.reps,
      durationSec: s.duration_sec,
      distanceM: s.distance_m,
      completed: s.completed,
      exp: s.exp,
      createdAt: new Date(s.created_at),
    } as any);
  }
}

async function pullMeals(userId: string) {
  const cloud = await pullTable<any>(userId, 'meals');
  if (cloud.length === 0) return;
  const localIds = new Set((await db.select({ id: schema.meals.id }).from(schema.meals)).map((r) => r.id));
  const meId = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id;
  if (!meId) return;
  for (const m of cloud) {
    if (localIds.has(m.local_id)) continue;
    await db.insert(schema.meals).values({
      id: m.local_id,
      userId: meId,
      loggedAt: new Date(m.logged_at),
      mealType: m.meal_type,
      title: m.title,
      itemsJson: m.items_json ? JSON.stringify(m.items_json) : null,
      caloriesKcal: m.calories_kcal,
      proteinG: m.protein_g,
      carbG: m.carb_g,
      fatG: m.fat_g,
      photoUri: m.photo_uri,
      note: m.note,
      aiParsed: m.ai_parsed,
      createdAt: new Date(m.created_at),
    } as any);
  }
}

async function pullBody(userId: string) {
  const cloud = await pullTable<any>(userId, 'body_measurements');
  if (cloud.length === 0) return;
  const localIds = new Set((await db.select({ id: schema.bodyMeasurements.id }).from(schema.bodyMeasurements)).map((r) => r.id));
  const meId = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id;
  if (!meId) return;
  for (const b of cloud) {
    if (localIds.has(b.local_id)) continue;
    await db.insert(schema.bodyMeasurements).values({
      id: b.local_id,
      userId: meId,
      measuredAt: new Date(b.measured_at),
      weightKg: b.weight_kg,
      bodyFatPct: b.body_fat_pct,
      skeletalMuscleKg: b.skeletal_muscle_kg,
      muscleMassKg: b.muscle_mass_kg,
      proteinKg: b.protein_kg,
      bodyFatKg: b.body_fat_kg,
      mineralKg: b.mineral_kg,
      bodyWaterKg: b.body_water_kg,
      bmr: b.bmr,
      visceralFatLevel: b.visceral_fat_level,
      bodyScore: b.body_score,
      photoUri: b.photo_uri,
      note: b.note,
      createdAt: new Date(b.created_at),
    } as any);
  }
}

// ============================================================
// Public API
// ============================================================
export type SyncStats = {
  pushedWorkouts: number;
  pushedSets: number;
  pushedMeals: number;
  pushedBody: number;
  pulledWorkouts: number;
  pulledSets: number;
  pulledMeals: number;
  pulledBody: number;
};

export async function fullSync(userId: string): Promise<SyncStats> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未設定');

  const stats: SyncStats = {
    pushedWorkouts: 0, pushedSets: 0, pushedMeals: 0, pushedBody: 0,
    pulledWorkouts: 0, pulledSets: 0, pulledMeals: 0, pulledBody: 0,
  };

  const [w0, s0, m0, b0] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.workouts),
    db.select({ c: sql<number>`count(*)` }).from(schema.workoutSets),
    db.select({ c: sql<number>`count(*)` }).from(schema.meals),
    db.select({ c: sql<number>`count(*)` }).from(schema.bodyMeasurements),
  ]);

  await pushProfile(userId);
  await pushWorkouts(userId);
  await pushWorkoutSets(userId);
  await pushMeals(userId);
  await pushBody(userId);
  await pushRoutines(userId);
  await pushEggsPets(userId);
  await pushAchievements(userId);

  stats.pushedWorkouts = Number(w0[0]?.c ?? 0);
  stats.pushedSets = Number(s0[0]?.c ?? 0);
  stats.pushedMeals = Number(m0[0]?.c ?? 0);
  stats.pushedBody = Number(b0[0]?.c ?? 0);

  await pullProfile(userId);
  await pullWorkouts(userId);
  await pullWorkoutSets(userId);
  await pullMeals(userId);
  await pullBody(userId);

  const [w1, s1, m1, b1] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.workouts),
    db.select({ c: sql<number>`count(*)` }).from(schema.workoutSets),
    db.select({ c: sql<number>`count(*)` }).from(schema.meals),
    db.select({ c: sql<number>`count(*)` }).from(schema.bodyMeasurements),
  ]);

  stats.pulledWorkouts = Math.max(0, Number(w1[0]?.c ?? 0) - stats.pushedWorkouts);
  stats.pulledSets = Math.max(0, Number(s1[0]?.c ?? 0) - stats.pushedSets);
  stats.pulledMeals = Math.max(0, Number(m1[0]?.c ?? 0) - stats.pushedMeals);
  stats.pulledBody = Math.max(0, Number(b1[0]?.c ?? 0) - stats.pushedBody);

  return stats;
}
