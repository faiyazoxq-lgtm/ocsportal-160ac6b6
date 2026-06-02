CREATE POLICY "All authenticated can view external_contacts"
ON public.external_contacts
FOR SELECT
TO authenticated
USING (true);