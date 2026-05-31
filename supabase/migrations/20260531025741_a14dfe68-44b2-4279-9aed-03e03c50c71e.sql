-- Engineer availability table
CREATE TABLE public.engineer_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineer_id uuid NOT NULL REFERENCES public.engineers(id) ON DELETE CASCADE,
  availability_type text NOT NULL CHECK (availability_type IN ('working_hours','time_off','unavailable_block')),
  start_at timestamptz,
  end_at timestamptz,
  weekday_rule text,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engineer_availability TO authenticated;
GRANT ALL ON public.engineer_availability TO service_role;

ALTER TABLE public.engineer_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage availability"
  ON public.engineer_availability
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'::public.app_role));

CREATE INDEX engineer_availability_engineer_idx
  ON public.engineer_availability(engineer_id, start_at);

-- Ensure only one active lead per work order
CREATE UNIQUE INDEX IF NOT EXISTS work_order_assignments_one_active_lead
  ON public.work_order_assignments(work_order_id)
  WHERE assignment_role = 'lead'
    AND assignment_status IN ('assigned','accepted');

-- updated_at trigger on assignments (table already has the column)
DROP TRIGGER IF EXISTS tg_work_order_assignments_updated_at ON public.work_order_assignments;
CREATE TRIGGER tg_work_order_assignments_updated_at
BEFORE UPDATE ON public.work_order_assignments
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();