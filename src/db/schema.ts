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
  // 健康設定 JSON（plan v2 §4.1）
  healthSettings: text('health_settings'),
  // 首頁卡片佈局 JSON（plan v2 §3.3）
  dashboardLayout: text('dashboard_layout'),
  // streak 補課券（plan v2 §4.2 Hook 3）
  streakFreezeTokens: integer('streak_freeze_tokens').notNull().default(0),
  // onboarding 完成旗標
  onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp_ms' }),
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
  // 游泳專用：自由式 / 蛙式 / 仰式 / 蝶式 / 混合 / 其他
  swimStroke: text('swim_stroke'),
  // 跑步機 / 飛輪：坡度（%）+ 速率（km/h）
  inclinePct: real('incline_pct'),
  speedKmh: real('speed_kmh'),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  exp: integer('exp').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export type SwimStroke = 'freestyle' | 'breast' | 'back' | 'butterfly' | 'mixed' | 'other';

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

// ===== 健康四模組（plan v2 §4.1）=====

export const waterLogs = sqliteTable('water_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  amountMl: integer('amount_ml').notNull(),
  loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
  // 連點合併 batch key（同 batch 同時 undo）
  batchKey: text('batch_key'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const bowelLogs = sqliteTable('bowel_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  loggedAt: integer('logged_at', { mode: 'timestamp_ms' }).notNull(),
  bristol: integer('bristol').notNull().default(4),     // 1~7
  hasBlood: integer('has_blood').notNull().default(0),  // 0/1
  hasPain: integer('has_pain').notNull().default(0),    // 0/1
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const sleepLogs = sqliteTable('sleep_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  bedtimeAt: integer('bedtime_at', { mode: 'timestamp_ms' }).notNull(),
  wakeAt: integer('wake_at', { mode: 'timestamp_ms' }).notNull(),
  durationMin: integer('duration_min').notNull(),
  quality: integer('quality').notNull().default(3),     // 1~5
  // 起床日期 yyyy-mm-dd（同人同天 unique，重複 upsert）
  dayKey: text('day_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const periodDays = sqliteTable('period_days', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  date: integer('date', { mode: 'timestamp_ms' }).notNull(),
  // yyyy-mm-dd（同人同天 unique）
  dayKey: text('day_key').notNull(),
  flow: text('flow').notNull().default('medium'),       // 'spot'|'light'|'medium'|'heavy'
  symptomsJson: text('symptoms_json'),                  // JSON array of strings
  notes: text('notes'),
  isCycleStart: integer('is_cycle_start').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// 自訂食物庫（plan v5）— 使用者建立的常吃食物快速選用
export const customFoods = sqliteTable('custom_foods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  emoji: text('emoji').notNull().default('🍽'),
  // 一份的營養素（使用者紀錄時可選 1/0.5/2 等倍數）
  caloriesKcal: integer('calories_kcal').notNull().default(0),
  proteinG: real('protein_g').notNull().default(0),
  carbG: real('carb_g').notNull().default(0),
  fatG: real('fat_g').notNull().default(0),
  portion: text('portion'),                  // e.g. "1 份 30g"
  photoUri: text('photo_uri'),
  source: text('source').notNull().default('manual'),  // 'manual' | 'ai'
  useCount: integer('use_count').notNull().default(0),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// 寵物 inventory（plan v2 §4.2 Hook 4）— 累積式收藏物
export const petInventory = sqliteTable('pet_inventory', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  itemId: text('item_id').notNull(),       // REWARD_POOL.id
  itemLabel: text('item_label').notNull(), // 顯示用
  rarity: text('rarity').notNull(),        // common / rare / epic
  acquiredAt: integer('acquired_at', { mode: 'timestamp_ms' }).notNull(),
  source: text('source'),                  // trinity / streak / achievement
});

// Daily Trinity 完成紀錄（同天唯一，避免重複抽獎）
export const trinityCompletions = sqliteTable('trinity_completions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  dayKey: text('day_key').notNull(),  // yyyy-mm-dd
  rewardId: text('reward_id'),
  rewardLabel: text('reward_label'),
  rewardRarity: text('reward_rarity'),
  consecutiveDays: integer('consecutive_days').notNull().default(1),
  completedAt: integer('completed_at', { mode: 'timestamp_ms' }).notNull(),
});

// 寵物訊息（plan v2 §4.2 Hook 1）
export const petMessages = sqliteTable('pet_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  petId: integer('pet_id').references(() => pets.id),
  generatedAt: integer('generated_at', { mode: 'timestamp_ms' }).notNull(),
  category: text('category').notNull(),  // greeting | concern | celebration | reminder
  text: text('text').notNull(),
  read: integer('read').notNull().default(0),
  triggerData: text('trigger_data'),
});

export const pendingDeletions = sqliteTable('pending_deletions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tableName: text('table_name').notNull(),
  localId: integer('local_id').notNull(),
  enqueuedAt: integer('enqueued_at', { mode: 'timestamp_ms' }).notNull(),
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

export type WaterLog = typeof waterLogs.$inferSelect;
export type NewWaterLog = typeof waterLogs.$inferInsert;
export type BowelLog = typeof bowelLogs.$inferSelect;
export type NewBowelLog = typeof bowelLogs.$inferInsert;
export type SleepLog = typeof sleepLogs.$inferSelect;
export type NewSleepLog = typeof sleepLogs.$inferInsert;
export type PeriodDay = typeof periodDays.$inferSelect;
export type NewPeriodDay = typeof periodDays.$inferInsert;
export type PetMessage = typeof petMessages.$inferSelect;
export type NewPetMessage = typeof petMessages.$inferInsert;
export type PetInventoryItem = typeof petInventory.$inferSelect;
export type NewPetInventoryItem = typeof petInventory.$inferInsert;
export type CustomFood = typeof customFoods.$inferSelect;
export type NewCustomFood = typeof customFoods.$inferInsert;
export type TrinityCompletion = typeof trinityCompletions.$inferSelect;
export type NewTrinityCompletion = typeof trinityCompletions.$inferInsert;

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PeriodFlow = 'spot' | 'light' | 'medium' | 'heavy';
export type PetMessageCategory = 'greeting' | 'concern' | 'celebration' | 'reminder';
export type MealItem = { name: string; portion?: string; calories: number; protein: number; carb: number; fat: number };

export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility';
export type BodyPart = '全身' | '背' | '胸' | '肩' | '腿' | '臀部' | '手臂' | '核心肌群' | '有氧' | '活動度';
export type EquipmentType = '啞鈴' | '槓鈴' | '壺鈴' | '機器' | '滑輪' | '徒手' | '彈力帶' | '抗力球' | '藥球' | 'TRX' | '其他';
export type EggType = 'strength' | 'cardio' | 'flex';
export type WorkoutGoal = 'lose' | 'gain' | 'fit' | 'strong';
