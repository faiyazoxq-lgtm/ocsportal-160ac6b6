
CREATE OR REPLACE FUNCTION public.is_master_dev(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id
      AND lower(email) = 'ogstreamz@gmail.com'
  );
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _meta_role text;
  _role public.app_role := 'engineer'::public.app_role;
  _provisioned boolean := false;
  _is_master boolean := false;
begin
  _provisioned := coalesce((new.raw_user_meta_data ->> 'provisioned_by_admin')::boolean, false);
  _meta_role := new.raw_user_meta_data ->> 'role';
  _is_master := lower(coalesce(new.email,'')) = 'ogstreamz@gmail.com';

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
$function$;
