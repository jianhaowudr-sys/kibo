-- 唯讀探測：在 Supabase SQL Editor 執行，把結果貼回，用以確認線上真實 schema 後才跑 005。
-- 線上有 out-of-band DDL（sleep_logs 被手動建過），005 雖全冪等，但先探測可核對欄位與約束名。

-- 1) 每張表的欄位
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 2) 約束（找 unique(user_id, local_id) 的實際名稱，006 會 drop）
select conname, conrelid::regclass as tbl, pg_get_constraintdef(oid) as def
from pg_constraint
where connamespace = 'public'::regnamespace
order by tbl, conname;

-- 3) 現有哪些同步表已存在
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('profiles','workouts','workout_sets','meals','body_measurements',
    'routines','routine_exercises','eggs','pets','achievements','custom_foods',
    'water_logs','bowel_logs','sleep_logs','period_days','daily_scores')
order by table_name;
