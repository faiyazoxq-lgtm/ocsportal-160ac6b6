ALTER TABLE public.engineers
  ADD COLUMN IF NOT EXISTS can_support boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.engineers.can_support IS
  'Whether this engineer can be assigned in a support role on a job. Independent of can_lead.';
