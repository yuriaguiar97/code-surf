-- Apply after provisioning code_push_config with server-only VAPID keys and cron secret.
-- The scheduled command reads the secret at runtime rather than embedding it in cron.job.
select cron.schedule('code-swell-push-hourly', '15 * * * *', $$
  select net.http_post(
    url := 'https://aaiynfintqsjvkaitmlz.supabase.co/functions/v1/code-push',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('action','run','secret',
      (select cron_secret from public.code_push_config where id=1)),
    timeout_milliseconds := 120000
  );
$$);
