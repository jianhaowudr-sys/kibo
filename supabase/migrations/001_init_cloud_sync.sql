-- Kibo cloud sync schema (v1)
-- Strategy: each device keeps a local SQLite ID; cloud rows are uniquely identified by (user_id, local_id).
-- Upsert is done by (user_id, local_id) unique constraint. Last-write-wins via updated_at.
-- Run this in Supabase SQL Editor.

-- ============================================================
-- 1) profile (1 row per auth user, mirrors local users[0])
-- ============================================================
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '健身新手',
  height_cm real,
  weight_kg real,
  goal text not null default 'fit',
  daily_exp_goal int not null default 100,
  weekly_days_goal int not null default 3,
  daily_calories_goal int not null default 2000,
  daily_protein_goal int not null default 100,
  streak int not null default 0,
  last_workout_date text,
  total_workouts int not null default 0,
  total_exp int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2) workouts
-- ============================================================
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  note text,
  total_exp int not null default 0,
  total_volume real not null default 0,
  duration_sec int not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
create index if not exists workouts_user_started_idx on public.workouts(user_id, started_at desc);

alter table public.workouts enable row level security;
drop policy if exists "workouts_self" on public.workouts;
create policy "workouts_self" on public.workouts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 3) workout_sets (denormalized: exercise_name+unit instead of FK to exercises)
-- ============================================================
create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  workout_local_id int not null,
  exercise_name text not null,
  exercise_unit text not null default 'reps',
  order_idx int not null,
  weight real,
  reps int,
  duration_sec int,
  distance_m real,
  completed boolean not null default false,
  exp int not null default 0,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
create index if not exists workout_sets_user_workout_idx on public.workout_sets(user_id, workout_local_id);

alter table public.workout_sets enable row level security;
drop policy if exists "workout_sets_self" on public.workout_sets;
create policy "workout_sets_self" on public.workout_sets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 4) meals
-- ============================================================
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  logged_at timestamptz not null,
  meal_type text not null,
  title text,
  items_json jsonb,
  calories_kcal int,
  protein_g real,
  carb_g real,
  fat_g real,
  photo_uri text,
  note text,
  ai_parsed boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
create index if not exists meals_user_logged_idx on public.meals(user_id, logged_at desc);

alter table public.meals enable row level security;
drop policy if exists "meals_self" on public.meals;
create policy "meals_self" on public.meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 5) body_measurements
-- ============================================================
create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  measured_at timestamptz not null,
  weight_kg real,
  body_fat_pct real,
  skeletal_muscle_kg real,
  muscle_mass_kg real,
  protein_kg real,
  body_fat_kg real,
  mineral_kg real,
  body_water_kg real,
  bmr int,
  visceral_fat_level int,
  body_score int,
  photo_uri text,
  note text,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
create index if not exists body_user_measured_idx on public.body_measurements(user_id, measured_at desc);

alter table public.body_measurements enable row level security;
drop policy if exists "body_self" on public.body_measurements;
create policy "body_self" on public.body_measurements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 6) routines + routine_exercises
-- ============================================================
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  name text not null,
  emoji text not null default '💪',
  note text,
  last_snapshot_json jsonb,
  last_saved_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

alter table public.routines enable row level security;
drop policy if exists "routines_self" on public.routines;
create policy "routines_self" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  routine_local_id int not null,
  exercise_name text not null,
  exercise_unit text not null default 'reps',
  order_idx int not null,
  target_sets int not null default 3,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);
create index if not exists routine_ex_user_routine_idx on public.routine_exercises(user_id, routine_local_id);

alter table public.routine_exercises enable row level security;
drop policy if exists "routine_ex_self" on public.routine_exercises;
create policy "routine_ex_self" on public.routine_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 7) eggs + pets
-- ============================================================
create table if not exists public.eggs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  type text not null,
  current_exp int not null default 0,
  required_exp int not null default 500,
  stage int not null default 0,
  hatched_at timestamptz,
  pet_local_id int,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

alter table public.eggs enable row level security;
drop policy if exists "eggs_self" on public.eggs;
create policy "eggs_self" on public.eggs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  egg_local_id int,
  name text not null,
  species text not null,
  type text not null,
  level int not null default 1,
  exp int not null default 0,
  stage int not null default 1,
  emoji text not null default '🐣',
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

alter table public.pets enable row level security;
drop policy if exists "pets_self" on public.pets;
create policy "pets_self" on public.pets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- 8) achievements
-- ============================================================
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id int not null,
  code text not null,
  title text not null,
  description text,
  unlocked_at timestamptz not null,
  updated_at timestamptz not null default now(),
  unique(user_id, local_id)
);

alter table public.achievements enable row level security;
drop policy if exists "achievements_self" on public.achievements;
create policy "achievements_self" on public.achievements
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- Done.
-- ============================================================
