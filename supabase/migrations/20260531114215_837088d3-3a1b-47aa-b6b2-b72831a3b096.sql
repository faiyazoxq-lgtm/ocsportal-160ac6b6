-- Intake processing tables
CREATE TYPE public.intake_state AS ENUM (
  'received','parsing','parsed','needs_review','duplicate_suspected','approved','rejected','converted'
);

CREATE TYPE public.intake_source_type AS ENUM ('email','webhook','upload','manual');

CREATE TABLE public.intake_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type public.intake_source_type NOT NULL DEFAULT 'manual',
  source_reference text,
  source_file_path text,
  source_bucket text,
  raw_text text,
  raw_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  extracted_fields_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_categorization_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  missing_fields_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  parsing_issues_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_candidates_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  parse_status public.intake_state NOT NULL DEFAULT 'received',
  parse_confidence numeric,
  duplicate_confidence numeric,
  categorization_confidence numeric,
  suggested_work_order_id uuid,
  converted_work_order_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_intake_records_state ON public.intake_records(parse_status);
CREATE INDEX idx_intake_records_created ON public.intake_records(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.intake_records TO authenticated;
GRANT ALL ON public.intake_records TO service_role;

ALTER TABLE public.intake_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage intake records"
  ON public.intake_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));

CREATE TRIGGER trg_intake_records_updated_at
  BEFORE UPDATE ON public.intake_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Audit log
CREATE TABLE public.parsing_review_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  intake_record_id uuid NOT NULL REFERENCES public.intake_records(id) ON DELETE CASCADE,
  reviewer_profile_id uuid,
  action_type text NOT NULL,
  previous_values_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  next_values_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pra_intake ON public.parsing_review_actions(intake_record_id, created_at DESC);

GRANT SELECT, INSERT ON public.parsing_review_actions TO authenticated;
GRANT ALL ON public.parsing_review_actions TO service_role;

ALTER TABLE public.parsing_review_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers read review actions"
  ON public.parsing_review_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'));

CREATE POLICY "Dispatchers insert review actions"
  ON public.parsing_review_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'dispatcher') AND reviewer_profile_id = auth.uid());
