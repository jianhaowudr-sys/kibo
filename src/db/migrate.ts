import { sqliteDb } from './client';
import { DEFAULT_EXERCISES } from '@/data/exercises';
import { V2_EXERCISES } from '@/data/exercises_v2';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '健身新手',
  height_cm REAL,
  weight_kg REAL,
  goal TEXT NOT NULL DEFAULT 'fit',
  daily_exp_goal INTEGER NOT NULL DEFAULT 100,
  weekly_days_goal INTEGER NOT NULL DEFAULT 3,
  streak INTEGER NOT NULL DEFAULT 0,
  last_workout_date TEXT,
  total_workouts INTEGER NOT NULL DEFAULT 0,
  total_exp INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '💪',
  note TEXT,
  last_snapshot_json TEXT,
  last_saved_at INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  logged_at INTEGER NOT NULL,
  meal_type TEXT NOT NULL,
  title TEXT,
  items_json TEXT,
  calories_kcal INTEGER,
  protein_g REAL,
  carb_g REAL,
  fat_g REAL,
  photo_uri TEXT,
  note TEXT,
  ai_parsed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS body_measurements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  measured_at INTEGER NOT NULL,
  weight_kg REAL,
  body_fat_pct REAL,
  skeletal_muscle_kg REAL,
  muscle_mass_kg REAL,
  protein_kg REAL,
  body_fat_kg REAL,
  mineral_kg REAL,
  body_water_kg REAL,
  bmr INTEGER,
  visceral_fat_level INTEGER,
  body_score INTEGER,
  photo_uri TEXT,
  note TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  order_idx INTEGER NOT NULL,
  target_sets INTEGER NOT NULL DEFAULT 3,
  FOREIGN KEY (routine_id) REFERENCES routines(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  part TEXT,
  equipment TEXT,
  unit TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'dumbbell',
  exp_per_unit REAL NOT NULL DEFAULT 1,
  is_custom INTEGER NOT NULL DEFAULT 0,
  seed_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  note TEXT,
  total_exp INTEGER NOT NULL DEFAULT 0,
  total_volume REAL NOT NULL DEFAULT 0,
  duration_sec INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workout_sets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL,
  exercise_id INTEGER NOT NULL,
  order_idx INTEGER NOT NULL,
  weight REAL,
  reps INTEGER,
  duration_sec INTEGER,
  distance_m REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  exp INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS eggs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  current_exp INTEGER NOT NULL DEFAULT 0,
  required_exp INTEGER NOT NULL DEFAULT 500,
  stage INTEGER NOT NULL DEFAULT 0,
  hatched_at INTEGER,
  pet_id INTEGER,
  created_at INTEGER NOT NULL,
  liberation_pct REAL NOT NULL DEFAULT 0,
  target_pct REAL NOT NULL DEFAULT 100,
  skin_id TEXT,
  rarity TEXT,
  is_legacy INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  egg_id INTEGER,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  type TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  exp INTEGER NOT NULL DEFAULT 0,
  stage INTEGER NOT NULL DEFAULT 1,
  emoji TEXT NOT NULL DEFAULT '🐣',
  created_at INTEGER NOT NULL,
  skin_id TEXT,
  rarity TEXT,
  is_legacy INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS daily_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id INTEGER,
  points REAL NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_user_day ON daily_scores(user_id, day_key);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  unlocked_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS water_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount_ml INTEGER NOT NULL,
  logged_at INTEGER NOT NULL,
  batch_key TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS bowel_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  logged_at INTEGER NOT NULL,
  bristol INTEGER NOT NULL DEFAULT 4,
  has_blood INTEGER NOT NULL DEFAULT 0,
  has_pain INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sleep_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  bedtime_at INTEGER NOT NULL,
  wake_at INTEGER NOT NULL,
  duration_min INTEGER NOT NULL,
  quality INTEGER NOT NULL DEFAULT 3,
  day_key TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'main',
  assigned_day_key TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS period_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  flow TEXT NOT NULL DEFAULT 'medium',
  symptoms_json TEXT,
  notes TEXT,
  is_cycle_start INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pet_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  pet_id INTEGER,
  generated_at INTEGER NOT NULL,
  category TEXT NOT NULL,
  text TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0,
  trigger_data TEXT
);

CREATE TABLE IF NOT EXISTS pet_inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  item_label TEXT NOT NULL,
  rarity TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  source TEXT
);

