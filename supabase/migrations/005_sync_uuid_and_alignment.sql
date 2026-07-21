-- Kibo v1.1.0 雲同步對齊 + client_uuid（批 D2）
-- 全冪等、純加法：v1.0.7 client 不受影響；且建齊健康表後 v1.0.7 的健康 push 立刻開始成功。
-- 先跑 PROBE_online_schema.sql 核對線上狀態；建議先在測試 Supabase 專案演練 005→006 全流程。
-- 在 Supabase SQL Editor 執行。

-- ============================================================
-- A) profiles 補齊 pushProfile 會送、但線上缺的欄位（修 P1-6 同步第一步就炸）
-- ============================================================
alter table public.profiles
  add column if not exists health_settings text,
  add column if not exists dashboard_layout text,
  add column if not exists streak_freeze_tokens int not null default 0,
  add column if not exists onboarding_completed_at timestamptz;

-- ============================================================
-- B) 健康四表 + 自訂食物：CREATE IF NOT EXISTS（含 RLS + unique(user_id,local_id)）
--    → 這幾張線上原本沒建，導致 v1.0.7 健康 push 靜默失敗；建好即免費止血。
-- ============================================================
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  amount_ml int not null,
  logged_at timestamptz not null,
  batch_key text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

create table if not exists public.bowel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  logged_at timestamptz not null,
  bristol int not null default 4,
  has_blood int not null default 0,
  has_pain int not null default 0,
  notes text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  bedtime_at timestamptz not null,
  wake_at timestamptz not null,
  duration_min int not null,
  quality int not null default 3,
  day_key text not null,
  kind text not null default 'main',
  assigned_day_key text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
-- sleep_logs 若為手動建過的舊表 → 補欄（收斂未知形狀）
alter table public.sleep_logs
  add column if not exists kind text not null default 'main',
  add column if not exists assigned_day_key text,
  add column if not exists quality int not null default 3;

create table if not exists public.period_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  date timestamptz not null,
  day_key text not null,
  flow text not null default 'medium',
  symptoms_json text,
  notes text,
  is_cycle_start int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

create table if not exists public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  name text not null,
  emoji text not null default '🍽',
  calories_kcal int not null default 0,
  protein_g real not null default 0,
  carb_g real not null default 0,
  fat_g real not null default 0,
  portion text,
  photo_uri text,
  source text not null default 'manual',
  barcode text,
  use_count int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

-- RLS + self policy（5 張新表）
do $$
declare t text;
begin
  foreach t in array array['water_logs','bowel_logs','sleep_logs','period_days','custom_foods']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_self', t);
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_self', t);
  end loop;
end$$;

-- ============================================================
-- C) 14 張同步表加 client_uuid + partial unique index（保留舊 unique(user_id,local_id) 不動）
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['workouts','workout_sets','meals','body_measurements',
    'routines','routine_exercises','eggs','pets','achievements',
    'custom_foods','water_logs','bowel_logs','sleep_logs','period_days']
  loop
    execute format('alter table public.%I add column if not exists client_uuid text', t);
    -- 完整 unique（非 partial）：Postgres 多個 NULL 互不衝突，故不需 partial；
    -- 且 partial index 無法被 PostgREST 的 on_conflict 推論（會 42P10），未來 push 要用 client_uuid 當寫入鍵必須是完整 unique。
    execute format('drop index if exists public.%I', 'idx_' || t || '_client_uuid');
    execute format('create unique index if not exists %I on public.%I(user_id, client_uuid)', 'uq_' || t || '_client_uuid', t);
  end loop;
end$$;

-- 父鏈 uuid 欄（pull 時重映子表 FK 用）
alter table public.workout_sets add column if not exists workout_client_uuid text;
alter table public.routine_exercises add column if not exists routine_client_uuid text;
alter table public.pets add column if not exists egg_client_uuid text;
alter table public.eggs add column if not exists pet_client_uuid text;
