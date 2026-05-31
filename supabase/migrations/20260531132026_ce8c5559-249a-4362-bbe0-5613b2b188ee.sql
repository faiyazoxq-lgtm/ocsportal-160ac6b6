-- Tighten SELECT policy: only the owner can read their full contact profile row
DROP POLICY IF EXISTS "All authenticated can view contact profiles" ON public.user_contact_profiles;

CREATE POLICY "Users view own contact profile"
  ON public.user_contact_profiles
  FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Safe directory view: exposes non-sensitive fields + a boolean for telegram-linked,
-- but never the telegram_chat_id itself. Runs with definer privileges so authenticated
-- users can read other people's display info without being able to query the base table.
CREATE OR REPLACE VIEW public.contact_profiles_directory
WITH (security_invoker = false) AS
SELECT
  profile_id,
  avatar_url,
  job_title,
  capability_summary,
  bio,
  telegram_username,
  (telegram_chat_id IS NOT NULL) AS telegram_linked,
  telegram_linked_at,
  last_seen_at
FROM public.user_contact_profiles;

REVOKE ALL ON public.contact_profiles_directory FROM PUBLIC, anon;
GRANT SELECT ON public.contact_profiles_directory TO authenticated;
GRANT SELECT ON public.contact_profiles_directory TO service_role;