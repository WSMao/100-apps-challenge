-- ==============================================================================
-- 100 Apps Challenge: Supabase 全網統計資料庫架構 (app_stats)
-- 請複製以下整段 SQL，至 Supabase 後台 -> SQL Editor -> 點擊「New query」貼上並執行 (Run)
-- ==============================================================================

-- 1. 建立統計表格 app_stats
create table if not exists public.app_stats (
  app_id text primary key,
  likes integer not null default 0,
  views integer not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. 啟用 Row Level Security (RLS) 安全機制
alter table public.app_stats enable row level security;

-- 3. 政策：允許全世界任何人 (anon + authenticated) 讀取統計數據
drop policy if exists "Allow public read access" on public.app_stats;
create policy "Allow public read access"
  on public.app_stats for select
  using (true);

-- 4. 寫入初始種子資料 (001-Challenge Showcase)
insert into public.app_stats (app_id, likes, views)
values ('001', 0, 0)
on conflict (app_id) do update set
  updated_at = now();

-- 5. 建立安全的原子計數 RPC 函式 (防高並行 race condition)

-- 5-1. 按讚增加 (若不存在則初始化並設 likes=1)
create or replace function public.increment_likes(target_app_id text)
returns void as $$
begin
  insert into public.app_stats (app_id, likes, views)
  values (target_app_id, 1, 0)
  on conflict (app_id)
  do update set
    likes = public.app_stats.likes + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- 5-2. 按讚收回 (不得低於 0)
create or replace function public.decrement_likes(target_app_id text)
returns void as $$
begin
  update public.app_stats
  set
    likes = greatest(0, public.app_stats.likes - 1),
    updated_at = now()
  where app_id = target_app_id;
end;
$$ language plpgsql security definer;

-- 5-3. 瀏覽人次增加 (若不存在則初始化並設 views=1)
create or replace function public.increment_views(target_app_id text)
returns void as $$
begin
  insert into public.app_stats (app_id, likes, views)
  values (target_app_id, 0, 1)
  on conflict (app_id)
  do update set
    views = public.app_stats.views + 1,
    updated_at = now();
end;
$$ language plpgsql security definer;

-- 6. 賦予公開角色 (anon / authenticated) 讀取表格與執行計數 RPC 的權限
grant select on table public.app_stats to anon, authenticated;
grant execute on function public.increment_likes(text) to anon, authenticated;
grant execute on function public.decrement_likes(text) to anon, authenticated;
grant execute on function public.increment_views(text) to anon, authenticated;
