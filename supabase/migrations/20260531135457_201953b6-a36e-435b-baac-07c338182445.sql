
-- Extend intake_records with explicit source-capture metadata
ALTER TABLE public.intake_records
  ADD COLUMN IF NOT EXISTS source_sender text,
  ADD COLUMN IF NOT EXISTS source_subject text,
  ADD COLUMN IF NOT EXISTS received_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS original_mime_type text,
  ADD COLUMN IF NOT EXISTS original_byte_size bigint,
  ADD COLUMN IF NOT EXISTS capture_status text NOT NULL DEFAULT 'captured',
  ADD COLUMN IF NOT EXISTS parsing_queued_at timestamptz,
  ADD COLUMN IF NOT EXISTS parsing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS parsing_completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_intake_records_received_at
  ON public.intake_records (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_intake_records_source_type
  ON public.intake_records (source_type);
CREATE INDEX IF NOT EXISTS idx_intake_records_capture_status
  ON public.intake_records (capture_status);

-- Private bucket for original source files (PDFs, eml, attachments, webhook payloads)
INSERT INTO storage.buckets (id, name, public)
VALUES ('intake-sources', 'intake-sources', false)
ON CONFLICT (id) DO NOTHING;

-- Dispatcher-only access on the intake-sources bucket
DROP POLICY IF EXISTS "Dispatchers read intake sources" ON storage.objects;
CREATE POLICY "Dispatchers read intake sources"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'intake-sources' AND public.has_role(auth.uid(), 'dispatcher'));

DROP POLICY IF EXISTS "Dispatchers upload intake sources" ON storage.objects;
CREATE POLICY "Dispatchers upload intake sources"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'intake-sources' AND public.has_role(auth.uid(), 'dispatcher'));

DROP POLICY IF EXISTS "Dispatchers update intake sources" ON storage.objects;
CREATE POLICY "Dispatchers update intake sources"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'intake-sources' AND public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (bucket_id = 'intake-sources' AND public.has_role(auth.uid(), 'dispatcher'));

DROP POLICY IF EXISTS "Dispatchers delete intake sources" ON storage.objects;
CREATE POLICY "Dispatchers delete intake sources"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'intake-sources' AND public.has_role(auth.uid(), 'dispatcher'));
