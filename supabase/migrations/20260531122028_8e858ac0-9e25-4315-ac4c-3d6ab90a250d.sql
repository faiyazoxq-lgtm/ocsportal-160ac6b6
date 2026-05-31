CREATE TYPE public.diary_slot_status AS ENUM ('planned','confirmed','tentative','cancelled');

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz,
  ADD COLUMN IF NOT EXISTS schedule_notes text,
  ADD COLUMN IF NOT EXISTS diary_slot_status public.diary_slot_status,
  ADD COLUMN IF NOT EXISTS rescheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS rescheduled_by uuid;

CREATE INDEX IF NOT EXISTS idx_work_orders_diary_date ON public.work_orders(diary_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_start ON public.work_orders(scheduled_start_at);