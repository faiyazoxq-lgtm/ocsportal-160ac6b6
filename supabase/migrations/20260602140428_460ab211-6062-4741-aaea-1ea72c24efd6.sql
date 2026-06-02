CREATE TABLE public.session_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.user_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  event_kind text NOT NULL,
  path text,
  label text,
  target text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_activity_events_session_idx
  ON public.session_activity_events (session_id, occurred_at);

GRANT SELECT ON public.session_activity_events TO authenticated;
GRANT ALL ON public.session_activity_events TO service_role;

ALTER TABLE public.session_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss views all session activity"
  ON public.session_activity_events
  FOR SELECT
  TO authenticated
  USING (public.is_boss(auth.uid()));