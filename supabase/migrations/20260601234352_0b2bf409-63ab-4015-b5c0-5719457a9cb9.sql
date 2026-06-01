-- Extend work_order_expenses with vendor/payment/extraction fields
ALTER TABLE public.work_order_expenses
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS expense_date date,
  ADD COLUMN IF NOT EXISTS expense_time time,
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid,
  ADD COLUMN IF NOT EXISTS extracted_items_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extracted_text text,
  ADD COLUMN IF NOT EXISTS extraction_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS extraction_confidence numeric,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_by_profile_id uuid,
  ADD COLUMN IF NOT EXISTS updated_by_engineer_id uuid;

ALTER TABLE public.work_order_expenses
  DROP CONSTRAINT IF EXISTS work_order_expenses_payment_status_check;
ALTER TABLE public.work_order_expenses
  ADD CONSTRAINT work_order_expenses_payment_status_check
  CHECK (payment_status IN ('pending','paid','not_billable'));

ALTER TABLE public.work_order_expenses
  DROP CONSTRAINT IF EXISTS work_order_expenses_extraction_status_check;
ALTER TABLE public.work_order_expenses
  ADD CONSTRAINT work_order_expenses_extraction_status_check
  CHECK (extraction_status IN ('none','pending','partial','done','failed'));

ALTER TABLE public.work_order_expenses
  DROP CONSTRAINT IF EXISTS work_order_expenses_payment_method_check;
ALTER TABLE public.work_order_expenses
  ADD CONSTRAINT work_order_expenses_payment_method_check
  CHECK (payment_method IS NULL OR payment_method IN ('cash','card','bank_transfer','account','other'));

CREATE INDEX IF NOT EXISTS idx_wo_expenses_payment_status ON public.work_order_expenses(payment_status);
CREATE INDEX IF NOT EXISTS idx_wo_expenses_vendor ON public.work_order_expenses(lower(vendor));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_work_order_expenses_touch ON public.work_order_expenses;
CREATE TRIGGER trg_work_order_expenses_touch
BEFORE UPDATE ON public.work_order_expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Lead engineers can UPDATE/DELETE expenses on their own jobs
DROP POLICY IF EXISTS "Lead engineers update expenses for their jobs" ON public.work_order_expenses;
CREATE POLICY "Lead engineers update expenses for their jobs"
ON public.work_order_expenses
FOR UPDATE TO authenticated
USING (public.engineer_is_lead(work_order_id))
WITH CHECK (public.engineer_is_lead(work_order_id));

DROP POLICY IF EXISTS "Lead engineers delete expenses for their jobs" ON public.work_order_expenses;
CREATE POLICY "Lead engineers delete expenses for their jobs"
ON public.work_order_expenses
FOR DELETE TO authenticated
USING (public.engineer_is_lead(work_order_id));

-- Extend work_orders with push-to-expenses state
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS expenses_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expenses_pushed_by uuid,
  ADD COLUMN IF NOT EXISTS expenses_ack_required boolean NOT NULL DEFAULT true;