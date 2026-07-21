import { supabase, isSupabaseConfigured } from './supabase';
import { db, sqliteDb } from '@/db/client';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { listPendingDeletions, clearPendingDeletion } from '@/db/repo';
import { planPull, planReconcile } from './sync_core';
import * as Crypto from 'expo-crypto';

/** 本次同步累積的警告（原本被 catch {} 吞掉的錯誤改為浮出，可診斷）。 */
let _warnings: string[] = [];
function warn(where: string, e: any) {
  const msg = e?.message ?? String(e);
  _warnings.push(`${where}: ${msg}`);
  console.warn('[sync]', where, msg);
}

/**
 * Capability probe：偵測雲端是否已跑 005（有 client_uuid 欄）。
 * 未跑 → 全程走 legacy local_id 路徑（與 v1.0.7 行為完全相同，零回歸）。
 * 已跑 → 走 sync_uuid 路徑（修 P0-3 重裝/多裝置覆蓋）。
 * 讓「先出 app」或「先跑 migration」兩種次序都安全。
 */
/**
 * ⚠️ KILL SWITCH：UUID 同步路徑目前**停用**。
 * 深審(2026-07-13)在 cap=true 路徑找到 6 個 P0：
 *  A) reconcile 配的 orphan uuid 被隨後的 push(onConflict: user_id,local_id)整列覆蓋 → 重裝時雲端舊資料被銷毀
 *  B) workout_sets natural key 本地給 workout_id、雲端要 workout_client_uuid → 永遠不符
 *  C) legacy workout_sets 的 workout_client_uuid 為 NULL → pull 全略過 → workout 還原後零組 set
 *  D) adopt 後下一次 push 違反 unique(user_id,client_uuid) → 該表 push 從此永久失敗
 *  E) 006 一跑,v1.1.0 自己的 push 也會 42P10 全掛(onConflict 仍是 local_id;且 005 的 partial index
 *     無法被 PostgREST 推論)
 *  F) 刪除鏈仍用 local_id → pull 發新號後會刪錯雲端別筆資料
 * 根因:識別鍵(client_uuid)與寫入鍵(onConflict local_id)不一致,需連同 005 index 形狀一起重新設計。
 * 修好並在測試 Supabase 專案演練通過前,不得對真實使用者啟用。
 * false 時即使雲端已跑 005 也一律走 legacy 路徑(與 v1.0.7 行為完全相同)。
 */
const ENABLE_UUID_SYNC = false;

let _uuidCap: boolean | null = null;
async function hasUuidCapability(): Promise<boolean> {
  if (!ENABLE_UUID_SYNC) return false;
  if (_uuidCap !== null) return _uuidCap;
  try {
    const { error } = await supabase.from('workouts').select('client_uuid').limit(1);
    _uuidCap = !error;
  } catch {
    _uuidCap = false;
  }
  if (!_uuidCap) _warnings.push('雲端尚未套用 005 migration，本次走 legacy 同步路徑');
  return _uuidCap;
}

/** 本地某表 id → sync_uuid（sync_uuid 由 runAdditions 加欄，不在 drizzle schema，故用 raw SQL）。 */
async function localUuidById(table: string): Promise<Map<number, string>> {
  try {
    const rows = await sqliteDb.getAllAsync<{ id: number; sync_uuid: string | null }>(
      `SELECT id, sync_uuid FROM "${table}"`,
    );
    return new Map(rows.filter((r) => !!r.sync_uuid).map((r) => [r.id, r.sync_uuid as string]));
  } catch {
    return new Map();
  }
}

/** 本地某表已有的 sync_uuid 集合（pull 比對用）。 */
async function localUuidSet(table: string): Promise<Set<string>> {
  const m = await localUuidById(table);
  return new Set(m.values());
}

/** 把 client_uuid 併進 push payload（僅在雲端支援時）。 */
function withUuid<T extends Record<string, any>>(row: T, uuid: string | undefined, cap: boolean): T {
  return cap && uuid ? ({ ...row, client_uuid: uuid } as T) : row;
}

