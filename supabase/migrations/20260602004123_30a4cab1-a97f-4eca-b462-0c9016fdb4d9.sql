-- Add basic personnel fields to engineers (used by the simplified create form).
ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS personal_email text,
  ADD COLUMN IF NOT EXISTS contact_number text,
  ADD COLUMN IF NOT EXISTS hourly_pay_rate numeric,
  ADD COLUMN IF NOT EXISTS van_registration text,
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Allow dispatcher / boss to upload engineer profile photos into the existing
-- public user-avatars bucket, scoped to the engineers/<engineer-id>/... folder.
DROP POLICY IF EXISTS "Dispatcher boss upload engineer avatar" ON storage.objects;
CREATE POLICY "Dispatcher boss upload engineer avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = 'engineers'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'dispatcher'::app_role))
);

DROP POLICY IF EXISTS "Dispatcher boss update engineer avatar" ON storage.objects;
CREATE POLICY "Dispatcher boss update engineer avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = 'engineers'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'dispatcher'::app_role))
);

DROP POLICY IF EXISTS "Dispatcher boss delete engineer avatar" ON storage.objects;
CREATE POLICY "Dispatcher boss delete engineer avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'user-avatars'
  AND (storage.foldername(name))[1] = 'engineers'
  AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'dispatcher'::app_role))
);