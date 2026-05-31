
-- ============ user_contact_profiles ============
CREATE TABLE public.user_contact_profiles (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  avatar_url text,
  job_title text,
  capability_summary text,
  bio text,
  telegram_username text,
  telegram_chat_id text,
  telegram_linked_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_contact_profiles TO authenticated;
GRANT ALL ON public.user_contact_profiles TO service_role;

ALTER TABLE public.user_contact_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can view contact profiles"
  ON public.user_contact_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users update own contact profile"
  ON public.user_contact_profiles FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users insert own contact profile"
  ON public.user_contact_profiles FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER trg_user_contact_profiles_updated_at
  BEFORE UPDATE ON public.user_contact_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ direct_message_threads ============
CREATE TABLE public.direct_message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.direct_message_threads TO authenticated;
GRANT ALL ON public.direct_message_threads TO service_role;

-- ============ direct_message_participants ============
CREATE TABLE public.direct_message_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_message_threads(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  UNIQUE (thread_id, profile_id)
);
CREATE INDEX idx_dm_participants_profile ON public.direct_message_participants(profile_id);
CREATE INDEX idx_dm_participants_thread ON public.direct_message_participants(thread_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_message_participants TO authenticated;
GRANT ALL ON public.direct_message_participants TO service_role;

-- helper: am I in this thread?
CREATE OR REPLACE FUNCTION public.is_thread_participant(_thread uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.direct_message_participants
    WHERE thread_id = _thread AND profile_id = auth.uid()
  );
$$;

-- ============ direct_messages ============
CREATE TYPE public.dm_message_type AS ENUM ('text','image','file','voice_note','system');

CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.direct_message_threads(id) ON DELETE CASCADE,
  sender_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_type public.dm_message_type NOT NULL DEFAULT 'text',
  body_text text,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);
CREATE INDEX idx_dm_messages_thread_sent ON public.direct_messages(thread_id, sent_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;

-- ============ direct_message_files ============
CREATE TABLE public.direct_message_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  file_kind text NOT NULL,
  storage_bucket text NOT NULL,
  storage_path text NOT NULL,
  mime_type text,
  byte_size bigint,
  uploaded_by_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX idx_dm_files_message ON public.direct_message_files(message_id);

GRANT SELECT, INSERT ON public.direct_message_files TO authenticated;
GRANT ALL ON public.direct_message_files TO service_role;

-- ============ telegram_notification_log ============
CREATE TABLE public.telegram_notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  thread_id uuid REFERENCES public.direct_message_threads(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  notification_type text NOT NULL,
  delivery_status text NOT NULL,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_notification_log TO authenticated;
GRANT ALL ON public.telegram_notification_log TO service_role;

-- ============ RLS ============
ALTER TABLE public.direct_message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_message_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_notification_log ENABLE ROW LEVEL SECURITY;

-- Threads
CREATE POLICY "Participants view threads"
  ON public.direct_message_threads FOR SELECT TO authenticated
  USING (public.is_thread_participant(id));

CREATE POLICY "Auth users create threads"
  ON public.direct_message_threads FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Participants update threads"
  ON public.direct_message_threads FOR UPDATE TO authenticated
  USING (public.is_thread_participant(id)) WITH CHECK (public.is_thread_participant(id));

-- Participants
CREATE POLICY "View participants of my threads"
  ON public.direct_message_participants FOR SELECT TO authenticated
  USING (public.is_thread_participant(thread_id));

CREATE POLICY "Insert participants into my threads or as self-creator"
  ON public.direct_message_participants FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.direct_message_threads t
      WHERE t.id = thread_id AND t.created_by = auth.uid()
    )
  );

CREATE POLICY "Update own participant row"
  ON public.direct_message_participants FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- Messages
CREATE POLICY "View messages in my threads"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_thread_participant(thread_id));

CREATE POLICY "Send messages in my threads"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (sender_profile_id = auth.uid() AND public.is_thread_participant(thread_id));

CREATE POLICY "Edit own messages"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (sender_profile_id = auth.uid()) WITH CHECK (sender_profile_id = auth.uid());

-- Files
CREATE POLICY "View files in my threads"
  ON public.direct_message_files FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.direct_messages m
    WHERE m.id = message_id AND public.is_thread_participant(m.thread_id)
  ));

CREATE POLICY "Attach files to own messages"
  ON public.direct_message_files FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.direct_messages m
      WHERE m.id = message_id AND m.sender_profile_id = auth.uid()
    )
  );

-- Telegram log: read-only for the affected user; writes via service_role
CREATE POLICY "User reads own telegram log"
  ON public.telegram_notification_log FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

-- ============ Storage bucket for attachments ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('direct-message-attachments', 'direct-message-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- path convention: {thread_id}/{message_id}/{filename}
CREATE POLICY "DM attachments: participants read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'direct-message-attachments'
    AND public.is_thread_participant( NULLIF(split_part(name,'/',1),'')::uuid )
  );

CREATE POLICY "DM attachments: participants upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'direct-message-attachments'
    AND public.is_thread_participant( NULLIF(split_part(name,'/',1),'')::uuid )
  );

-- ============ Auto-bump thread.updated_at on new message ============
CREATE OR REPLACE FUNCTION public.tg_bump_thread_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.direct_message_threads
    SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_bump_thread_on_message
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_bump_thread_updated_at();
