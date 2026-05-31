-- Defense-in-depth: explicit UPDATE/DELETE policies on storage.objects for OCS buckets.
-- Without these, default-deny applies; these make intent explicit and prevent
-- accidental over-grant from a future broad policy.

-- Work-order buckets: dispatchers can update/delete; lead engineers can manage files on their assigned WO path.
DO $$
DECLARE b text;
BEGIN
  FOREACH b IN ARRAY ARRAY[
    'work-order-source-docs',
    'work-order-evidence',
    'work-order-signatures',
    'work-order-receipts'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects
        FOR UPDATE TO authenticated
        USING (bucket_id = %L AND (
          public.has_role(auth.uid(),'dispatcher')
          OR public.engineer_is_lead(public.wo_id_from_path(name))
        ))
        WITH CHECK (bucket_id = %L AND (
          public.has_role(auth.uid(),'dispatcher')
          OR public.engineer_is_lead(public.wo_id_from_path(name))
        ));
    $f$, b || ' update dispatcher or lead', b, b);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = %L AND public.has_role(auth.uid(),'dispatcher'));
    $f$, b || ' delete dispatcher', b);
  END LOOP;
END $$;

-- Direct message attachments: only the original uploader (sender) can delete their own files.
CREATE POLICY "DM attachments: uploader delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'direct-message-attachments'
  AND owner = auth.uid()
);