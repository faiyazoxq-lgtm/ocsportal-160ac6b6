
-- 1. Add new columns to work_orders for private notes, agency contact details (cached) and tenant details
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS private_notes text,
  ADD COLUMN IF NOT EXISTS tenant_contact_id uuid REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tenant_name text,
  ADD COLUMN IF NOT EXISTS tenant_phone text,
  ADD COLUMN IF NOT EXISTS tenant_email text,
  ADD COLUMN IF NOT EXISTS tenant_notes text;

CREATE INDEX IF NOT EXISTS idx_work_orders_tenant_contact_id ON public.work_orders(tenant_contact_id);
