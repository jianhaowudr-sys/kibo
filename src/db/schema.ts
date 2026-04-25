import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().default('健身新手'),
  heightCm: real('height_cm'),
  weightKg: real('weight_kg'),
  goal: text('goal').notNull().default('fit'),
  dailyExpGoal: integer('daily_exp_goal').notNull().default(100),
  weeklyDaysGoal: integer('weekly_days_goal').notNull().default(3),
  dailyCaloriesGoal: integer('daily_calories_goal').notNull().default(2000),
  dailyProteinGoal: integer('daily_protein_goal').notNull().default(100),
  streak: integer('streak').notNull().default(0),
  lastWorkoutDate: text('last_workout_date'),
  totalWorkouts: integer('total_workouts').notNull().default(0),
  totalExp: integer('total_exp').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('💪'),
  note: text('note'),
  lastSnapshotJson: text('last_snapshot_json'),
  lastSavedAt: integer('last_saved_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const meals = sqliteTable('meals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
  mealType: text('meal_type').notNull(),
  title: text('title'),
  itemsJson: text('items_json'),
  caloriesKcal: integer('calories_kcal'),
  proteinG: real('protein_g'),
  carbG: real('carb_g'),
  fatG: real('fat_g'),
  photoUri: text('photo_uri'),
  note: text('note'),
  aiParsed: integer('ai_parsed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const bodyMeasurements = sqliteTable('body_measurements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  measuredAt: integer('measured_at', { mode: 'timestamp_ms' }).notNull(),
  weightKg: real('weight_kg'),
  bodyFatPct: real('body_fat_pct'),
  skeletalMuscleKg: real('skeletal_muscle_kg'),
  muscleMassKg: real('muscle_mass_kg'),
  proteinKg: real('protein_kg'),
  bodyFatKg: real('body_fat_kg'),
  mineralKg: real('mineral_kg'),
  bodyWaterKg: real('body_water_kg'),
  bmr: integer('bmr'),
  visceralFatLevel: integer('visceral_fat_level'),
  bodyScore: integer('body_score'),
  photoUri: text('photo_uri'),
  note: text('note'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const routineExercises = sqliteTable('routine_exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  routineId: integer('routine_id').notNull().references(() => routines.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  orderIdx: integer('order_idx').notNull(),
  targetSets: integer('target_sets').notNull().default(3),
});

export const exercises = sqliteTable('exercises', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  category: text('category').notNull(),
  muscleGroup: text('muscle_group').notNull(),
  part: text('part'),
  equipment: text('equipment'),
  unit: text('unit').notNull(),
  icon: text('icon').notNull().default('dumbbell'),
  expPerUnit: real('exp_per_unit').notNull().default(1),
  isCustom: integer('is_custom', { mode: 'boolean' }).notNull().default(false),
  seedVersion: integer('seed_version').notNull().default(1),
});

export const workouts = sqliteTable('workouts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
  note: text('note'),
  totalExp: integer('total_exp').notNull().default(0),
  totalVolume: real('total_volume').notNull().default(0),
  durationSec: integer('duration_sec').notNull().default(0),
});

export const workoutSets = sqliteTable('workout_sets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workoutId: integer('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
  exerciseId: integer('exercise_id').notNull().references(() => exercises.id),
  orderIdx: integer('order_idx').notNull(),
  weight: real('weight'),
  reps: integer('reps'),
  durationSec: integer('duration_sec'),
  distanceM: real('distance_m'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  exp: integer('exp').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const eggs = sqliteTable('eggs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  currentExp: integer('current_exp').notNull().default(0),
  requiredExp: integer('required_exp').notNull().default(500),
  stage: integer('stage').notNull().default(0),
  hatchedAt: integer('hatched_at', { mode: 'timestamp_ms' }),
  petId: integer('pet_id'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const pets = sqliteTable('pets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  eggId: integer('egg_id').references(() => eggs.id),
  name: text('name').notNull(),
  species: text('species').notNull(),
  type: text('type').notNull(),
  level: integer('level').notNull().default(1),
  exp: integer('exp').notNull().default(0),
  stage: integer('stage').notNull().default(1),
  emoji: text('emoji').notNull().default('🐣'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const achievements = sqliteTable('achievements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  code: text('code').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  unlockedAt: integer('unlocked_at', { mode: 'timestamp_ms' }).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutSet = typeof workoutSets.$inferSelect;
export type NewWorkoutSet = typeof workoutSets.$inferInsert;
export type Egg = typeof eggs.$inferSelect;
export type NewEgg = typeof eggs.$inferInsert;
export type Pet = typeof pets.$inferSelect;
export type NewPet = typeof pets.$inferInsert;
export type Achievement = typeof achievements.$inferSelect;
export type NewAchievement = typeof achievements.$inferInsert;
export type Routine = typeof routines.$inferSelect;
export type NewRoutine = typeof routines.$inferInsert;
export type RoutineExercise = typeof routineExercises.$inferSelect;
export type NewRoutineExercise = typeof routineExercises.$inferInsert;
export type BodyMeasurement = typeof bodyMeasurements.$inferSelect;
export type NewBodyMeasurement = typeof bodyMeasurements.$inferInsert;
export type Meal = typeof meals.$inferSelect;
export type NewMeal = typeof meals.$inferInsert;
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealItem = { name: string; portion?: string; calories: number; protein: number; carb: number; fat: number };

export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility';
export type BodyPart = '全身' | '背' | '胸' | '肩' | '腿' | '臀部' | '手臂' | '核心肌群' | '有氧' | '活動度';
export type EquipmentType = '啞鈴' | '槓鈴' | '壺鈴' | '機器' | '滑輪' | '徒手' | '彈力帶' | '抗力球' | '藥球' | 'TRX' | '其他';
export type EggType = 'strength' | 'cardio' | 'flex';
export type WorkoutGoal = 'lose' | 'gain' | 'fit' | 'strong';
