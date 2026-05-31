
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'work_orders','work_order_assignments','work_order_events','work_order_files',
    'work_order_expenses','work_order_external_contacts',
    'billing_cases','billing_status_events','billing_adjustments',
    'profiles','engineers','engineer_availability',
    'external_contacts','clients','user_contact_profiles',
    'intake_records','parsing_reviews','parsing_review_actions',
    'communication_log_entries','recommendations',
    'boss_audit_log','sheet_sync_log'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
    EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
  END LOOP;
END $$;