// 已知會雲端同步的表 — 只 flush 這些，避免有人 enqueue 了 typo 字串就誤刪
const SYNCABLE_TABLES = new Set([
  'meals', 'workouts', 'workout_sets', 'body_measurements',
  'routines', 'routine_exercises', 'custom_foods',
  'water_logs', 'bowel_logs', 'sleep_logs', 'period_days',
]);

/**
 * 把本地排隊的 (table, local_id) 真的去 Supabase delete 掉。
 * 成功 → clear 該 row；失敗（網路/RLS）→ 留著下次 fullSync 再試。
 */
async function flushPendingDeletions(userId: string): Promise<void> {
  const queue = await listPendingDeletions();
  for (const item of queue) {
    if (!SYNCABLE_TABLES.has(item.tableName)) {
      await clearPendingDeletion(item.id);
      continue;
    }
    try {
      const { error } = await supabase
        .from(item.tableName)
        .delete()
        .eq('user_id', userId)
        .eq('local_id', item.localId);
      if (!error) {
        await clearPendingDeletion(item.id);
      }
    } catch {
      // 留在 queue，下次再 flush
    }
  }
}

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
/**
 * Profile push（defensive）：原本無 try/catch 且是 fullSync 第一步，若線上 profiles 缺
 * health_settings/dashboard_layout/... 欄（005 未跑）會讓整個同步 throw。
 * 現在：欄位不存在（42703 / PGRST204）→ 用 001+003 已知存在的子集重試一次；仍失敗只記 warning，絕不中斷同步。
 */
async function pushProfile(userId: string) {
  const rows = await db.select().from(schema.users).limit(1);
  if (rows.length === 0) return;
  const u = rows[0];

  // 001 + 003 保證存在的核心欄位
  const core = {
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
    consecutive_days: (u as any).consecutiveDays ?? 0,
    last_active_day: (u as any).lastActiveDay ?? null,
    next_egg_rarity_floor: (u as any).nextEggRarityFloor ?? null,
    updated_at: new Date().toISOString(),
  };
  // 005 之後才保證存在的欄位
  const extended = {
    ...core,
    health_settings: u.healthSettings ?? null,
    dashboard_layout: u.dashboardLayout ?? null,
    streak_freeze_tokens: u.streakFreezeTokens ?? 0,
    onboarding_completed_at: toISO(u.onboardingCompletedAt),
  };

  try {
    const { error } = await supabase.from('profiles').upsert(extended, { onConflict: 'user_id' });
    if (!error) return;
    const code = (error as any)?.code ?? '';
    const missingColumn = code === '42703' || code === 'PGRST204' || /column .* does not exist/i.test(error.message ?? '');
    if (!missingColumn) { warn('pushProfile', error); return; }
    // 欄位不存在 → 退回核心子集重試
    const retry = await supabase.from('profiles').upsert(core, { onConflict: 'user_id' });
    if (retry.error) warn('pushProfile(core retry)', retry.error);
    else _warnings.push('profiles 缺 005 欄位，已用核心子集同步（請跑 005 migration）');
  } catch (e) {
    warn('pushProfile', e);
  }
}

async function pushCustomFoods(userId: string, cap: boolean) {
  try {
    const rows = await db.select().from(schema.customFoods);
    if (rows.length === 0) return;
    const uuids = await localUuidById('custom_foods');
    const payload = rows.map((f) => withUuid({
      user_id: userId, local_id: f.id,
      name: f.name, emoji: f.emoji,
      calories_kcal: f.caloriesKcal, protein_g: f.proteinG, carb_g: f.carbG, fat_g: f.fatG,
      portion: f.portion, photo_uri: f.photoUri, source: f.source,
      use_count: f.useCount, last_used_at: toISO(f.lastUsedAt),
      created_at: toISO(f.createdAt), updated_at: new Date().toISOString(),
    }, uuids.get(f.id), cap));
    const { error } = await supabase.from('custom_foods').upsert(payload, { onConflict: 'user_id,local_id' });
    if (error) warn('pushCustomFoods', error);
  } catch (e) { warn('pushCustomFoods', e); }
}

