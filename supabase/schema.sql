-- Jin's Trading · 진스트레이딩. Apply only to the dedicated jins-trading project.
create table public.trading_watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null check (market in ('us','kr')),
  symbol text not null check (length(symbol) between 1 and 20),
  name text not null default '' check (length(name)<=200),
  group_name text not null default '기본 그룹' check (length(group_name)<=60),
  created_at timestamptz not null default now(),
  primary key(user_id,market,symbol)
);
create table public.trading_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  market text not null check (market in ('us','kr')),
  symbol text not null check (length(symbol) between 1 and 20),
  content text not null default '' check (length(content)<=10000),
  updated_at timestamptz not null default now(),
  primary key(user_id,market,symbol)
);
alter table public.trading_watchlist enable row level security;
alter table public.trading_notes enable row level security;
revoke all on public.trading_watchlist,public.trading_notes from anon;
grant select,insert,update,delete on public.trading_watchlist,public.trading_notes to authenticated;
create policy watchlist_owner on public.trading_watchlist for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy notes_owner on public.trading_notes for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
