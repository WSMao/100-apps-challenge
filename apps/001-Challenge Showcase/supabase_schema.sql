-- ==============================================================================
-- 100 Apps Challenge: Supabase 全網統計資料庫架構 (app001.app_stats)
-- 請複製以下整段 SQL，至 Supabase 後台 -> SQL Editor -> 點擊「New query」貼上並執行 (Run)
-- ==============================================================================

-- 1. 建立專屬 schema app001
create schema if not exists app001;

-- 2. 建立統計表格 app_stats
create table if not exists app001.app_stats (
  app_id text primary key,
  likes integer not null default 0,
  views integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. 啟用 Row Level Security (RLS) 安全機制
alter table app001.app_stats enable row level security;

-- 4. 政策：允許全世界任何人 (anon + authenticated) 讀取統計數據
drop policy if exists "Allow public read access" on app001.app_stats;
create policy "Allow public read access"
  on app001.app_stats for select
  using (true);

-- 5. 寫入初始種子資料 (001-Challenge Showcase)
insert into app001.app_stats (app_id, likes, views)
values ('001', 0, 0)
on conflict (app_id) do update set
  updated_at = now();

-- 6. 賦予訪客角色 (anon / authenticated) 使用 app001 schema 與讀取表格權限
grant usage on schema app001 to anon, authenticated;
grant select on table app001.app_stats to anon, authenticated;

-- 7. 建立安全的原子計數 RPC 函式 (防高並行 race condition)

-- 7-1. 按讚增加 (若不存在則初始化並設 likes=1)
create or replace function app001.increment_likes(target_app_id text)
returns void as $$
begin
  insert into app001.app_stats (app_id, likes, views)
  values (target_app_id, 1, 0)
  on conflict (app_id)
  do update set
    likes = app001.app_stats.likes + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- 7-2. 按讚收回 (不得低於 0)
create or replace function app001.decrement_likes(target_app_id text)
returns void as $$
begin
  update app001.app_stats
  set
    likes = greatest(0, app001.app_stats.likes - 1),
    updated_at = now()
  where app_id = target_app_id;
end;
$$ language plpgsql security definer;

-- 7-3. 瀏覽人次增加 (若不存在則初始化並設 views=1)
create or replace function app001.increment_views(target_app_id text)
returns void as $$
begin
  insert into app001.app_stats (app_id, likes, views)
  values (target_app_id, 0, 1)
  on conflict (app_id)
  do update set
    views = app001.app_stats.views + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- 8. 賦予公開角色執行計數 RPC 的權限
grant execute on function app001.increment_likes(text) to anon, authenticated;
grant execute on function app001.decrement_likes(text) to anon, authenticated;
grant execute on function app001.increment_views(text) to anon, authenticated;
