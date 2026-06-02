ALTER TABLE public.gmail_messages
  ADD COLUMN IF NOT EXISTS inbox_removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS inbox_removed_reason text;

CREATE INDEX IF NOT EXISTS gmail_messages_inbox_removed_at_idx
  ON public.gmail_messages (inbox_removed_at);