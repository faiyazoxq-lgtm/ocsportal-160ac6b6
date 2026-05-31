DROP POLICY IF EXISTS "Avatar images publicly readable" ON storage.objects;

CREATE POLICY "Avatar images readable by authenticated"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'user-avatars');