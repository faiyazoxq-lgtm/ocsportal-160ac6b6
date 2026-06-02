ALTER TABLE public.gmail_connection
  ADD COLUMN IF NOT EXISTS last_sync_mode text,
  ADD COLUMN IF NOT EXISTS last_history_id_used text,
  ADD COLUMN IF NOT EXISTS last_sync_removed_count integer,
  ADD COLUMN IF NOT EXISTS last_reconcile_at timestamptz;