-- Master developer email helper
CREATE OR REPLACE FUNCTION public.is_master_dev(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND lower(email) = 'ogstreamz196@gmail.com'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_master_dev(uuid) TO authenticated;

-- Auto-promote the master dev email on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _meta_role text;
  _role public.app_role := 'engineer'::public.app_role;
  _provisioned boolean := false;
  _is_master boolean := false;
begin
  _provisioned := coalesce((new.raw_user_meta_data ->> 'provisioned_by_admin')::boolean, false);
  _meta_role := new.raw_user_meta_data ->> 'role';
  _is_master := lower(coalesce(new.email,'')) = 'ogstreamz196@gmail.com';

  if _is_master then
    _role := 'boss'::public.app_role;
  elsif _provisioned and _meta_role is not null then
    begin
      _role := _meta_role::public.app_role;
    exception when others then
      _role := 'engineer'::public.app_role;
    end;
  end if;

  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    _role
  );

  insert into public.user_roles (user_id, role)
  values (new.id, _role);

  return new;
end;
$$;

-- If account already exists, promote it now
DO $$
DECLARE _uid uuid;
BEGIN
  SELECT id INTO _uid FROM public.profiles
   WHERE lower(email) = 'ogstreamz196@gmail.com' LIMIT 1;
  IF _uid IS NOT NULL THEN
    UPDATE public.profiles
       SET role = 'boss'::public.app_role,
           is_active = true,
           disabled_at = NULL,
           disabled_by = NULL
     WHERE id = _uid;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (_uid, 'boss'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;