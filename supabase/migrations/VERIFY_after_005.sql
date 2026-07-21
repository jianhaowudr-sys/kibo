-- 005 跑完後的驗證。只回傳「還缺的東西」——沒有任何列 = 全部到位。
-- 在 Supabase SQL Editor 執行。

with expected(kind, tbl, col) as (values
  -- A) 003 從未套用而缺的欄位 + 005 新增的 profiles 欄位
  ('欄位','profiles','health_settings'),
  ('欄位','profiles','dashboard_layout'),
  ('欄位','profiles','streak_freeze_tokens'),
  ('欄位','profiles','onboarding_completed_at'),
  ('欄位','profiles','consecutive_days'),
  ('欄位','profiles','last_active_day'),
  ('欄位','profiles','next_egg_rarity_floor'),
  ('欄位','eggs','liberation_pct'),
  ('欄位','eggs','target_pct'),
  ('欄位','eggs','skin_id'),
  ('欄位','eggs','rarity'),
  ('欄位','eggs','is_legacy'),
  ('欄位','pets','skin_id'),
  ('欄位','pets','rarity'),
  ('欄位','pets','is_legacy'),
  ('欄位','routines','sort_order'),
  ('欄位','sleep_logs','kind'),
  ('欄位','sleep_logs','assigned_day_key'),
  ('欄位','custom_foods','barcode'),
  ('欄位','period_days','updated_at'),
  -- B) 14 張同步表的 client_uuid
  ('client_uuid','workouts','client_uuid'),
  ('client_uuid','workout_sets','client_uuid'),
  ('client_uuid','meals','client_uuid'),
  ('client_uuid','body_measurements','client_uuid'),
  ('client_uuid','routines','client_uuid'),
  ('client_uuid','routine_exercises','client_uuid'),
  ('client_uuid','eggs','client_uuid'),
  ('client_uuid','pets','client_uuid'),
  ('client_uuid','achievements','client_uuid'),
  ('client_uuid','custom_foods','client_uuid'),
  ('client_uuid','water_logs','client_uuid'),
  ('client_uuid','bowel_logs','client_uuid'),
  ('client_uuid','sleep_logs','client_uuid'),
  ('client_uuid','period_days','client_uuid'),
  -- C) 父鏈 uuid
  ('父鏈','workout_sets','workout_client_uuid'),
  ('父鏈','routine_exercises','routine_client_uuid'),
  ('父鏈','pets','egg_client_uuid'),
  ('父鏈','eggs','pet_client_uuid')
)
select e.kind as "缺什麼", e.tbl as "表", e.col as "欄位"
from expected e
left join information_schema.columns c
  on c.table_schema = 'public' and c.table_name = e.tbl and c.column_name = e.col
where c.column_name is null

union all

-- D) daily_scores 表是否已建
select '表', 'daily_scores', '(整張表不存在)'
where to_regclass('public.daily_scores') is null

union all

-- E) local_id 是否已改 nullable（cap=true 的 push 不送 local_id，新列會是 NULL）
select 'local_id 仍為 NOT NULL', c.table_name, c.column_name
from information_schema.columns c
where c.table_schema = 'public' and c.column_name = 'local_id' and c.is_nullable = 'NO'
  and c.table_name in ('workouts','workout_sets','meals','body_measurements','routines',
                       'routine_exercises','eggs','pets','achievements','custom_foods',
                       'water_logs','bowel_logs','sleep_logs','period_days')

union all

-- F) client_uuid 的完整 unique index 是否建好（PostgREST on_conflict 需要）
select 'unique index 缺', t.tbl, 'uq_' || t.tbl || '_client_uuid'
from (values ('workouts'),('workout_sets'),('meals'),('body_measurements'),('routines'),
             ('routine_exercises'),('eggs'),('pets'),('achievements'),('custom_foods'),
             ('water_logs'),('bowel_logs'),('sleep_logs'),('period_days')) as t(tbl)
where not exists (
  select 1 from pg_indexes i
  where i.schemaname = 'public' and i.tablename = t.tbl
    and i.indexname = 'uq_' || t.tbl || '_client_uuid'
)
order by 1, 2, 3;
