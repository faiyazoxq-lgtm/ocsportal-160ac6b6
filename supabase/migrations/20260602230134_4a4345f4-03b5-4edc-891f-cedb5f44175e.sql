
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff can view email templates"
ON public.email_templates FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'boss') OR public.has_role(auth.uid(), 'dispatcher'));

CREATE POLICY "boss manages email templates"
ON public.email_templates FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'boss'))
WITH CHECK (public.has_role(auth.uid(), 'boss'));

CREATE OR REPLACE FUNCTION public.touch_email_templates_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.touch_email_templates_updated_at();

INSERT INTO public.email_templates (slug, name, subject, body, sort_order) VALUES
('appointment_confirmation', 'Appointment confirmation',
 'Appointment confirmed',
 E'Hi {{name}},\n\nThis is to confirm your appointment is scheduled. Our engineer will attend at the agreed time.\n\nIf anything changes, please reply to this email and we will reschedule at the earliest opportunity.\n\nKind regards', 10),
('quote_request', 'Quote request',
 'Quote request — additional information needed',
 E'Hi {{name}},\n\nThank you for your enquiry. To prepare an accurate quote, could you please share:\n\n• A brief description of the issue\n• Site address and access details\n• Preferred dates for attendance\n• Any photos of the affected area, if available\n\nWe will come back to you with a written quote as soon as we have these details.\n\nKind regards', 20),
('engineer_on_the_way', 'Engineer on the way',
 'Our engineer is on the way',
 E'Hi {{name}},\n\nJust a quick note to let you know our engineer is on the way and should be with you shortly. They will introduce themselves on arrival.\n\nIf you need to reach us in the meantime, please reply to this email.\n\nKind regards', 30),
('access_required', 'Access required',
 'Access required to complete works',
 E'Hi {{name}},\n\nWe attempted to attend site today, however our engineer was unable to gain access to complete the works.\n\nCould you please confirm a suitable time for re-attendance, along with any access instructions (key holder, codes, parking).\n\nKind regards', 40),
('job_completed', 'Job completed',
 'Works completed at your site',
 E'Hi {{name}},\n\nWe are pleased to confirm that the works have been completed at your site.\n\nA full job report will follow shortly. If you have any questions or wish to raise additional works, please reply to this email.\n\nKind regards', 50),
('general_followup', 'General follow-up',
 'Following up on your recent enquiry',
 E'Hi {{name}},\n\nJust following up on your recent enquiry — please let us know if you have any questions or if there is anything further we can help with.\n\nWe look forward to hearing from you.\n\nKind regards', 60);
