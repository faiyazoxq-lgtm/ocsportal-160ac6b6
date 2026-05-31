
-- =========================================================
-- Evidence files, expenses, sync state, private storage
-- =========================================================

-- Enums
DO $$ BEGIN
  CREATE TYPE public.file_kind AS ENUM (
    'source_pdf',
    'arrival_photo',
    'before_leave_photo',
    'completion_signature',
    'receipt_photo',
    'general_evidence'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.file_sync_status AS ENUM ('pending','syncing','synced','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_type AS ENUM (
    'parts','materials','parking','congestion','fuel','tools','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========================================================
-- work_order_files
-- =========================================================
CREATE TABLE IF NOT EXISTS public.work_order_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL,
  file_kind public.file_kind NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  byte_size bigint,
  captured_by_profile_id uuid,
  captured_by_engineer_id uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_offline boolean NOT NULL DEFAULT false,
  sync_status public.file_sync_status NOT NULL DEFAULT 'synced',
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_files_wo ON public.work_order_files(work_order_id);
CREATE INDEX IF NOT EXISTS idx_wo_files_kind ON public.work_order_files(work_order_id, file_kind);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_files TO authenticated;
GRANT ALL ON public.work_order_files TO service_role;

ALTER TABLE public.work_order_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage files"
  ON public.work_order_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));

CREATE POLICY "Engineers view files for assigned jobs"
  ON public.work_order_files FOR SELECT TO authenticated
  USING (public.engineer_is_assigned(work_order_id));

CREATE POLICY "Lead engineers insert files for their jobs"
  ON public.work_order_files FOR INSERT TO authenticated
  WITH CHECK (public.engineer_is_lead(work_order_id));

CREATE POLICY "Lead engineers update their files"
  ON public.work_order_files FOR UPDATE TO authenticated
  USING (public.engineer_is_lead(work_order_id))
  WITH CHECK (public.engineer_is_lead(work_order_id));

-- =========================================================
-- work_order_expenses
-- =========================================================
CREATE TABLE IF NOT EXISTS public.work_order_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL,
  expense_type public.expense_type NOT NULL DEFAULT 'other',
  amount numeric(10,2) NOT NULL,
  note text,
  receipt_file_id uuid REFERENCES public.work_order_files(id) ON DELETE SET NULL,
  entered_by_engineer_id uuid,
  entered_by_profile_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wo_expenses_wo ON public.work_order_expenses(work_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_expenses TO authenticated;
GRANT ALL ON public.work_order_expenses TO service_role;

ALTER TABLE public.work_order_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dispatchers manage expenses"
  ON public.work_order_expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));

CREATE POLICY "Engineers view expenses for assigned jobs"
  ON public.work_order_expenses FOR SELECT TO authenticated
  USING (public.engineer_is_assigned(work_order_id));

CREATE POLICY "Lead engineers insert expenses for their jobs"
  ON public.work_order_expenses FOR INSERT TO authenticated
  WITH CHECK (public.engineer_is_lead(work_order_id));

-- =========================================================
-- Sync / lock columns on work_orders
-- =========================================================
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_sync_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS active_editor_engineer_id uuid,
  ADD COLUMN IF NOT EXISTS field_lock_started_at timestamptz;

-- =========================================================
-- Dispatcher overwrite protection trigger
-- Blocks dispatcher (non-lead) mutations to field-locked work orders
-- =========================================================
CREATE OR REPLACE FUNCTION public.guard_active_field_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_lead boolean;
BEGIN
  -- Only enforce when lock is active
  IF NEW.field_lock_active IS DISTINCT FROM true AND OLD.field_lock_active IS DISTINCT FROM true THEN
    RETURN NEW;
  END IF;

  -- The active lead may always update
  _is_lead := public.engineer_is_lead(NEW.id);
  IF _is_lead THEN
    RETURN NEW;
  END IF;

  -- Allow lock toggle / admin_notes append only when caller is dispatcher
  -- but block any change to outcome / status / diary while lock active
  IF OLD.field_lock_active = true AND public.has_role(auth.uid(),'dispatcher') THEN
    IF NEW.current_status IS DISTINCT FROM OLD.current_status
       OR NEW.current_outcome_reason IS DISTINCT FROM OLD.current_outcome_reason
       OR NEW.diary_date IS DISTINCT FROM OLD.diary_date
       OR NEW.diary_slot_label IS DISTINCT FROM OLD.diary_slot_label THEN
      RAISE EXCEPTION 'work_order % is field-locked by active lead engineer — unsynced field record present', NEW.id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_active_field_lock ON public.work_orders;
CREATE TRIGGER trg_guard_active_field_lock
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_active_field_lock();

-- =========================================================
-- Private storage buckets
-- =========================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('work-order-source-docs','work-order-source-docs', false),
  ('work-order-evidence',   'work-order-evidence',    false),
  ('work-order-signatures', 'work-order-signatures',  false),
  ('work-order-receipts',   'work-order-receipts',    false)
ON CONFLICT (id) DO NOTHING;

-- Helper: extract work_order_id from path "{work_order_id}/..."
CREATE OR REPLACE FUNCTION public.wo_id_from_path(_name text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
AS $$
  SELECT NULLIF(split_part(_name,'/',1),'')::uuid;
$$;

-- Drop any pre-existing dup policies before recreating (idempotency)
DO $$
DECLARE
  _bucket text;
BEGIN
  FOREACH _bucket IN ARRAY ARRAY[
    'work-order-source-docs',
    'work-order-evidence',
    'work-order-signatures',
    'work-order-receipts'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s read dispatcher" ON storage.objects', _bucket);
    EXECUTE format('DROP POLICY IF EXISTS "%s read engineer" ON storage.objects', _bucket);
    EXECUTE format('DROP POLICY IF EXISTS "%s write lead" ON storage.objects', _bucket);
    EXECUTE format('DROP POLICY IF EXISTS "%s write dispatcher" ON storage.objects', _bucket);
  END LOOP;
END $$;

-- One policy set per evidence bucket
DO $$
DECLARE
  _bucket text;
BEGIN
  FOREACH _bucket IN ARRAY ARRAY[
    'work-order-source-docs',
    'work-order-evidence',
    'work-order-signatures',
    'work-order-receipts'
  ] LOOP
    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = %L AND public.has_role(auth.uid(),'dispatcher'))
    $f$, _bucket || ' read dispatcher', _bucket);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = %L AND public.engineer_is_assigned(public.wo_id_from_path(name)))
    $f$, _bucket || ' read engineer', _bucket);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %L AND public.engineer_is_lead(public.wo_id_from_path(name)))
    $f$, _bucket || ' write lead', _bucket);

    EXECUTE format($f$
      CREATE POLICY %I ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = %L AND public.has_role(auth.uid(),'dispatcher'))
    $f$, _bucket || ' write dispatcher', _bucket);
  END LOOP;
END $$;
