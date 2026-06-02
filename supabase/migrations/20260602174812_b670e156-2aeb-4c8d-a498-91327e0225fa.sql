ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS gmail_processed_label text NOT NULL DEFAULT 'OCS / Imported Work Orders';