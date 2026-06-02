ALTER TABLE public.work_order_expenses
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS paid_note text;

CREATE INDEX IF NOT EXISTS idx_wo_expenses_paid_at ON public.work_order_expenses(paid_at DESC);