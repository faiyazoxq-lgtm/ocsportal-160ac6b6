-- 1. Tighten profiles: drop the open "view all" policy so sensitive admin
--    columns (temp_password_*, password_reset_*, disabled_*, is_active) are
--    not exposed to every authenticated user. Self / boss / dispatcher
--    policies already cover legitimate read paths.
DROP POLICY IF EXISTS "Authenticated can view profiles" ON public.profiles;

-- 2. Allow boss to read files in the intake-sources storage bucket
--    (mirrors boss access on intake_records).
CREATE POLICY "Boss read intake sources"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'intake-sources' AND public.is_boss(auth.uid()));

-- 3. Remove broad SELECT policy on user-avatars that allows any
--    authenticated user to LIST every avatar object. The bucket remains
--    public so avatar URLs continue to load via the public object endpoint,
--    which does not require this policy.
DROP POLICY IF EXISTS "Avatar images readable by authenticated" ON storage.objects;
