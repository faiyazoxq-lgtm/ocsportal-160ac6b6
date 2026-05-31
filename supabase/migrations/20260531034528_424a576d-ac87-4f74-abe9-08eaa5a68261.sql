-- Planner sync mapping on work_orders
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS planner_sheet_name text,
  ADD COLUMN IF NOT EXISTS planner_row_key text,
  ADD COLUMN IF NOT EXISTS planner_last_pushed_at timestamptz,
  ADD COLUMN IF NOT EXISTS planner_last_pulled_at timestamptz,
  ADD COLUMN IF NOT EXISTS planner_last_pushed_hash text,
  ADD COLUMN IF NOT EXISTS planner_last_pulled_hash text,
  ADD COLUMN IF NOT EXISTS planner_conflict_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS planner_conflict_message text;

CREATE INDEX IF NOT EXISTS idx_work_orders_planner_row_key
  ON public.work_orders(planner_sheet_name, planner_row_key);

-- Sync log
CREATE TABLE IF NOT EXISTS public.sheet_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid,
  sheet_name text,
  sheet_row_key text,
  sync_direction text NOT NULL CHECK (sync_direction IN ('app_to_sheet','sheet_to_app')),
  sync_status text NOT NULL CHECK (sync_status IN ('pending','success','failed','conflict','skipped')),
  payload_snapshot_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  triggered_by uuid,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sheet_sync_log TO authenticated;
GRANT ALL ON public.sheet_sync_log TO service_role;

ALTER TABLE public.sheet_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage sync log"
  ON public.sheet_sync_log
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'));

CREATE INDEX IF NOT EXISTS idx_sheet_sync_log_wo
  ON public.sheet_sync_log(work_order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sheet_sync_log_created
  ON public.sheet_sync_log(created_at DESC);