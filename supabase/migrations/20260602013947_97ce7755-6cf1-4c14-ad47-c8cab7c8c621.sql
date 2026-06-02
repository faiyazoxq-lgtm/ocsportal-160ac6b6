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
begin
  -- Only honor a role from metadata when it was explicitly set by a
  -- server-side admin provisioning flow (bossCreateStaffAccount), which
  -- stamps `provisioned_by_admin = true` via the service role. We never
  -- trust the role field from a self-service /auth/v1/signup call.
  _provisioned := coalesce((new.raw_user_meta_data ->> 'provisioned_by_admin')::boolean, false);
  _meta_role := new.raw_user_meta_data ->> 'role';

  if _provisioned and _meta_role is not null then
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