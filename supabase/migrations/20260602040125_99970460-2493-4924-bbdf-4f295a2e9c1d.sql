-- Attach trigger so any new engineer-role assignment creates an engineer row
DROP TRIGGER IF EXISTS sync_engineer_from_user_role_trg ON public.user_roles;
CREATE TRIGGER sync_engineer_from_user_role_trg
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_engineer_from_user_role();

-- Also sync when profile role changes to engineer
CREATE OR REPLACE FUNCTION public.sync_engineer_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_name text;
BEGIN
  IF NEW.role <> 'engineer'::app_role THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.engineers WHERE profile_id = NEW.id) THEN
    RETURN NEW;
  END IF;
  v_name := COALESCE(NULLIF(TRIM(NEW.full_name), ''), NEW.email);
  INSERT INTO public.engineers (profile_id, display_name, active_status)
  VALUES (NEW.id, COALESCE(v_name, 'Engineer'), true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_engineer_from_profile_trg ON public.profiles;
CREATE TRIGGER sync_engineer_from_profile_trg
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_engineer_from_profile();

-- Backfill: create engineer rows for any existing engineer-role profiles missing one
INSERT INTO public.engineers (profile_id, display_name, active_status)
SELECT p.id,
       COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Engineer'),
       true
FROM public.profiles p
WHERE p.role = 'engineer'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.engineers e WHERE e.profile_id = p.id);

-- Also cover users who only have the role in user_roles
INSERT INTO public.engineers (profile_id, display_name, active_status)
SELECT p.id,
       COALESCE(NULLIF(TRIM(p.full_name), ''), p.email, 'Engineer'),
       true
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
WHERE ur.role = 'engineer'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.engineers e WHERE e.profile_id = p.id);