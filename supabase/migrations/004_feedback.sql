-- 意見回饋表（App 內 /me/feedback 寫入）
-- 允許登入/未登入的 testers 都能送出 bug 報告與建議

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  type text not null check (type in ('bug', 'feature', 'praise', 'other')),
  content text not null,
  contact text,
  app_version text,
  platform text,
  device_info text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_created_at on public.feedback(created_at desc);
create index if not exists idx_feedback_type on public.feedback(type);

alter table public.feedback enable row level security;

-- 任何人（含未登入）都可 INSERT — testers 送 bug 不卡登入
drop policy if exists "feedback_insert_any" on public.feedback;
create policy "feedback_insert_any" on public.feedback
  for insert
  with check (true);

-- SELECT 只允許自己送的 + service_role（Ollie 後台看）
drop policy if exists "feedback_select_self" on public.feedback;
create policy "feedback_select_self" on public.feedback
  for select
  using (auth.uid() = user_id);
