-- Lock down internal_settings: only bosses can read/write via the client API.
-- Server routes use the service role key which bypasses RLS.
CREATE POLICY "Boss reads internal_settings"
ON public.internal_settings
FOR SELECT
TO authenticated
USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss writes internal_settings"
ON public.internal_settings
FOR ALL
TO authenticated
USING (public.is_boss(auth.uid()))
WITH CHECK (public.is_boss(auth.uid()));