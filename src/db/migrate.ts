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
  created_at INTEGER NOT NULL
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
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  unlocked_at INTEGER NOT NULL
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
