
-- Soft-delete column on threads (messages already have deleted_at)
ALTER TABLE public.direct_message_threads
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Boss read access to all DM tables
CREATE POLICY "Boss views all DM threads"
  ON public.direct_message_threads FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss views all DM participants"
  ON public.direct_message_participants FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss views all DM messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss views all DM files"
  ON public.direct_message_files FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

-- Boss can update (soft-delete) any message or thread
CREATE POLICY "Boss updates any DM message"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Boss updates any DM thread"
  ON public.direct_message_threads FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));
