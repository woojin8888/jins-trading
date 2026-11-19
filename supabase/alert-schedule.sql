select cron.schedule('jins-trading-alerts','* * * * *',$job$
 select net.http_post(url:='https://dsrzoofxojiipgdmnsmq.supabase.co/functions/v1/trading-alert-worker',
 headers:=jsonb_build_object('Content-Type','application/json','x-trading-worker-token',(select decrypted_secret from vault.decrypted_secrets where name='jins_trading_alert_worker')),
 body:='{}'::jsonb,timeout_milliseconds:=55000)
 where exists(select 1 from public.trading_alerts where enabled);
$job$);
