-- Billing prep workflow
CREATE TYPE public.billing_status AS ENUM (
  'pending_review',
  'ready_to_invoice',
  'invoiced',
  'on_hold',
  'rejected'
);

CREATE TABLE public.billing_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL UNIQUE,
  billing_status public.billing_status NOT NULL DEFAULT 'pending_review',
  invoice_reference text,
  client_reference text,
  labour_summary text,
  materials_summary text,
  expense_total numeric(12,2),
  billable_total numeric(12,2),
  non_billable_reason text,
  billing_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  exported_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_cases_status ON public.billing_cases(billing_status);
CREATE INDEX idx_billing_cases_wo ON public.billing_cases(work_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_cases TO authenticated;
GRANT ALL ON public.billing_cases TO service_role;

ALTER TABLE public.billing_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage billing cases"
  ON public.billing_cases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));

CREATE TRIGGER trg_billing_cases_updated_at
  BEFORE UPDATE ON public.billing_cases
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Adjustments / notes audit
CREATE TABLE public.billing_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_case_id uuid NOT NULL REFERENCES public.billing_cases(id) ON DELETE CASCADE,
  adjustment_type text NOT NULL,
  amount numeric(12,2),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_adjustments_case ON public.billing_adjustments(billing_case_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_adjustments TO authenticated;
GRANT ALL ON public.billing_adjustments TO service_role;

ALTER TABLE public.billing_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage billing adjustments"
  ON public.billing_adjustments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));

-- Status change audit
CREATE TABLE public.billing_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  billing_case_id uuid NOT NULL REFERENCES public.billing_cases(id) ON DELETE CASCADE,
  from_status public.billing_status,
  to_status public.billing_status NOT NULL,
  note text,
  actor_profile_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billing_status_events_case ON public.billing_status_events(billing_case_id);

GRANT SELECT, INSERT ON public.billing_status_events TO authenticated;
GRANT ALL ON public.billing_status_events TO service_role;

ALTER TABLE public.billing_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers read billing events"
  ON public.billing_status_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'));

CREATE POLICY "Dispatchers insert billing events"
  ON public.billing_status_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'dispatcher') AND actor_profile_id = auth.uid());