async function pushHealthTables(userId: string, cap: boolean) {
  // 4 個健康表的 push。005 之前線上沒有這些表 → 錯誤原本被 catch{} 吞掉（使用者誤以為有備份）；
  // 現在改為記入 warnings 浮出。
  try {
    const water = await db.select().from(schema.waterLogs);
    if (water.length > 0) {
      const uuids = await localUuidById('water_logs');
      const payload = water.map((w) => withUuid({
        user_id: userId, local_id: w.id,
        amount_ml: w.amountMl, logged_at: toISO(w.loggedAt),
        batch_key: w.batchKey, created_at: toISO(w.createdAt),
        updated_at: new Date().toISOString(),
      }, uuids.get(w.id), cap));
      const { error } = await supabase.from('water_logs').upsert(payload, { onConflict: 'user_id,local_id' });
      if (error) warn('pushWaterLogs', error);
    }
  } catch (e) { warn('pushWaterLogs', e); }
  try {
    const bowel = await db.select().from(schema.bowelLogs);
    if (bowel.length > 0) {
      const uuids = await localUuidById('bowel_logs');
      const payload = bowel.map((b) => withUuid({
        user_id: userId, local_id: b.id,
        logged_at: toISO(b.loggedAt),
        bristol: b.bristol, has_blood: b.hasBlood, has_pain: b.hasPain,
        notes: b.notes, created_at: toISO(b.createdAt),
        updated_at: new Date().toISOString(),
      }, uuids.get(b.id), cap));
      const { error } = await supabase.from('bowel_logs').upsert(payload, { onConflict: 'user_id,local_id' });
      if (error) warn('pushBowelLogs', error);
    }
  } catch (e) { warn('pushBowelLogs', e); }
  try {
    const sleep = await db.select().from(schema.sleepLogs);
    if (sleep.length > 0) {
      const uuids = await localUuidById('sleep_logs');
      const payload = sleep.map((s) => withUuid({
        user_id: userId, local_id: s.id,
        bedtime_at: toISO(s.bedtimeAt), wake_at: toISO(s.wakeAt),
        duration_min: s.durationMin, quality: s.quality, day_key: s.dayKey,
        kind: (s as any).kind ?? 'main',
        assigned_day_key: (s as any).assignedDayKey ?? s.dayKey,
        created_at: toISO(s.createdAt), updated_at: new Date().toISOString(),
      }, uuids.get(s.id), cap));
      const { error } = await supabase.from('sleep_logs').upsert(payload, { onConflict: 'user_id,local_id' });
      if (error) warn('pushSleepLogs', error);
    }
  } catch (e) { warn('pushSleepLogs', e); }
  try {
    const period = await db.select().from(schema.periodDays);
    if (period.length > 0) {
      const uuids = await localUuidById('period_days');
      const payload = period.map((p) => withUuid({
        user_id: userId, local_id: p.id,
        date: toISO(p.date), day_key: p.dayKey,
        flow: p.flow, symptoms_json: p.symptomsJson,
        notes: p.notes, is_cycle_start: p.isCycleStart,
        created_at: toISO(p.createdAt),
        updated_at: new Date().toISOString(),
      }, uuids.get(p.id), cap));
      const { error } = await supabase.from('period_days').upsert(payload, { onConflict: 'user_id,local_id' });
      if (error) warn('pushPeriodDays', error);
    }
  } catch (e) { warn('pushPeriodDays', e); }
}

async function pushWorkouts(userId: string, cap: boolean) {
  const rows = await db.select().from(schema.workouts);
  if (rows.length === 0) return;
  const uuids = await localUuidById('workouts');
  const payload = rows.map((w) => withUuid({
    user_id: userId,
    local_id: w.id,
    started_at: toISO(w.startedAt),
    ended_at: toISO(w.endedAt),
    note: w.note,
    total_exp: w.totalExp,
    total_volume: w.totalVolume,
    duration_sec: w.durationSec,
    updated_at: new Date().toISOString(),
  }, uuids.get(w.id), cap));
  const { error } = await supabase.from('workouts').upsert(payload, { onConflict: 'user_id,local_id' });
  if (error) warn('pushWorkouts', error);
}

