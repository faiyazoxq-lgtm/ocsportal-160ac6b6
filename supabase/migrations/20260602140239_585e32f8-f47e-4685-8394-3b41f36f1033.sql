DO $$
BEGIN
  PERFORM cron.unschedule('flush-telegram-notifications');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'flush-telegram-notifications',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--7bc054e2-4753-4359-b744-bb8607bf056d.lovable.app/api/public/notifications/flush-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM public.internal_settings WHERE key = 'telegram_flush_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);