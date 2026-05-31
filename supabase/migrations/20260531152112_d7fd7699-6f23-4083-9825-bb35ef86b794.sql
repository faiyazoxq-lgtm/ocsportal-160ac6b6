
ALTER TABLE public.external_contacts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;
CREATE INDEX IF NOT EXISTS idx_external_contacts_archived_at ON public.external_contacts(archived_at);
