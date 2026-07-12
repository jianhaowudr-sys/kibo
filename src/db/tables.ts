// 全資料表註冊表 —— 備份/還原/resetDatabase/schema-drift 檢查的唯一真相來源。
// 見 scripts/verify_table_registry.ts(用 drizzle getTableConfig 斷言與 schema.ts 一致)。
//
// 排序 = 「父先子後」拓撲序(FK 安全):
//   - users / exercises 無外鍵,最前。
//   - 其餘多數僅 → users.id。
//   - eggs 先於 pets(唯一真 FK：pets.egg_id → eggs.id；eggs.pet_id 是純 integer 無 FK，不成循環)。
//   - routine_exercises 在 routines + exercises 之後。
//   - workout_sets 在 workouts + exercises 之後。
//   - pet_messages 在 pets 之後（pet_id → pets.id）。
// 匯入 / 建表用此正序；刪除 / DROP 用 ALL_TABLES.slice().reverse()（子先父後）。

export const ALL_TABLES = [
  'users',
  'exercises',
  'routines',
  'workouts',
  'eggs',
  'meals',
  'body_measurements',
  'progress_photos',
  'daily_scores',
  'water_logs',
  'bowel_logs',
  'sleep_logs',
  'period_days',
  'custom_foods',
  'pet_inventory',
  'trinity_completions',
  'achievements',
  'pets',
  'routine_exercises',
  'workout_sets',
  'pet_messages',
  'pending_deletions',
] as const;

export type TableName = (typeof ALL_TABLES)[number];

/** DROP / DELETE 用的反序（子先父後，FK 安全）。 */
export const ALL_TABLES_REVERSE: readonly TableName[] = [...ALL_TABLES].reverse();
