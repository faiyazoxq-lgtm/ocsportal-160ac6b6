-- 1. Allow engineers to manage their own availability rows
CREATE POLICY "Engineers view own availability"
ON public.engineer_availability
FOR SELECT
TO authenticated
USING (engineer_id = public.current_engineer_id());

CREATE POLICY "Engineers insert own availability"
ON public.engineer_availability
FOR INSERT
TO authenticated
WITH CHECK (engineer_id = public.current_engineer_id());

CREATE POLICY "Engineers delete own availability"
ON public.engineer_availability
FOR DELETE
TO authenticated
USING (engineer_id = public.current_engineer_id());

-- 2. New notification type
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'engineer_unavailable';

-- 3. Trigger: notify dispatchers + bosses when an engineer marks themselves unavailable
CREATE OR REPLACE FUNCTION public.tg_notif_engineer_unavailable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eng_name text;
  _when text;
  _r record;
BEGIN
  IF NEW.availability_type NOT IN ('time_off', 'unavailable_block') THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO _eng_name FROM public.engineers WHERE id = NEW.engineer_id;

  _when := COALESCE(
    CASE
      WHEN NEW.start_at IS NOT NULL AND NEW.end_at IS NOT NULL
        THEN to_char(NEW.start_at, 'Dy DD Mon') ||
             CASE WHEN date_trunc('day', NEW.start_at) <> date_trunc('day', NEW.end_at)
                  THEN ' → ' || to_char(NEW.end_at, 'Dy DD Mon')
                  ELSE '' END
      WHEN NEW.start_at IS NOT NULL THEN to_char(NEW.start_at, 'Dy DD Mon')
      ELSE 'ongoing'
    END,
    'ongoing'
  );

  -- Dispatchers + bosses
  FOR _r IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('dispatcher'::public.app_role, 'boss'::public.app_role)
  LOOP
    PERFORM public.create_notification(
      _r.user_id,
      'engineer_unavailable'::public.notification_type,
      'warn'::public.notification_severity,
      'Engineer marked unavailable',
      COALESCE(_eng_name, 'Engineer') || ' · ' || _when ||
        COALESCE(' · ' || NEW.note, ''),
      '/admin/engineers',
      'engineer',
      NEW.engineer_id,
      jsonb_build_object(
        'availability_id', NEW.id,
        'availability_type', NEW.availability_type,
        'start_at', NEW.start_at,
        'end_at', NEW.end_at,
        'note', NEW.note
      ),
      'engunavail:' || NEW.id::text || ':' || _r.user_id::text
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS engineer_availability_notify ON public.engineer_availability;
CREATE TRIGGER engineer_availability_notify
AFTER INSERT ON public.engineer_availability
FOR EACH ROW
EXECUTE FUNCTION public.tg_notif_engineer_unavailable();