ALTER TABLE public.intake_records
  ADD COLUMN IF NOT EXISTS normalized_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS normalization_warnings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS normalization_version text,
  ADD COLUMN IF NOT EXISTS normalization_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS normalization_applied_by uuid;