async function pushWorkoutSets(userId: string, cap: boolean) {
  const rows = await db.select().from(schema.workoutSets);
  if (rows.length === 0) return;
  const uuids = await localUuidById('workout_sets');
  const parentUuids = await localUuidById('workouts');  // 父鏈：pull 時用來重映 FK
  const payload = await Promise.all(rows.map(async (s) => {
    const { name, unit } = await getExerciseNameUnit(s.exerciseId);
    const base: Record<string, any> = {
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
      swim_stroke: s.swimStroke ?? null,
      incline_pct: s.inclinePct ?? null,
      speed_kmh: s.speedKmh ?? null,
      completed: s.completed,
      exp: s.exp,
      created_at: toISO(s.createdAt),
      updated_at: new Date().toISOString(),
    };
    if (cap) {
      const pu = parentUuids.get(s.workoutId);
      if (pu) base.workout_client_uuid = pu;
    }
    return withUuid(base, uuids.get(s.id), cap);
  }));
  // Chunk by 500 to avoid request size limit
  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase.from('workout_sets').upsert(payload.slice(i, i + 500), { onConflict: 'user_id,local_id' });
    if (error) { warn('pushWorkoutSets', error); break; }
  }
}

async function pushMeals(userId: string, cap: boolean) {
  const rows = await db.select().from(schema.meals);
  if (rows.length === 0) return;
  const uuids = await localUuidById('meals');
  const payload = rows.map((m) => withUuid({
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
  }, uuids.get(m.id), cap));
  const { error } = await supabase.from('meals').upsert(payload, { onConflict: 'user_id,local_id' });
  if (error) warn('pushMeals', error);
}

async function pushBody(userId: string, cap: boolean) {
  const rows = await db.select().from(schema.bodyMeasurements);
  if (rows.length === 0) return;
  const uuids = await localUuidById('body_measurements');
  const payload = rows.map((b) => withUuid({
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
  }, uuids.get(b.id), cap));
  const { error } = await supabase.from('body_measurements').upsert(payload, { onConflict: 'user_id,local_id' });
  if (error) warn('pushBody', error);
}

async function pushRoutines(userId: string, cap: boolean) {
  const routineUuids = await localUuidById('routines');
  const rs = await db.select().from(schema.routines);
  if (rs.length > 0) {
    const payload = rs.map((r) => withUuid({
      user_id: userId,
      local_id: r.id,
      name: r.name,
      emoji: r.emoji,
      note: r.note,
      last_snapshot_json: r.lastSnapshotJson ? JSON.parse(r.lastSnapshotJson) : null,
      last_saved_at: toISO(r.lastSavedAt),
      sort_order: r.sortOrder ?? 0,
      created_at: toISO(r.createdAt),
      updated_at: new Date().toISOString(),
    }, routineUuids.get(r.id), cap));
    const { error } = await supabase.from('routines').upsert(payload, { onConflict: 'user_id,local_id' });
    if (error) warn('pushRoutines', error);
  }
  const re = await db.select().from(schema.routineExercises);
  if (re.length > 0) {
    const reUuids = await localUuidById('routine_exercises');
    const payload = await Promise.all(re.map(async (x) => {
      const { name, unit } = await getExerciseNameUnit(x.exerciseId);
      const base: Record<string, any> = {
        user_id: userId,
        local_id: x.id,
        routine_local_id: x.routineId,
        exercise_name: name,
        exercise_unit: unit,
        order_idx: x.orderIdx,
        target_sets: x.targetSets,
        updated_at: new Date().toISOString(),
      };
      if (cap) {
        const pu = routineUuids.get(x.routineId);
        if (pu) base.routine_client_uuid = pu;
      }
      return withUuid(base, reUuids.get(x.id), cap);
    }));
    const { error } = await supabase.from('routine_exercises').upsert(payload, { onConflict: 'user_id,local_id' });
    if (error) warn('pushRoutineExercises', error);
  }
}

