
-- Hide the master developer account from every other user (including boss/dispatcher).
-- Only the master dev themselves can see / update their own profile row.

-- profiles SELECT policies: exclude master dev row from boss + dispatcher + general directory views.
DROP POLICY IF EXISTS "Authenticated can view profile directory" ON public.profiles;
DROP POLICY IF EXISTS "Boss can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Dispatchers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Boss can update any profile" ON public.profiles;

CREATE POLICY "Authenticated can view profile directory"
  ON public.profiles FOR SELECT TO authenticated
  USING (NOT public.is_master_dev(id) OR id = auth.uid());

CREATE POLICY "Boss can view non-master profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()) AND (NOT public.is_master_dev(id) OR id = auth.uid()));

CREATE POLICY "Dispatchers can view non-master profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'dispatcher'::app_role) AND (NOT public.is_master_dev(id) OR id = auth.uid()));

CREATE POLICY "Boss can update non-master profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_boss(auth.uid()) AND (NOT public.is_master_dev(id) OR id = auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()) AND (NOT public.is_master_dev(id) OR id = auth.uid()));

-- engineers directory: hide any engineer row linked to master dev profile
DROP POLICY IF EXISTS "Authenticated view engineer directory" ON public.engineers;
CREATE POLICY "Authenticated view engineer directory"
  ON public.engineers FOR SELECT TO authenticated
  USING (profile_id IS NULL OR NOT public.is_master_dev(profile_id) OR profile_id = auth.uid());

-- user_roles: hide master dev's roles from everyone except themselves
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (NOT public.is_master_dev(user_id) AND (public.is_boss(auth.uid()) OR public.has_role(auth.uid(), 'dispatcher'::app_role))));
