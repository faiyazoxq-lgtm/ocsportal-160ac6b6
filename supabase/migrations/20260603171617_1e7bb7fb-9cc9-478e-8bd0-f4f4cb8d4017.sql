DROP POLICY IF EXISTS "Authenticated view contact directory" ON public.user_contact_profiles;

CREATE POLICY "Bosses and dispatchers view contact directory"
ON public.user_contact_profiles
AS PERMISSIVE FOR SELECT
TO authenticated
USING (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'dispatcher'::public.app_role));