async function pushEggsPets(userId: string, cap: boolean) {
  const eggUuids = await localUuidById('eggs');
  const petUuids = await localUuidById('pets');
  const eggs = await db.select().from(schema.eggs);
  if (eggs.length > 0) {
    const payload = eggs.map((e) => withUuid({
      user_id: userId,
      local_id: e.id,
      type: e.type,
      current_exp: e.currentExp,
      required_exp: e.requiredExp,
      stage: e.stage,
      hatched_at: toISO(e.hatchedAt),
      pet_local_id: e.petId,
      ...(cap && e.petId && petUuids.get(e.petId) ? { pet_client_uuid: petUuids.get(e.petId) } : {}),
      created_at: toISO(e.createdAt),
      updated_at: new Date().toISOString(),
    }, eggUuids.get(e.id), cap));
    const { error } = await supabase.from('eggs').upsert(payload, { onConflict: 'user_id,local_id' });
    if (error) warn('pushEggs', error);
  }
  const pets = await db.select().from(schema.pets);
  if (pets.length > 0) {
    const payload = pets.map((p) => withUuid({
      user_id: userId,
      local_id: p.id,
      egg_local_id: p.eggId,
      ...(cap && p.eggId && eggUuids.get(p.eggId) ? { egg_client_uuid: eggUuids.get(p.eggId) } : {}),
      name: p.name,
      species: p.species,
      type: p.type,
      level: p.level,
      exp: p.exp,
      stage: p.stage,
      emoji: p.emoji,
      created_at: toISO(p.createdAt),
      updated_at: new Date().toISOString(),
    }, petUuids.get(p.id), cap));
    const { error } = await supabase.from('pets').upsert(payload, { onConflict: 'user_id,local_id' });
    if (error) warn('pushPets', error);
  }
}

