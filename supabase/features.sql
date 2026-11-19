-- Dedicated Jin's Trading project only. Additive schema; existing rows retained.
create table public.trading_documents (
 user_id uuid not null references auth.users(id) on delete cascade,
 document_key text not null check(document_key in ('preferences','workspace') or document_key ~ '^drawings:(us|kr):[A-Z0-9.^-]{1,20}$'),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<=524288),
 updated_at timestamptz not null default now(), primary key(user_id,document_key)
);
alter table public.trading_documents enable row level security;
revoke all on public.trading_documents from anon,authenticated;
grant select,insert,update,delete on public.trading_documents to authenticated;
create policy documents_owner on public.trading_documents for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create table public.trading_alerts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 market text not null check(market in ('us','kr')), symbol text not null check((market='us' and symbol ~ '^[A-Z][A-Z0-9.-]{0,11}$') or (market='kr' and symbol ~ '^[0-9][A-Z0-9]{5}\.(KS|KQ)$')),
 name text not null default '' check(length(name)<=200), kind text not null check(kind in ('price_above','price_below','ma_cross','volume_above','rs_above')),
 threshold double precision not null check(threshold>0 and threshold<=1e12), period integer not null default 20 check(period between 1 and 500),
 enabled boolean not null default true,created_at timestamptz not null default now(), last_checked timestamptz,last_condition boolean,last_error text,last_source_at timestamptz
);
alter table public.trading_alerts enable row level security;
revoke all on public.trading_alerts from anon,authenticated;
grant select,delete on public.trading_alerts to authenticated;
grant insert(user_id,market,symbol,name,kind,threshold,period) on public.trading_alerts to authenticated;
grant update(enabled) on public.trading_alerts to authenticated;
grant all on public.trading_alerts to service_role;
create policy alerts_owner on public.trading_alerts for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index trading_alerts_user on public.trading_alerts(user_id);
create index trading_alerts_due on public.trading_alerts(last_checked nulls first) where enabled;

create table public.trading_notifications (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 alert_id uuid unique references public.trading_alerts(id) on delete set null,market text not null,symbol text not null,message text not null,
 source_at timestamptz not null,bar_at text,created_at timestamptz not null default now(),read_at timestamptz
);
alter table public.trading_notifications enable row level security;
revoke all on public.trading_notifications from anon,authenticated;
grant select,delete on public.trading_notifications to authenticated;
grant update(read_at) on public.trading_notifications to authenticated;
grant all on public.trading_notifications to service_role;
create policy notifications_owner on public.trading_notifications for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create index trading_notifications_user_time on public.trading_notifications(user_id,created_at desc);

create schema if not exists trading_private;
revoke all on schema trading_private from public,anon,authenticated;
create function trading_private.limit_alerts() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,1));
 if (select count(*) from public.trading_alerts where user_id=new.user_id and enabled and id<>new.id)>=50 then raise exception '활성 알림은 계정당 50개까지 만들 수 있습니다.';end if;
 return new;
end $$;
create trigger trading_alert_limit before insert or update of enabled on public.trading_alerts for each row execute function trading_private.limit_alerts();

-- Only the backend can claim due alerts. Claiming serializes overlapping runs.
create function public.trading_claim_alerts() returns setof public.trading_alerts language sql security invoker set search_path='' as $$
 with due as (select id from public.trading_alerts where enabled and (last_checked is null or last_checked<now()-interval '55 seconds') order by last_checked nulls first limit 12 for update skip locked)
 update public.trading_alerts a set last_checked=now()+interval '2 minutes' from due where a.id=due.id returning a.*;
$$;
revoke all on function public.trading_claim_alerts() from public,anon,authenticated;
grant execute on function public.trading_claim_alerts() to service_role;

-- Worker authentication: a generated token stays inside Vault. The cron job
-- and service-only invoker RPC can read it; browsers cannot.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'jins_trading_alert_worker') where not exists(select 1 from vault.secrets where name='jins_trading_alert_worker');
create function public.trading_worker_key() returns text language sql security invoker set search_path='' as $$ select decrypted_secret from vault.decrypted_secrets where name='jins_trading_alert_worker' $$;
revoke all on function public.trading_worker_key() from public,anon,authenticated;
grant usage on schema vault to service_role;
grant select on vault.decrypted_secrets,vault.secrets to service_role;
grant execute on function public.trading_worker_key() to service_role;
-- Schedule is enabled only after the worker has been deployed and verified.

create function public.trading_finish_alert(rule_id uuid,condition_value boolean,source_time timestamptz,bar_time text,notification_message text,notify boolean) returns void language plpgsql security invoker set search_path='' as $$
declare rule public.trading_alerts;
begin
 select * into rule from public.trading_alerts where id=rule_id for update;
 if not found or not rule.enabled then return;end if;
 if notify then
  insert into public.trading_notifications(user_id,alert_id,market,symbol,message,source_at,bar_at) values(rule.user_id,rule.id,rule.market,rule.symbol,left(notification_message,1000),source_time,bar_time) on conflict(alert_id) do nothing;
 end if;
 update public.trading_alerts set enabled=not notify,last_checked=now(),last_condition=condition_value,last_error=null,last_source_at=source_time where id=rule.id;
end $$;
revoke all on function public.trading_finish_alert(uuid,boolean,timestamptz,text,text,boolean) from public,anon,authenticated;
grant execute on function public.trading_finish_alert(uuid,boolean,timestamptz,text,text,boolean) to service_role;
