-- Kibo v1.1.0 雲同步收尾（批 D2）—— ⚠️ 不可逆，最後才跑。
--
-- 前提（務必全部滿足才執行）：
--   1. 005 已上、v1.1.0 已上架。
--   2. App Store Connect / Play Console 的版本分佈顯示舊版（<1.1.0）占比夠低（建議 <10%）。
--   3. 已確認 v1.1.0 的 UUID 同步在真機/測試專案運作正常。
--
-- 作用：drop 14 表的 unique(user_id, local_id)，讓 client_uuid 成為唯一同步鍵。
--
-- ⚠️⚠️ 目前**絕對不可執行** ⚠️⚠️
-- 深審發現：app 端所有 upsert 的 onConflict 仍是 'user_id,local_id'。一旦 drop 掉該約束，
-- Postgres 會因找不到可推論的唯一約束而回 42P10 → **連 v1.1.0 自己的 push 也全部失敗**，
-- 不只是舊版 client。原本 header 宣稱「只有舊版會失敗」是錯的。
-- 先決條件（全部滿足才可執行）：
--   1. app 端 cap=true 路徑的 6 個 P0 已修（見 cloud_sync.ts 的 KILL SWITCH 註解）。
--   2. push 已改用 onConflict: 'user_id,client_uuid'（需 005 的完整 unique index）。
--   3. 已在測試 Supabase 專案完整演練 005 → app → 006。
--   4. 商店版本分佈顯示舊版占比夠低（建議 <10%）。
-- 跑了不可逆。在 Supabase SQL Editor 執行。

do $$
declare
  t text;
  cn text;
begin
  foreach t in array array['workouts','workout_sets','meals','body_measurements',
    'routines','routine_exercises','eggs','pets','achievements',
    'custom_foods','water_logs','bowel_logs','sleep_logs','period_days']
  loop
    -- 找該表 unique(user_id, local_id) 約束的實際名稱後 drop
    select tc.constraint_name into cn
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name and tc.table_schema = ccu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = t
      and tc.constraint_type = 'UNIQUE'
      and ccu.column_name = 'local_id'
    limit 1;
    if cn is not null then
      execute format('alter table public.%I drop constraint %I', t, cn);
      raise notice 'dropped % on %', cn, t;
    end if;
    -- 保留一個普通 index 供 legacy 查詢/reconcile 用（非 unique）
    execute format('create index if not exists %I on public.%I(user_id, local_id)', 'idx_' || t || '_user_local', t);
  end loop;
end$$;
