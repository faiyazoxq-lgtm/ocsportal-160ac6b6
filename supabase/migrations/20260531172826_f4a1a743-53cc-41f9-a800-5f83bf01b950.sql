-- Per-staff work email on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS work_email text;

-- Company-wide settings (singleton row)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_email text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  singleton boolean NOT NULL DEFAULT true UNIQUE
);

GRANT SELECT ON public.company_settings TO authenticated;
GRANT ALL ON public.company_settings TO service_role;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company settings"
  ON public.company_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Boss can insert company settings"
  ON public.company_settings FOR INSERT TO authenticated
  WITH CHECK (is_boss(auth.uid()));

CREATE POLICY "Boss can update company settings"
  ON public.company_settings FOR UPDATE TO authenticated
  USING (is_boss(auth.uid())) WITH CHECK (is_boss(auth.uid()));

INSERT INTO public.company_settings (work_email) VALUES (NULL)
  ON CONFLICT (singleton) DO NOTHING;
