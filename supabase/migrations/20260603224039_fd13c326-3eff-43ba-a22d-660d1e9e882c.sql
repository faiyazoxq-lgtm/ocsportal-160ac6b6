
-- =====================================================
-- 1) engineers_private: sensitive engineer fields
-- =====================================================
CREATE TABLE public.engineers_private (
  engineer_id uuid PRIMARY KEY REFERENCES public.engineers(id) ON DELETE CASCADE,
  hourly_pay_rate numeric,
  personal_email text,
  contact_number text,
  van_registration text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.engineers_private (engineer_id, hourly_pay_rate, personal_email, contact_number, van_registration)
SELECT id, hourly_pay_rate, personal_email, contact_number, van_registration
FROM public.engineers;

ALTER TABLE public.engineers
  DROP COLUMN hourly_pay_rate,
  DROP COLUMN personal_email,
  DROP COLUMN contact_number,
  DROP COLUMN van_registration;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.engineers_private TO authenticated;
GRANT ALL ON public.engineers_private TO service_role;

ALTER TABLE public.engineers_private ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss manages engineers_private" ON public.engineers_private
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Dispatchers manage engineers_private" ON public.engineers_private
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'dispatcher'::public.app_role));

CREATE POLICY "Engineers view own private" ON public.engineers_private
  FOR SELECT TO authenticated
  USING (engineer_id = public.current_engineer_id());

CREATE TRIGGER touch_engineers_private_updated_at
  BEFORE UPDATE ON public.engineers_private
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================
-- 2) profiles_admin_meta: admin-only profile fields
-- =====================================================
CREATE TABLE public.profiles_admin_meta (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone text,
  work_email text,
  disabled_at timestamptz,
  disabled_by uuid,
  password_reset_requested_at timestamptz,
  password_reset_requested_by uuid,
  temp_password_set_at timestamptz,
  temp_password_set_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.profiles_admin_meta
  (profile_id, phone, work_email, disabled_at, disabled_by,
   password_reset_requested_at, password_reset_requested_by,
   temp_password_set_at, temp_password_set_by)
SELECT id, phone, work_email, disabled_at, disabled_by,
       password_reset_requested_at, password_reset_requested_by,
       temp_password_set_at, temp_password_set_by
FROM public.profiles;

ALTER TABLE public.profiles
  DROP COLUMN phone,
  DROP COLUMN work_email,
  DROP COLUMN disabled_at,
  DROP COLUMN disabled_by,
  DROP COLUMN password_reset_requested_at,
  DROP COLUMN password_reset_requested_by,
  DROP COLUMN temp_password_set_at,
  DROP COLUMN temp_password_set_by;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles_admin_meta TO authenticated;
GRANT ALL ON public.profiles_admin_meta TO service_role;

ALTER TABLE public.profiles_admin_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Boss manages profiles_admin_meta" ON public.profiles_admin_meta
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid())) WITH CHECK (public.is_boss(auth.uid()));

CREATE POLICY "Dispatchers view profiles_admin_meta" ON public.profiles_admin_meta
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'::public.app_role));

CREATE POLICY "Users view own admin meta" ON public.profiles_admin_meta
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users update own contact" ON public.profiles_admin_meta
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

CREATE TRIGGER touch_profiles_admin_meta_updated_at
  BEFORE UPDATE ON public.profiles_admin_meta
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Update handle_new_user to write phone into profiles_admin_meta
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

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    _role
  );

  insert into public.profiles_admin_meta (profile_id, phone)
  values (new.id, new.raw_user_meta_data ->> 'phone');

  insert into public.user_roles (user_id, role)
  values (new.id, _role);

  return new;
end;
$function$;

-- =====================================================
-- 3) work_orders: block engineers from updating admin-only columns
-- =====================================================
CREATE OR REPLACE FUNCTION public.guard_engineer_wo_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'dispatcher'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
    OR NEW.private_notes IS DISTINCT FROM OLD.private_notes
    OR NEW.estimated_value_amount IS DISTINCT FROM OLD.estimated_value_amount
    OR NEW.billing_notes IS DISTINCT FROM OLD.billing_notes
    OR NEW.review_outcome IS DISTINCT FROM OLD.review_outcome
    OR NEW.scheduled_start_at IS DISTINCT FROM OLD.scheduled_start_at
    OR NEW.scheduled_end_at IS DISTINCT FROM OLD.scheduled_end_at
    OR NEW.diary_date IS DISTINCT FROM OLD.diary_date
    OR NEW.diary_slot_label IS DISTINCT FROM OLD.diary_slot_label
    OR NEW.planner_conflict_flag IS DISTINCT FROM OLD.planner_conflict_flag
    OR NEW.planner_conflict_message IS DISTINCT FROM OLD.planner_conflict_message
    OR NEW.priority_level IS DISTINCT FROM OLD.priority_level
    OR NEW.client_id IS DISTINCT FROM OLD.client_id
  THEN
    RAISE EXCEPTION 'Engineers cannot modify admin-only work order fields'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_engineer_wo_columns
  BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_engineer_wo_columns();
