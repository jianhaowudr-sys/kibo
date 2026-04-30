-- v1.0.2 schema additions
-- 1) routines.sort_order：課表自訂排序
-- 2) sleep_logs.kind / assigned_day_key：片段睡眠模型（v1.0.2 第 5 項）
-- 3) eggs / pets / users 解放健力% 系統 + daily_scores（v1.0.2 第 6 項）

-- ====== 1. routines 排序 ======
alter table public.routines
  add column if not exists sort_order int not null default 0;

-- ====== 2. sleep_logs 片段模型 ======
alter table public.sleep_logs
  add column if not exists kind text not null default 'main',
  add column if not exists assigned_day_key text;

-- 移除 (user_id, day_key) UNIQUE 限制（同天可多筆：主睡 + 小睡）
do $$
declare
  cn text;
begin
  select tc.constraint_name into cn
  from information_schema.table_constraints tc
  where tc.table_schema = 'public'
    and tc.table_name = 'sleep_logs'
    and tc.constraint_type = 'UNIQUE'
    and tc.constraint_name like '%day_key%';
  if cn is not null then
    execute format('alter table public.sleep_logs drop constraint %I', cn);
  end if;
end$$;

-- 回填 assigned_day_key
update public.sleep_logs
set assigned_day_key = day_key
where assigned_day_key is null;

-- ====== 3. eggs / pets 解放健力% ======
alter table public.eggs
  add column if not exists liberation_pct real not null default 0,
  add column if not exists target_pct real not null default 100,
  add column if not exists skin_id text,
  add column if not exists rarity text,
  add column if not exists is_legacy int not null default 0;

-- 換算 legacy egg 的 liberation_pct
update public.eggs
set liberation_pct = case
    when required_exp > 0 then least(100, (current_exp::real / required_exp::real) * 100)
    else 0
  end,
  is_legacy = 1
where current_exp > 0
  and (liberation_pct = 0 or liberation_pct is null);

alter table public.pets
  add column if not exists skin_id text,
  add column if not exists rarity text,
  add column if not exists is_legacy int not null default 1;  -- 既有寵物全部 legacy

-- ====== 4. users 連續簽到 ======
alter table public.profiles
  add column if not exists consecutive_days int not null default 0,
  add column if not exists last_active_day text,
  add column if not exists next_egg_rarity_floor text;

-- ====== 5. daily_scores 加分明細表 ======
create table if not exists public.daily_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  day_key text not null,
  source text not null,
  source_local_id int,
  points real not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

alter table public.daily_scores enable row level security;
drop policy if exists "daily_scores_self" on public.daily_scores;
create policy "daily_scores_self" on public.daily_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_daily_scores_user_day
  on public.daily_scores(user_id, day_key);
