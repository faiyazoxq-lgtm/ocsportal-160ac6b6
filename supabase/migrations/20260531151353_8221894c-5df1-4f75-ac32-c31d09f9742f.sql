CREATE OR REPLACE FUNCTION public.claim_first_boss()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _exists boolean;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'boss'::public.app_role
  ) INTO _exists;

  IF _exists THEN
    RETURN false;
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'boss'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles SET role = 'boss'::public.app_role WHERE id = _uid;

  INSERT INTO public.boss_audit_log (actor_profile_id, action_type, target_type, target_id, reason, before_json, after_json, context_json)
  VALUES (_uid, 'claim_first_boss', 'profile', _uid, 'Initial boss seed', '{}'::jsonb, jsonb_build_object('role','boss'), '{}'::jsonb);

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_first_boss() TO authenticated;