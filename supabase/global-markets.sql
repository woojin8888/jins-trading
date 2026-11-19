-- Additive scope extension on the dedicated Jin's Trading database.
begin;
create function public.trading_valid_instrument(scope text,ticker text) returns boolean
language sql immutable strict security invoker set search_path='' as $fn$
 select case scope
 when 'us' then ticker ~ '^(\^[A-Z]{2,8}|[A-Z][A-Z0-9.-]{0,11})$'
 when 'kr' then ticker ~ '^(\^KS11|\^KQ11|[0-9][A-Z0-9]{5}(\.(KS|KQ))?)$'
 when 'etf' then ticker ~ '^[A-Z][A-Z0-9-]{0,11}$'
 when 'etfkr' then ticker ~ '^[0-9][A-Z0-9]{5}\.KS$'
 when 'jp' then ticker ~ '^[A-Z0-9]{4}\.T$'
 when 'hk' then ticker ~ '^[0-9]{4,5}\.HK$'
 when 'cn' then ticker ~ '^[0-9]{6}\.(SS|SZ)$'
 when 'uk' then ticker ~ '^[A-Z0-9-]{1,10}\.L$'
 when 'de' then ticker ~ '^[A-Z0-9-]{1,10}\.DE$'
 when 'fr' then ticker ~ '^[A-Z0-9-]{1,10}\.PA$'
 when 'ca' then ticker ~ '^[A-Z0-9-]{1,10}\.TO$'
 when 'au' then ticker ~ '^[A-Z0-9-]{1,10}\.AX$'
 when 'in' then ticker ~ '^[A-Z0-9&-]{1,15}\.NS$'
 when 'tw' then ticker ~ '^[A-Z0-9]{4,8}\.(TW|TWO)$'
 when 'sg' then ticker ~ '^[A-Z0-9]{2,10}\.SI$'
 when 'indices' then ticker ~ '^(\^[A-Z0-9]{2,12}|[0-9]{6}\.(SS|SZ))$'
 when 'fx' then ticker='DX-Y.NYB' or ticker ~ '^[A-Z]{3}([A-Z]{3})?=X$'
 when 'commodities' then ticker ~ '^[A-Z0-9]{1,8}=F$'
 else false end;
$fn$;
revoke all on function public.trading_valid_instrument(text,text) from public,anon;
grant execute on function public.trading_valid_instrument(text,text) to authenticated,service_role;
alter table public.trading_watchlist drop constraint trading_watchlist_market_check;
alter table public.trading_watchlist add constraint trading_watchlist_market_check check(market in ('us','kr','jp','hk','cn','uk','de','fr','ca','au','in','tw','sg','indices','fx','commodities','etf','etfkr'));
alter table public.trading_notes drop constraint trading_notes_market_check;
alter table public.trading_notes add constraint trading_notes_market_check check(market in ('us','kr','jp','hk','cn','uk','de','fr','ca','au','in','tw','sg','indices','fx','commodities','etf','etfkr'));
alter table public.trading_alerts drop constraint trading_alerts_market_check;
alter table public.trading_alerts add constraint trading_alerts_market_check check(market in ('us','kr','jp','hk','cn','uk','de','fr','ca','au','in','tw','sg','indices','fx','commodities','etf','etfkr'));
alter table public.trading_alerts drop constraint trading_alerts_check;
alter table public.trading_alerts add constraint trading_alerts_check check(public.trading_valid_instrument(market,symbol));
alter table public.trading_documents drop constraint trading_documents_document_key_check;
alter table public.trading_documents add constraint trading_documents_document_key_check check(document_key in ('preferences','workspace') or document_key ~ '^drawings:(us|kr|jp|hk|cn|uk|de|fr|ca|au|in|tw|sg|indices|fx|commodities|etf|etfkr):[A-Z0-9.^=&-]{1,20}$');
commit;
