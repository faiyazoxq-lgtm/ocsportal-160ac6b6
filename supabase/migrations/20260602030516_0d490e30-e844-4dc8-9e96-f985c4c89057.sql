CREATE POLICY "All authenticated can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);