
-- Singleton record describing the connected company mailbox.
-- The actual OAuth tokens live in the Gmail connector (gateway), not here.
CREATE TABLE public.gmail_connection (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton boolean NOT NULL DEFAULT true,
  email_address text,
  display_name text,
  history_id text,
  last_sync_at timestamp with time zone,
  last_sync_error text,
  is_connected boolean NOT NULL DEFAULT false,
  connected_by uuid,
  connected_at timestamp with time zone,
  disconnected_by uuid,
  disconnected_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT gmail_connection_singleton_unique UNIQUE (singleton)
);

GRANT SELECT ON public.gmail_connection TO authenticated;
GRANT ALL ON public.gmail_connection TO service_role;

ALTER TABLE public.gmail_connection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mailbox connection"
  ON public.gmail_connection FOR SELECT TO authenticated USING (true);

CREATE POLICY "Boss manages mailbox connection"
  ON public.gmail_connection FOR ALL TO authenticated
  USING (is_boss(auth.uid())) WITH CHECK (is_boss(auth.uid()));

CREATE TRIGGER gmail_connection_set_updated_at
  BEFORE UPDATE ON public.gmail_connection
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Cache of Gmail messages we've ingested + classification + intake linkage.
CREATE TYPE public.gmail_classification AS ENUM (
  'unclassified',
  'work_order_candidate',
  'not_work_order',
  'imported',
  'ignored'
);

CREATE TYPE public.gmail_triage_state AS ENUM (
  'pending',
  'reviewed',
  'replied',
  'ignored'
);

CREATE TABLE public.gmail_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gmail_message_id text NOT NULL UNIQUE,
  gmail_thread_id text NOT NULL,
  history_id text,
  internal_date timestamp with time zone,
  from_address text,
  from_name text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  subject text,
  snippet text,
  body_preview text,
  has_attachments boolean NOT NULL DEFAULT false,
  label_ids text[] NOT NULL DEFAULT '{}',
  is_unread boolean NOT NULL DEFAULT true,

  classification public.gmail_classification NOT NULL DEFAULT 'unclassified',
  classification_score numeric,
  classification_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  classified_at timestamp with time zone,

  triage_state public.gmail_triage_state NOT NULL DEFAULT 'pending',
  triaged_by uuid,
  triaged_at timestamp with time zone,

  imported_intake_id uuid,
  imported_at timestamp with time zone,
  imported_by uuid,
  import_error text,

  replied_at timestamp with time zone,
  replied_by uuid,
  reply_gmail_message_id text,

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_gmail_messages_thread ON public.gmail_messages(gmail_thread_id);
CREATE INDEX idx_gmail_messages_internal_date ON public.gmail_messages(internal_date DESC);
CREATE INDEX idx_gmail_messages_classification ON public.gmail_messages(classification);
CREATE INDEX idx_gmail_messages_triage ON public.gmail_messages(triage_state);

GRANT SELECT ON public.gmail_messages TO authenticated;
GRANT ALL ON public.gmail_messages TO service_role;

ALTER TABLE public.gmail_messages ENABLE ROW LEVEL SECURITY;

-- Boss + dispatcher can read mailbox triage; only boss/dispatcher can act (via server fns w/ service role)
CREATE POLICY "Boss + dispatcher view gmail messages"
  ON public.gmail_messages FOR SELECT TO authenticated
  USING (is_boss(auth.uid()) OR has_role(auth.uid(), 'dispatcher'::app_role));

CREATE POLICY "Boss manages gmail messages"
  ON public.gmail_messages FOR ALL TO authenticated
  USING (is_boss(auth.uid())) WITH CHECK (is_boss(auth.uid()));

CREATE TRIGGER gmail_messages_set_updated_at
  BEFORE UPDATE ON public.gmail_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Seed singleton connection row so server fns can always upsert by singleton=true.
INSERT INTO public.gmail_connection (singleton, is_connected) VALUES (true, false)
ON CONFLICT (singleton) DO NOTHING;
