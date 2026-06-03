ALTER TABLE public.user_contact_profiles
  ADD COLUMN IF NOT EXISTS telegram_phone_e164 text,
  ADD COLUMN IF NOT EXISTS telegram_link_token text;

CREATE UNIQUE INDEX IF NOT EXISTS user_contact_profiles_telegram_link_token_uq
  ON public.user_contact_profiles (telegram_link_token)
  WHERE telegram_link_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS user_contact_profiles_telegram_phone_e164_idx
  ON public.user_contact_profiles (telegram_phone_e164)
  WHERE telegram_phone_e164 IS NOT NULL;

ALTER TABLE public.user_contact_profiles
  ADD CONSTRAINT user_contact_profiles_telegram_phone_e164_chk
  CHECK (telegram_phone_e164 IS NULL OR telegram_phone_e164 ~ '^\+[1-9][0-9]{6,14}$');