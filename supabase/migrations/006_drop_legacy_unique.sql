-- Kibo v1.1.0 雲同步收尾（批 D2）—— ⚠️ 不可逆，最後才跑。
--
-- 前提（務必全部滿足才執行）：
--   1. 005 已上、v1.1.0 已上架。
--   2. App Store Connect / Play Console 的版本分佈顯示舊版（<1.1.0）占比夠低（建議 <10%）。
--   3. 已確認 v1.1.0 的 UUID 同步在真機/測試專案運作正常。
--
-- 作用：drop 14 表的 unique(user_id, local_id)，讓 client_uuid 成為唯一同步鍵。
-- 副作用：跑完後未升級到 v1.1.0 的舊版 client push 會失敗（本地資料無損）——這是接受的代價，
--         故務必等舊版占比夠低。跑了不可逆。
-- 在 Supabase SQL Editor 執行。

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
