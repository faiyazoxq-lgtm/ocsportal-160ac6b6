
ALTER TABLE public.intake_records
  ADD COLUMN IF NOT EXISTS duplicate_rationale_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS duplicate_review_status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS duplicate_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS duplicate_resolved_by uuid,
  ADD COLUMN IF NOT EXISTS duplicate_scanned_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_intake_records_dup_review_status
  ON public.intake_records (duplicate_review_status)
  WHERE duplicate_review_status <> 'open';

CREATE INDEX IF NOT EXISTS idx_intake_records_parse_status
  ON public.intake_records (parse_status);
