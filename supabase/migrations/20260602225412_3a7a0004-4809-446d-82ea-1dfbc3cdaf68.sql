ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS email_signature jsonb NOT NULL DEFAULT jsonb_build_object(
    'company_name', 'OCS - On Call Service',
    'tagline', 'Property maintenance & repairs',
    'phone', '',
    'email', '',
    'website', 'https://ocsportal.co.uk',
    'address', '',
    'logo_url', 'https://ocsportal.lovable.app/ocs-logo.png'
  );

CREATE TABLE IF NOT EXISTS public.telegram_email_sessions (
  chat_id text PRIMARY KEY,
  stage text NOT NULL,
  contact_kind text,
  contact_id uuid,
  contact_name text,
  contact_email text,
  subject text,
  body text,
  actor_profile_id uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_email_sessions TO authenticated;
GRANT ALL ON public.telegram_email_sessions TO service_role;
ALTER TABLE public.telegram_email_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boss/dispatcher manage telegram email sessions" ON public.telegram_email_sessions;
CREATE POLICY "boss/dispatcher manage telegram email sessions"
  ON public.telegram_email_sessions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'dispatcher'));

CREATE TABLE IF NOT EXISTS public.outbound_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'telegram',
  actor_profile_id uuid,
  contact_kind text,
  contact_id uuid,
  recipient_name text,
  recipient_email text NOT NULL,
  from_address text,
  subject text,
  body_preview text,
  gmail_message_id text,
  gmail_thread_id text,
  status text NOT NULL DEFAULT 'sent',
  error_message text
);
GRANT SELECT, INSERT ON public.outbound_email_log TO authenticated;
GRANT ALL ON public.outbound_email_log TO service_role;
ALTER TABLE public.outbound_email_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "boss/dispatcher read outbound email log" ON public.outbound_email_log;
CREATE POLICY "boss/dispatcher read outbound email log"
  ON public.outbound_email_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'dispatcher'));
DROP POLICY IF EXISTS "boss/dispatcher insert outbound email log" ON public.outbound_email_log;
CREATE POLICY "boss/dispatcher insert outbound email log"
  ON public.outbound_email_log
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'dispatcher'));