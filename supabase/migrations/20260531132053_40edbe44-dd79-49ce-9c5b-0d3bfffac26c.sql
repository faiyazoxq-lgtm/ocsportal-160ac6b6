-- Roll back previous attempt (security-definer view tripped the view linter)
DROP VIEW IF EXISTS public.contact_profiles_directory;
DROP POLICY IF EXISTS "Users view own contact profile" ON public.user_contact_profiles;

-- Restore broad directory read (display fields), but lock down the raw chat id at the column level
CREATE POLICY "All authenticated can view contact profiles"
  ON public.user_contact_profiles
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE SELECT (telegram_chat_id) ON public.user_contact_profiles FROM authenticated;
REVOKE SELECT (telegram_chat_id) ON public.user_contact_profiles FROM anon;
-- service_role keeps full access for server-side Telegram dispatch
GRANT SELECT (telegram_chat_id) ON public.user_contact_profiles TO service_role;