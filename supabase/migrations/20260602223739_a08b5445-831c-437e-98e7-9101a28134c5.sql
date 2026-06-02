
CREATE TABLE public.telegram_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  followup_type text NOT NULL CHECK (followup_type IN ('unknown_email_sender','unknown_phone_sender')),
  sender_value text NOT NULL,
  sender_name text,
  source_reference text,
  source_record_type text,
  source_record_id uuid,
  preview text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','ignored')),
  resolved_action text,
  resolved_target_id uuid,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (followup_type, sender_value)
);

CREATE INDEX idx_telegram_followups_status ON public.telegram_followups (status, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.telegram_followups TO authenticated;
GRANT ALL ON public.telegram_followups TO service_role;

ALTER TABLE public.telegram_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss + dispatchers view followups"
  ON public.telegram_followups FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'dispatcher'));

CREATE POLICY "Boss + dispatchers update followups"
  ON public.telegram_followups FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.is_boss(auth.uid()) OR public.has_role(auth.uid(),'dispatcher'));
