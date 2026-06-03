-- engineers: column-level grants
REVOKE SELECT ON public.engineers FROM authenticated;
GRANT SELECT (
  id, profile_id, engineer_code, display_name,
  trade_tags, certification_tags, covered_postcode_zones,
  can_lead, can_support, active_status, notes, avatar_url,
  created_at, updated_at
) ON public.engineers TO authenticated;
GRANT SELECT ON public.engineers TO service_role;

DROP POLICY IF EXISTS "Authenticated can view engineers" ON public.engineers;
CREATE POLICY "Authenticated view engineer directory"
  ON public.engineers FOR SELECT TO authenticated USING (true);

-- user_contact_profiles: column-level grants
REVOKE SELECT ON public.user_contact_profiles FROM authenticated;
GRANT SELECT (
  profile_id, avatar_url, job_title, capability_summary, bio,
  last_seen_at, created_at, updated_at
) ON public.user_contact_profiles TO authenticated;
GRANT ALL ON public.user_contact_profiles TO service_role;

DROP POLICY IF EXISTS "All authenticated can view contact profiles" ON public.user_contact_profiles;
CREATE POLICY "Authenticated view contact directory"
  ON public.user_contact_profiles FOR SELECT TO authenticated USING (true);
-- Owners can read their own telegram link fields (via column grant scoped by row)
CREATE POLICY "Users view own telegram link"
  ON public.user_contact_profiles FOR SELECT TO authenticated USING (profile_id = auth.uid());
GRANT SELECT (telegram_username, telegram_chat_id, telegram_linked_at)
  ON public.user_contact_profiles TO authenticated;

-- external_contacts: tighten to boss/dispatcher only
DROP POLICY IF EXISTS "All authenticated can view external_contacts" ON public.external_contacts;
CREATE POLICY "Boss and dispatchers view external contacts"
  ON public.external_contacts FOR SELECT TO authenticated
  USING (
    public.is_boss(auth.uid())
    OR public.has_role(auth.uid(), 'dispatcher'::public.app_role)
  );

-- session_activity_events: block direct client writes
REVOKE INSERT, UPDATE, DELETE ON public.session_activity_events FROM authenticated;
GRANT ALL ON public.session_activity_events TO service_role;

-- SECURITY DEFINER helpers used by RLS: grant only to authenticated/service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_boss(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_boss(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.engineer_is_assigned(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.engineer_is_assigned(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.engineer_is_lead(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.engineer_is_lead(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.current_engineer_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.current_engineer_id() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_thread_participant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_thread_participant(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.claim_first_boss() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.claim_first_boss() TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.seed_demo_data() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.seed_demo_data() TO authenticated, service_role;

-- Internal/admin-only helpers: deny everyone except service_role
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, public.notification_severity, text, text, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.create_notification(uuid, public.notification_type, public.notification_severity, text, text, text, text, uuid, jsonb, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_assigned_engineers(uuid, public.notification_type, public.notification_severity, text, text, text, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_assigned_engineers(uuid, public.notification_type, public.notification_severity, text, text, text, jsonb, text) TO service_role;
REVOKE EXECUTE ON FUNCTION public.notify_dispatchers(public.notification_type, public.notification_severity, text, text, text, text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.notify_dispatchers(public.notification_type, public.notification_severity, text, text, text, text, uuid, jsonb, text) TO service_role;

-- Trigger helper functions — only invoked by triggers; revoke broad EXECUTE
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_engineer_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_engineer_from_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_active_field_lock() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_bump_thread_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_assignment_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_assignment_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_billing_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_engineer_unavailable() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_intake_record() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_parsing_review_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notif_work_order_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_notify_work_order_pdf() FROM PUBLIC, anon, authenticated;

-- Fix mutable search_path
ALTER FUNCTION public.wo_id_from_path(text) SET search_path = public;