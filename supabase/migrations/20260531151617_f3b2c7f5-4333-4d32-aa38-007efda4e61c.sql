ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS temp_password_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS temp_password_set_by uuid;