async function pushAchievements(userId: string, cap: boolean) {
  const rows = await db.select().from(schema.achievements);
  if (rows.length === 0) return;
  const uuids = await localUuidById('achievements');
  const payload = rows.map((a) => withUuid({
    user_id: userId,
    local_id: a.id,
    code: a.code,
    title: a.title,
    description: a.description,
    unlocked_at: toISO(a.unlockedAt),
    updated_at: new Date().toISOString(),
  }, uuids.get(a.id), cap));
  const { error } = await supabase.from('achievements').upsert(payload, { onConflict: 'user_id,local_id' });
  if (error) warn('pushAchievements', error);
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

/**
 * 正規化 natural key 欄位：本地存 timestamp_ms（number）、雲端存 timestamptz（ISO string），
 * 直接比字串永遠不會相符 → 兩邊時間戳一律轉成 ms 再算 key。
 */
function normalizeKeyFields(table: string, row: any): any {
  switch (table) {
    case 'workouts': return { ...row, started_at: toMs(row.started_at) };
    case 'meals': return { ...row, logged_at: toMs(row.logged_at) };
    case 'body_measurements': return { ...row, measured_at: toMs(row.measured_at) };
    case 'workout_sets': return { ...row, created_at: toMs(row.created_at) };
    default: return row;
  }
}

/** 把雲端 uuid 過繼到本地既有列（natural key 命中但 uuid 不同，如匯入 pre-UUID 備份後）。 */
async function adoptUuids(table: string, adopts: { cloudUuid: string; localSyncUuid: string }[]) {
  for (const a of adopts) {
    try {
      await sqliteDb.runAsync(`UPDATE "${table}" SET sync_uuid = ? WHERE sync_uuid = ?`, [a.cloudUuid, a.localSyncUuid]);
    } catch (e) { warn(`adoptUuids(${table})`, e); }
  }
}

/** 讀本地列並正規化（供 planPull 比對）。 */
async function localNormalized(table: string, cols: string): Promise<any[]> {
  const rows = await sqliteDb.getAllAsync<any>(`SELECT id as local_id, sync_uuid, ${cols} FROM "${table}"`);
  return rows.map((r) => normalizeKeyFields(table, r));
}

async function pullWorkouts(userId: string, cap: boolean): Promise<Map<string, number>> {
  const parentMap = new Map<string, number>();   // cloud client_uuid → 本地 workout id
  const cloud = await pullTable<any>(userId, 'workouts');
  const meId = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id;
  if (!meId || cloud.length === 0) return parentMap;

  const insertVals = (w: any) => ({
    userId: meId,
    startedAt: new Date(w.started_at),
    endedAt: w.ended_at ? new Date(w.ended_at) : null,
    note: w.note,
    totalExp: w.total_exp,
    totalVolume: w.total_volume,
    durationSec: w.duration_sec,
  });

  if (!cap) {
    // legacy 路徑（005 未跑）：與 v1.0.7 完全相同，零回歸
    const localIds = new Set((await db.select({ id: schema.workouts.id }).from(schema.workouts)).map((r) => r.id));
    for (const w of cloud) {
      if (localIds.has(w.local_id)) continue;
      await db.insert(schema.workouts).values({ id: w.local_id, ...insertVals(w) } as any);
    }
    return parentMap;
  }

  const plan = planPull(
    'workouts',
    cloud.map((c) => normalizeKeyFields('workouts', c)),
    await localUuidSet('workouts'),
    await localNormalized('workouts', 'started_at'),
  );
  await adoptUuids('workouts', plan.toAdopt);
  for (const w of plan.toInsert) {
    // **不指定 id**（修 P0-3：舊版強制 id=local_id 造成重裝撞號）→ autoincrement 發新號
    const ins = await db.insert(schema.workouts).values(insertVals(w) as any).returning({ id: schema.workouts.id });
    const newId = ins[0]?.id;
    if (newId && w.client_uuid) {
      await sqliteDb.runAsync('UPDATE workouts SET sync_uuid = ? WHERE id = ?', [w.client_uuid, newId]);
    }
  }
  // 建立 uuid → 本地 id 對照（含既有列），供 workout_sets 重映父 FK
  for (const r of await sqliteDb.getAllAsync<{ id: number; sync_uuid: string }>(
    'SELECT id, sync_uuid FROM workouts WHERE sync_uuid IS NOT NULL')) {
    parentMap.set(r.sync_uuid, r.id);
  }
  return parentMap;
}

async function pullWorkoutSets(userId: string, cap: boolean, parentMap: Map<string, number>) {
  const cloud = await pullTable<any>(userId, 'workout_sets');
  if (cloud.length === 0) return;

  if (!cap) {
    const localIds = new Set((await db.select({ id: schema.workoutSets.id }).from(schema.workoutSets)).map((r) => r.id));
    for (const s of cloud) {
      if (localIds.has(s.local_id)) continue;
      const exId = await findOrCreateExercise(s.exercise_name, s.exercise_unit);
      await db.insert(schema.workoutSets).values({
        id: s.local_id, workoutId: s.workout_local_id, exerciseId: exId,
        orderIdx: s.order_idx, weight: s.weight, reps: s.reps,
        durationSec: s.duration_sec, distanceM: s.distance_m,
        swimStroke: s.swim_stroke ?? null, inclinePct: s.incline_pct ?? null, speedKmh: s.speed_kmh ?? null,
        completed: s.completed, exp: s.exp, createdAt: new Date(s.created_at),
      } as any);
    }
    return;
  }

  const plan = planPull(
    'workout_sets',
    cloud.map((c) => normalizeKeyFields('workout_sets', c)),
    await localUuidSet('workout_sets'),
    await localNormalized('workout_sets', 'created_at, order_idx, workout_id'),
  );
  await adoptUuids('workout_sets', plan.toAdopt);
  for (const s of plan.toInsert) {
    // 父 FK 用 workout_client_uuid 重映到本地新 id；對不到（父不在雲端/未 pull）就跳過，避免掛錯父
    const localWorkoutId = s.workout_client_uuid ? parentMap.get(s.workout_client_uuid) : undefined;
    if (!localWorkoutId) { _warnings.push('workout_sets 有列因父 workout 對不到而略過'); continue; }
    const exId = await findOrCreateExercise(s.exercise_name, s.exercise_unit);
    const ins = await db.insert(schema.workoutSets).values({
      workoutId: localWorkoutId, exerciseId: exId,
      orderIdx: s.order_idx, weight: s.weight, reps: s.reps,
      durationSec: s.duration_sec, distanceM: s.distance_m,
      swimStroke: s.swim_stroke ?? null, inclinePct: s.incline_pct ?? null, speedKmh: s.speed_kmh ?? null,
      completed: s.completed, exp: s.exp, createdAt: new Date(s.created_at),
    } as any).returning({ id: schema.workoutSets.id });
    const newId = ins[0]?.id;
    if (newId && s.client_uuid) {
      await sqliteDb.runAsync('UPDATE workout_sets SET sync_uuid = ? WHERE id = ?', [s.client_uuid, newId]);
    }
  }
}

async function pullMeals(userId: string, cap: boolean) {
  const cloud = await pullTable<any>(userId, 'meals');
  if (cloud.length === 0) return;
  const meId = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id;
  if (!meId) return;

  const vals = (m: any) => ({
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
  });

  if (!cap) {
    const localIds = new Set((await db.select({ id: schema.meals.id }).from(schema.meals)).map((r) => r.id));
    for (const m of cloud) {
      if (localIds.has(m.local_id)) continue;
      await db.insert(schema.meals).values({ id: m.local_id, ...vals(m) } as any);
    }
    return;
  }

  const plan = planPull(
    'meals',
    cloud.map((c) => normalizeKeyFields('meals', c)),
    await localUuidSet('meals'),
    await localNormalized('meals', 'logged_at, meal_type'),
  );
  await adoptUuids('meals', plan.toAdopt);
  for (const m of plan.toInsert) {
    const ins = await db.insert(schema.meals).values(vals(m) as any).returning({ id: schema.meals.id });
    const newId = ins[0]?.id;
    if (newId && m.client_uuid) {
      await sqliteDb.runAsync('UPDATE meals SET sync_uuid = ? WHERE id = ?', [m.client_uuid, newId]);
    }
  }
}

async function pullBody(userId: string, cap: boolean) {
  const cloud = await pullTable<any>(userId, 'body_measurements');
  if (cloud.length === 0) return;
  const meId = (await db.select({ id: schema.users.id }).from(schema.users).limit(1))[0]?.id;
  if (!meId) return;

  const vals = (b: any) => ({
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
  });

  if (!cap) {
    const localIds = new Set((await db.select({ id: schema.bodyMeasurements.id }).from(schema.bodyMeasurements)).map((r) => r.id));
    for (const b of cloud) {
      if (localIds.has(b.local_id)) continue;
      await db.insert(schema.bodyMeasurements).values({ id: b.local_id, ...vals(b) } as any);
    }
    return;
  }

  const plan = planPull(
    'body_measurements',
    cloud.map((c) => normalizeKeyFields('body_measurements', c)),
    await localUuidSet('body_measurements'),
    await localNormalized('body_measurements', 'measured_at'),
  );
  await adoptUuids('body_measurements', plan.toAdopt);
  for (const b of plan.toInsert) {
    const ins = await db.insert(schema.bodyMeasurements).values(vals(b) as any).returning({ id: schema.bodyMeasurements.id });
    const newId = ins[0]?.id;
    if (newId && b.client_uuid) {
      await sqliteDb.runAsync('UPDATE body_measurements SET sync_uuid = ? WHERE id = ?', [b.client_uuid, newId]);
    }
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
  /** 本次同步的非致命問題（原本被 catch{} 吞掉的錯誤）。 */
  warnings: string[];
};

/**
 * Reconcile：處理雲端 client_uuid 為 null 的 legacy 列（005 之後第一次同步）。
 * - claim：與本地唯一一筆 natural key + local_id 皆相符 → 回寫本地 sync_uuid（判定同一列）。
 * - orphan：其餘（典型為重裝前的舊資料）→ 配一個全新 uuid，接著由 pull 匯入本地成新列。
 * 兩者都只是「幫雲端列補上 uuid」，不會覆蓋任何資料。
 */
async function reconcileLegacyCloud(userId: string, table: string, localCols: string) {
  try {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId).is('client_uuid', null);
    if (error) { warn(`reconcile(${table})`, error); return; }
    const cloudRows = (data ?? []).map((r) => normalizeKeyFields(table, r));
    if (cloudRows.length === 0) return;
    const localRows = await localNormalized(table, localCols);
    const { claims, orphans } = planReconcile(table, cloudRows, localRows);
    for (const c of claims) {
      const r = await supabase.from(table).update({ client_uuid: c.syncUuid })
        .eq('user_id', userId).eq('local_id', c.cloudLocalId);
      if (r.error) warn(`reconcile claim(${table})`, r.error);
    }
    for (const o of orphans) {
      if (o.local_id === undefined) continue;
      const r = await supabase.from(table).update({ client_uuid: Crypto.randomUUID() })
        .eq('user_id', userId).eq('local_id', o.local_id);
      if (r.error) warn(`reconcile orphan(${table})`, r.error);
    }
    if (orphans.length > 0) {
      _warnings.push(`${table}: ${orphans.length} 筆雲端舊資料將還原到本地(reconcile orphan)`);
    }
  } catch (e) { warn(`reconcile(${table})`, e); }
}

export async function fullSync(userId: string): Promise<SyncStats> {
  if (!isSupabaseConfigured()) throw new Error('Supabase 未設定');

  _warnings = [];
  const cap = await hasUuidCapability();

  const stats: SyncStats = {
    pushedWorkouts: 0, pushedSets: 0, pushedMeals: 0, pushedBody: 0,
    pulledWorkouts: 0, pulledSets: 0, pulledMeals: 0, pulledBody: 0,
    warnings: [],
  };

  const [w0, s0, m0, b0] = await Promise.all([
    db.select({ c: sql<number>`count(*)` }).from(schema.workouts),
    db.select({ c: sql<number>`count(*)` }).from(schema.workoutSets),
    db.select({ c: sql<number>`count(*)` }).from(schema.meals),
    db.select({ c: sql<number>`count(*)` }).from(schema.bodyMeasurements),
  ]);

  // 005 已跑 → 先 reconcile 雲端 legacy 列（補 uuid），再 push/pull
  if (cap) {
    await reconcileLegacyCloud(userId, 'workouts', 'started_at');
    await reconcileLegacyCloud(userId, 'meals', 'logged_at, meal_type');
    await reconcileLegacyCloud(userId, 'body_measurements', 'measured_at');
    await reconcileLegacyCloud(userId, 'workout_sets', 'created_at, order_idx, workout_id');
  }

  await pushProfile(userId);
  await pushWorkouts(userId, cap);
  await pushWorkoutSets(userId, cap);
  await pushMeals(userId, cap);
  await pushBody(userId, cap);
  await pushRoutines(userId, cap);
  await pushEggsPets(userId, cap);
  await pushAchievements(userId, cap);
  await pushHealthTables(userId, cap);
  await pushCustomFoods(userId, cap);

  // 在 push 之後、pull 之前 flush 所有「本地已刪、雲端還在」的 tombstone
  // 否則接下來的 pull 會把這些已刪資料重新塞回本地
  await flushPendingDeletions(userId);

  stats.pushedWorkouts = Number(w0[0]?.c ?? 0);
  stats.pushedSets = Number(s0[0]?.c ?? 0);
  stats.pushedMeals = Number(m0[0]?.c ?? 0);
  stats.pushedBody = Number(b0[0]?.c ?? 0);

  await pullProfile(userId);
  const parentMap = await pullWorkouts(userId, cap);
  await pullWorkoutSets(userId, cap, parentMap);
  await pullMeals(userId, cap);
  await pullBody(userId, cap);

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
  stats.warnings = [..._warnings];

  return stats;
}
