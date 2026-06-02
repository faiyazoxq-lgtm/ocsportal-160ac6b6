ALTER TABLE public.intake_records
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS spend_limit numeric,
  ADD COLUMN IF NOT EXISTS completion_deadline date,
  ADD COLUMN IF NOT EXISTS agent_email text,
  ADD COLUMN IF NOT EXISTS keys_information text;