CREATE TABLE IF NOT EXISTS trinity_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  reward_id TEXT,
  reward_label TEXT,
  reward_rarity TEXT,
  consecutive_days INTEGER NOT NULL DEFAULT 1,
  completed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_foods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🍽',
  calories_kcal INTEGER NOT NULL DEFAULT 0,
  protein_g REAL NOT NULL DEFAULT 0,
  carb_g REAL NOT NULL DEFAULT 0,
  fat_g REAL NOT NULL DEFAULT 0,
  portion TEXT,
  photo_uri TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_deletions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  local_id INTEGER NOT NULL,
  enqueued_at INTEGER NOT NULL,
  UNIQUE(table_name, local_id)
);
`;

async function hasColumn(table: string, column: string): Promise<boolean> {
  const rows = await sqliteDb.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );
  return rows.some((r) => r.name === column);
}

async function runAdditions(): Promise<void> {
  if (!(await hasColumn('users', 'weekly_days_goal'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN weekly_days_goal INTEGER NOT NULL DEFAULT 3');
  }
  if (!(await hasColumn('users', 'daily_calories_goal'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN daily_calories_goal INTEGER NOT NULL DEFAULT 2000');
  }
  if (!(await hasColumn('users', 'daily_protein_goal'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN daily_protein_goal INTEGER NOT NULL DEFAULT 100');
  }
  if (!(await hasColumn('exercises', 'part'))) {
    await sqliteDb.runAsync('ALTER TABLE exercises ADD COLUMN part TEXT');
  }
  if (!(await hasColumn('exercises', 'equipment'))) {
    await sqliteDb.runAsync('ALTER TABLE exercises ADD COLUMN equipment TEXT');
  }
  if (!(await hasColumn('exercises', 'seed_version'))) {
    await sqliteDb.runAsync('ALTER TABLE exercises ADD COLUMN seed_version INTEGER NOT NULL DEFAULT 1');
  }
  if (!(await hasColumn('routines', 'last_snapshot_json'))) {
    await sqliteDb.runAsync('ALTER TABLE routines ADD COLUMN last_snapshot_json TEXT');
  }
  if (!(await hasColumn('routines', 'last_saved_at'))) {
    await sqliteDb.runAsync('ALTER TABLE routines ADD COLUMN last_saved_at INTEGER');
  }
  if (!(await hasColumn('routines', 'sort_order'))) {
    await sqliteDb.runAsync('ALTER TABLE routines ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    // 回填：用 id 當初始 sort_order 保持原 created_at DESC 順序（id 大者在前）
    await sqliteDb.runAsync('UPDATE routines SET sort_order = -id WHERE sort_order = 0');
  }
  // 健康模組相關的 users 欄位
  if (!(await hasColumn('users', 'health_settings'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN health_settings TEXT');
  }
  if (!(await hasColumn('users', 'dashboard_layout'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN dashboard_layout TEXT');
  }
  if (!(await hasColumn('users', 'streak_freeze_tokens'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN streak_freeze_tokens INTEGER NOT NULL DEFAULT 0');
  }
  if (!(await hasColumn('users', 'onboarding_completed_at'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN onboarding_completed_at INTEGER');
  }
  // v9: 游泳姿勢 + 跑步機坡度 / 速率
  if (!(await hasColumn('workout_sets', 'swim_stroke'))) {
    await sqliteDb.runAsync('ALTER TABLE workout_sets ADD COLUMN swim_stroke TEXT');
  }
  if (!(await hasColumn('workout_sets', 'incline_pct'))) {
    await sqliteDb.runAsync('ALTER TABLE workout_sets ADD COLUMN incline_pct REAL');
  }
  if (!(await hasColumn('workout_sets', 'speed_kmh'))) {
    await sqliteDb.runAsync('ALTER TABLE workout_sets ADD COLUMN speed_kmh REAL');
  }

  // v1.0.2: 睡眠片段模型
  if (!(await hasColumn('sleep_logs', 'kind'))) {
    await sqliteDb.runAsync(`ALTER TABLE sleep_logs ADD COLUMN kind TEXT NOT NULL DEFAULT 'main'`);
  }
  if (!(await hasColumn('sleep_logs', 'assigned_day_key'))) {
    await sqliteDb.runAsync('ALTER TABLE sleep_logs ADD COLUMN assigned_day_key TEXT');
    await sqliteDb.runAsync('UPDATE sleep_logs SET assigned_day_key = day_key WHERE assigned_day_key IS NULL');
  }

  // v1.0.2: 解放健力% 系統 — eggs / pets / users 加欄位
  if (!(await hasColumn('eggs', 'liberation_pct'))) {
    await sqliteDb.runAsync('ALTER TABLE eggs ADD COLUMN liberation_pct REAL NOT NULL DEFAULT 0');
    // 回填：把現有 current_exp / required_exp 換算成 liberation_pct
    await sqliteDb.runAsync(
      `UPDATE eggs SET liberation_pct = MIN(100, ROUND(CAST(current_exp AS REAL) / CAST(MAX(required_exp, 1) AS REAL) * 100, 2))
       WHERE current_exp > 0`,
    );
  }
  if (!(await hasColumn('eggs', 'target_pct'))) {
    await sqliteDb.runAsync('ALTER TABLE eggs ADD COLUMN target_pct REAL NOT NULL DEFAULT 100');
  }
  if (!(await hasColumn('eggs', 'skin_id'))) {
    await sqliteDb.runAsync('ALTER TABLE eggs ADD COLUMN skin_id TEXT');
  }
  if (!(await hasColumn('eggs', 'rarity'))) {
    await sqliteDb.runAsync('ALTER TABLE eggs ADD COLUMN rarity TEXT');
  }
  if (!(await hasColumn('eggs', 'is_legacy'))) {
    await sqliteDb.runAsync('ALTER TABLE eggs ADD COLUMN is_legacy INTEGER NOT NULL DEFAULT 0');
    // 既有蛋（liberation_pct > 0 表示已用過經驗值）標 legacy
    await sqliteDb.runAsync('UPDATE eggs SET is_legacy = 1 WHERE current_exp > 0');
  }

  if (!(await hasColumn('pets', 'skin_id'))) {
    await sqliteDb.runAsync('ALTER TABLE pets ADD COLUMN skin_id TEXT');
  }
  if (!(await hasColumn('pets', 'rarity'))) {
    await sqliteDb.runAsync('ALTER TABLE pets ADD COLUMN rarity TEXT');
  }
  if (!(await hasColumn('pets', 'is_legacy'))) {
    // 所有現有寵物都是 legacy
    await sqliteDb.runAsync('ALTER TABLE pets ADD COLUMN is_legacy INTEGER NOT NULL DEFAULT 1');
  }

  if (!(await hasColumn('users', 'consecutive_days'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN consecutive_days INTEGER NOT NULL DEFAULT 0');
  }
  if (!(await hasColumn('users', 'last_active_day'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN last_active_day TEXT');
  }
  if (!(await hasColumn('users', 'next_egg_rarity_floor'))) {
    await sqliteDb.runAsync('ALTER TABLE users ADD COLUMN next_egg_rarity_floor TEXT');
  }

  // daily_scores 表：CREATE TABLE IF NOT EXISTS 已在 SCHEMA_SQL 處理，這裡確保 index 存在
  await sqliteDb.runAsync(
    'CREATE INDEX IF NOT EXISTS idx_daily_scores_user_day ON daily_scores(user_id, day_key)',
  );
}

async function seedV2IfNeeded(): Promise<void> {
  const r = await sqliteDb.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises WHERE seed_version = 2',
  );
  if (r && r.count > 0) return;

  for (const base of V2_EXERCISES) {
    const equipments = base.equipments.length > 0 ? base.equipments : ['其他' as const];
    for (const eq of equipments) {
      const suffix = eq === '徒手' ? '（自重）' : `（${eq}）`;
      const displayName = equipments.length > 1 || eq !== '徒手'
        ? `${base.name}${equipments.length > 1 ? suffix : ''}`
        : base.name;
      const finalName = equipments.length === 1 ? base.name : `${base.name}${suffix}`;
      await sqliteDb.runAsync(
        `INSERT INTO exercises (name, category, muscle_group, part, equipment, unit, icon, exp_per_unit, is_custom, seed_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 2)`,
        [
          finalName,
          base.category,
          base.muscleGroup,
          base.part,
          eq,
          base.unit,
          base.part,
          base.expPerUnit ?? 1,
        ],
      );
    }
  }
}

export async function ensureSchema(): Promise<void> {
  await sqliteDb.execAsync(SCHEMA_SQL);
  await runAdditions();
  await seedV2IfNeeded();

  const existing = await sqliteDb.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercises',
  );

  if (!existing || existing.count === 0) {
    for (const ex of DEFAULT_EXERCISES) {
      await sqliteDb.runAsync(
        'INSERT INTO exercises (name, category, muscle_group, unit, icon, exp_per_unit, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [ex.name!, ex.category!, ex.muscleGroup!, ex.unit!, ex.icon ?? '🏋️', ex.expPerUnit ?? 1, 0],
      );
    }
  }

  const user = await sqliteDb.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users',
  );

  if (!user || user.count === 0) {
    await sqliteDb.runAsync(
      'INSERT INTO users (name, goal, created_at) VALUES (?, ?, ?)',
      ['健身新手', 'fit', Date.now()],
    );

    await sqliteDb.runAsync(
      'INSERT INTO eggs (user_id, type, current_exp, required_exp, stage, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'strength', 0, 500, 0, Date.now()],
    );
  }
}

export async function resetDatabase(): Promise<void> {
  await sqliteDb.execAsync(`
    DROP TABLE IF EXISTS meals;
    DROP TABLE IF EXISTS body_measurements;
    DROP TABLE IF EXISTS routine_exercises;
    DROP TABLE IF EXISTS routines;
    DROP TABLE IF EXISTS achievements;
    DROP TABLE IF EXISTS pets;
    DROP TABLE IF EXISTS eggs;
    DROP TABLE IF EXISTS workout_sets;
    DROP TABLE IF EXISTS workouts;
    DROP TABLE IF EXISTS exercises;
    DROP TABLE IF EXISTS users;
  `);
  await ensureSchema();
}
