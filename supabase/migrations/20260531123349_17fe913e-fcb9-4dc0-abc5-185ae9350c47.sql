
-- Enums
CREATE TYPE public.external_contact_type AS ENUM ('tenant','landlord','agency','council','contractor','other');
CREATE TYPE public.communication_type AS ENUM ('call','email','note','visit','message','voicemail');
CREATE TYPE public.communication_direction AS ENUM ('outbound','inbound');
CREATE TYPE public.follow_up_status AS ENUM ('not_required','information_given','awaiting_response','follow_up_booked','unresolved','resolved');

-- A) external_contacts
CREATE TABLE public.external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization text,
  role_label text,
  phone text,
  email text,
  contact_type public.external_contact_type NOT NULL DEFAULT 'other',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_contacts TO authenticated;
GRANT ALL ON public.external_contacts TO service_role;
ALTER TABLE public.external_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispatchers manage external contacts"
  ON public.external_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));

CREATE TRIGGER trg_external_contacts_updated_at
  BEFORE UPDATE ON public.external_contacts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_external_contacts_type ON public.external_contacts(contact_type);
CREATE INDEX idx_external_contacts_name ON public.external_contacts(name);

-- B) work_order_external_contacts
CREATE TABLE public.work_order_external_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL,
  external_contact_id uuid NOT NULL,
  relationship_label text,
  is_primary boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, external_contact_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_order_external_contacts TO authenticated;
GRANT ALL ON public.work_order_external_contacts TO service_role;
ALTER TABLE public.work_order_external_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispatchers manage wo external contacts"
  ON public.work_order_external_contacts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));
CREATE POLICY "Engineers view wo external contacts"
  ON public.work_order_external_contacts FOR SELECT TO authenticated
  USING (public.engineer_is_assigned(work_order_id));

CREATE INDEX idx_woec_work_order ON public.work_order_external_contacts(work_order_id);
CREATE INDEX idx_woec_contact ON public.work_order_external_contacts(external_contact_id);

-- C) communication_log_entries
CREATE TABLE public.communication_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL,
  external_contact_id uuid,
  logged_by_profile_id uuid,
  communication_type public.communication_type NOT NULL,
  direction public.communication_direction NOT NULL DEFAULT 'outbound',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  subject text,
  summary text,
  outcome public.follow_up_status NOT NULL DEFAULT 'information_given',
  requires_follow_up boolean NOT NULL DEFAULT false,
  follow_up_due_at timestamptz,
  follow_up_status public.follow_up_status,
  follow_up_resolved_at timestamptz,
  follow_up_resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_log_entries TO authenticated;
GRANT ALL ON public.communication_log_entries TO service_role;
ALTER TABLE public.communication_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispatchers manage comm log"
  ON public.communication_log_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));
CREATE POLICY "Engineers view comm log for assigned jobs"
  ON public.communication_log_entries FOR SELECT TO authenticated
  USING (public.engineer_is_assigned(work_order_id));

CREATE TRIGGER trg_comm_log_updated_at
  BEFORE UPDATE ON public.communication_log_entries
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE INDEX idx_comm_log_work_order ON public.communication_log_entries(work_order_id);
CREATE INDEX idx_comm_log_contact ON public.communication_log_entries(external_contact_id);
CREATE INDEX idx_comm_log_follow_up ON public.communication_log_entries(follow_up_due_at) WHERE requires_follow_up = true;
CREATE INDEX idx_comm_log_occurred_at ON public.communication_log_entries(occurred_at DESC);

-- D) communication_attachments
CREATE TABLE public.communication_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_entry_id uuid NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  byte_size bigint,
  uploaded_by_profile_id uuid,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communication_attachments TO authenticated;
GRANT ALL ON public.communication_attachments TO service_role;
ALTER TABLE public.communication_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Dispatchers manage comm attachments"
  ON public.communication_attachments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'dispatcher'))
  WITH CHECK (public.has_role(auth.uid(),'dispatcher'));
