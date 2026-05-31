
-- Auto-create engineers row whenever a user gets the 'engineer' role,
-- and backfill any existing engineer profiles missing one.

CREATE OR REPLACE FUNCTION public.sync_engineer_from_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.role <> 'engineer'::app_role THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.engineers WHERE profile_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(TRIM(full_name), ''), email)
    INTO v_name
    FROM public.profiles
   WHERE id = NEW.user_id;

  INSERT INTO public.engineers (profile_id, display_name, active_status)
  VALUES (NEW.user_id, COALESCE(v_name, 'Engineer'), true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_engineer_from_user_role ON public.user_roles;
CREATE TRIGGER trg_sync_engineer_from_user_role
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_engineer_from_user_role();

-- Backfill: create engineers rows for existing engineer profiles missing one.
INSERT INTO public.engineers (profile_id, display_name, active_status)
SELECT p.id,
       COALESCE(NULLIF(TRIM(p.full_name), ''), p.email),
       true
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'engineer'::app_role
LEFT JOIN public.engineers e ON e.profile_id = p.id
WHERE e.id IS NULL;
