-- Account self-deletion RPC, required by Apple App Store Guideline 5.1.1(v).
-- All app tables reference auth.users(id) ON DELETE CASCADE, so deleting the
-- auth user row removes every related record automatically.
-- Run this in Supabase SQL Editor once.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
