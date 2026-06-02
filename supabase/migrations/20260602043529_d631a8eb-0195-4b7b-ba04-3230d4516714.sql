CREATE TABLE public.user_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_session_key text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  end_reason text,
  user_full_name text,
  user_email text,
  user_role text,
  sign_in_method text,
  ip text,
  city text,
  region text,
  country text,
  latitude text,
  longitude text,
  timezone text,
  isp text,
  user_agent text,
  browser text,
  os text,
  device text,
  language text,
  host text,
  referer text,
  log_text text NOT NULL DEFAULT '',
  telegram_targets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_sessions_client_session_key_idx
  ON public.user_sessions (user_id, client_session_key);
CREATE INDEX user_sessions_user_id_idx ON public.user_sessions (user_id);
CREATE INDEX user_sessions_active_idx ON public.user_sessions (ended_at) WHERE ended_at IS NULL;

GRANT SELECT ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss views all sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (is_boss(auth.uid()));

CREATE POLICY "Users view own sessions"
  ON public.user_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.touch_user_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_user_sessions_updated_at
  BEFORE UPDATE ON public.user_sessions
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_sessions_updated_at();