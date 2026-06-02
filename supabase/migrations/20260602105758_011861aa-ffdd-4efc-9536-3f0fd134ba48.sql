ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS intake_sniffing_email TEXT,
  ADD COLUMN IF NOT EXISTS status_colors JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed default sniffing email on the singleton row (create if missing)
INSERT INTO public.company_settings (singleton, intake_sniffing_email)
VALUES (true, 'ocsdashboard@gmail.com')
ON CONFLICT DO NOTHING;

UPDATE public.company_settings
   SET intake_sniffing_email = COALESCE(intake_sniffing_email, 'ocsdashboard@gmail.com')
 WHERE singleton = true;

-- Allow all authenticated users to read the public site settings (work email,
-- sniffing email, status colors) so the dispatch board can theme rows for any
-- signed-in staff member. Writes remain restricted to boss-only via the
-- existing server function which uses the service role.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'company_settings'
      AND policyname = 'Authenticated read company_settings'
  ) THEN
    CREATE POLICY "Authenticated read company_settings"
      ON public.company_settings
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;