
-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Internal settings (server-only)
CREATE TABLE IF NOT EXISTS public.internal_settings (
  key   text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.internal_settings FROM anon, authenticated;
GRANT  ALL ON public.internal_settings TO service_role;

ALTER TABLE public.internal_settings ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (which bypasses RLS) can read/write.

-- 3. Generate a random bearer token if not already present
INSERT INTO public.internal_settings(key, value)
VALUES ('telegram_flush_token', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- 4. Cron job: every minute hit the public flush endpoint with the bearer
DO $$
DECLARE
  _token text;
  _url   text := 'https://ocsportal.lovable.app/api/public/notifications/flush-telegram';
BEGIN
  SELECT value INTO _token FROM public.internal_settings WHERE key = 'telegram_flush_token';

  -- Unschedule any prior version
  PERFORM cron.unschedule(jobid)
  FROM cron.job WHERE jobname = 'flush_telegram_notifications_every_minute';

  PERFORM cron.schedule(
    'flush_telegram_notifications_every_minute',
    '* * * * *',
    format($cron$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 8000
      );
    $cron$, _url, 'Bearer ' || _token)
  );
END $$;
