
-- 1) Remove broad engineer SELECT policy on work_orders base table.
-- Engineers already read work orders via public.work_orders_engineer_view,
-- which exposes only safe columns and enforces engineer_is_assigned(id).
-- Removing this policy prevents engineers from selecting confidential
-- columns (estimated_value_amount, admin_notes, private_notes, etc.)
-- via direct REST/SDK calls to the base table.
DROP POLICY IF EXISTS "Engineers view assigned work orders" ON public.work_orders;

-- 2) Tighten profiles directory exposure.
-- Drop the broad "All authenticated can view profiles" policy and
-- replace it with a directory policy that still allows authenticated
-- users to see other profiles, but restricts the columns exposed via
-- the Data API to a safe directory set using column-level GRANTs.
-- Admin metadata columns (temp_password_*, password_reset_*, disabled_*)
-- remain readable only by boss/dispatcher through server functions that
-- use the service-role client.
DROP POLICY IF EXISTS "All authenticated can view profiles" ON public.profiles;

-- Re-grant column-level SELECT to authenticated on safe directory columns
-- only. This applies role-wide (boss/dispatcher included) — admin metadata
-- must be accessed server-side via supabaseAdmin.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id,
  email,
  full_name,
  phone,
  role,
  is_active,
  avatar_url,
  work_email,
  created_at,
  updated_at
) ON public.profiles TO authenticated;

-- Replace the broad policy with a directory-scoped read policy. RLS still
-- needs to permit the row; column-level GRANT above prevents leakage of
-- admin metadata regardless of policy breadth.
CREATE POLICY "Authenticated can view profile directory"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- service_role keeps full table access (for server functions).
GRANT SELECT ON public.profiles TO service_role;
