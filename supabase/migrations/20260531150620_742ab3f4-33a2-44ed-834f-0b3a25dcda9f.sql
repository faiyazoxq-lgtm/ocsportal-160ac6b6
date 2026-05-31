-- 2) Profile fields for account control + reset tracking
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS disabled_by uuid,
  ADD COLUMN IF NOT EXISTS password_reset_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS password_reset_requested_by uuid;

-- 3) is_boss helper (security definer to dodge RLS recursion)
CREATE OR REPLACE FUNCTION public.is_boss(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'boss'::public.app_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_boss(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_boss(uuid) TO authenticated, service_role;

-- 4) Boss audit log
CREATE TABLE IF NOT EXISTS public.boss_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_profile_id uuid NOT NULL,
  action_type text NOT NULL,
  target_type text,
  target_id uuid,
  reason text,
  before_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  after_json  jsonb NOT NULL DEFAULT '{}'::jsonb,
  context_json jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS boss_audit_log_created_idx     ON public.boss_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS boss_audit_log_actor_idx       ON public.boss_audit_log (actor_profile_id);
CREATE INDEX IF NOT EXISTS boss_audit_log_target_idx      ON public.boss_audit_log (target_type, target_id);
CREATE INDEX IF NOT EXISTS boss_audit_log_action_idx      ON public.boss_audit_log (action_type);

GRANT SELECT, INSERT ON public.boss_audit_log TO authenticated;
GRANT ALL ON public.boss_audit_log TO service_role;

ALTER TABLE public.boss_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss reads audit log"
  ON public.boss_audit_log FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss writes audit log"
  ON public.boss_audit_log FOR INSERT TO authenticated
  WITH CHECK (public.is_boss(auth.uid()) AND actor_profile_id = auth.uid());

-- 5) Extend existing tables so Boss can manage everything dispatchers can.
--    We add an extra "Boss manages X" ALL policy alongside the dispatcher one.

-- Profiles: Boss can view + update any profile
CREATE POLICY "Boss can view all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

-- user_roles: Boss can view + manage roles
CREATE POLICY "Boss reads all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss inserts roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Boss updates roles"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Boss deletes roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_boss(auth.uid()));

-- Operational tables: mirror the dispatcher ALL policies for Boss
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'work_orders',
    'work_order_assignments',
    'work_order_events',
    'work_order_files',
    'work_order_expenses',
    'work_order_external_contacts',
    'clients',
    'engineers',
    'engineer_availability',
    'intake_records',
    'parsing_reviews',
    'billing_cases',
    'billing_adjustments',
    'billing_status_events',
    'communication_log_entries',
    'communication_attachments',
    'external_contacts',
    'recommendations',
    'sheet_sync_log',
    'parsing_review_actions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()))',
      'Boss manages ' || t,
      t
    );
  END LOOP;
END$$;
