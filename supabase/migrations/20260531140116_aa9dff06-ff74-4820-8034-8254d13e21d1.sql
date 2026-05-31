
ALTER TABLE public.intake_records
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS extracted_sections_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS parser_version text,
  ADD COLUMN IF NOT EXISTS parse_method text,
  ADD COLUMN IF NOT EXISTS parse_error text,
  ADD COLUMN IF NOT EXISTS ocr_used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS extraction_confidence_by_field jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_intake_records_parse_method
  ON public.intake_records (parse_method);
