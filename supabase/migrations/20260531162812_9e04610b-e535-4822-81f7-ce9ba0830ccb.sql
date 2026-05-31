
-- 1) Let all authenticated users see the staff directory (engineers can now view colleagues).
CREATE POLICY "Authenticated can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- 2) Prevent self role-escalation / self-reactivation via PostgREST.
--    Only boss server functions (using service role) and boss policy with column-level grant
--    may change role / is_active / disabled_*. Authenticated users may only edit safe fields.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, updated_at) ON public.profiles TO authenticated;

-- 3) Hide telegram_chat_id from clients (server code uses service role).
REVOKE SELECT (telegram_chat_id) ON public.user_contact_profiles FROM authenticated;
REVOKE SELECT (telegram_chat_id) ON public.user_contact_profiles FROM anon;
