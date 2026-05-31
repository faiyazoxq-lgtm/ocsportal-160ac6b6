-- Recommendation outputs for advisory suggestions across intake/assignment/scheduling/billing
CREATE TYPE public.recommendation_type AS ENUM (
  'intake_categorization',
  'intake_diary_ready',
  'intake_duplicate',
  'assignment_engineer',
  'scheduling_slot',
  'scheduling_duration',
  'scheduling_coassign',
  'billing_invoice_ready',
  'billing_missing_evidence',
  'billing_followup_needed'
);

CREATE TYPE public.recommendation_target_type AS ENUM (
  'intake_record',
  'work_order',
  'billing_case'
);

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_type public.recommendation_type NOT NULL,
  target_record_type public.recommendation_target_type NOT NULL,
  target_record_id uuid NOT NULL,
  recommendation_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric,
  rationale_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  generated_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  dismissed_by uuid,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_target
  ON public.recommendations (target_record_type, target_record_id);
CREATE INDEX idx_recommendations_type
  ON public.recommendations (recommendation_type);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;
GRANT ALL ON public.recommendations TO service_role;

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Dispatchers manage everything
CREATE POLICY "Dispatchers manage recommendations"
  ON public.recommendations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'::public.app_role));

-- Engineers may read recommendations on work orders assigned to them
CREATE POLICY "Engineers view recs for assigned work orders"
  ON public.recommendations
  FOR SELECT
  TO authenticated
  USING (
    target_record_type = 'work_order'::public.recommendation_target_type
    AND public.engineer_is_assigned(target_record_id)
  );

CREATE TRIGGER trg_recommendations_updated_at
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();