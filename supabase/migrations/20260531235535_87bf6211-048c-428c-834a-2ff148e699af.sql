
-- Secrets table for per-Boss Google OAuth tokens.
-- No grants to anon/authenticated → only the service role (server code) can read/write.
CREATE TABLE IF NOT EXISTS public.gmail_oauth_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  token_type text NOT NULL DEFAULT 'Bearer',
  scope text,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT ALL ON public.gmail_oauth_secrets TO service_role;

ALTER TABLE public.gmail_oauth_secrets ENABLE ROW LEVEL SECURITY;

-- No policies for anon/authenticated → completely opaque to clients.
-- service_role bypasses RLS so server code (supabaseAdmin) still works.
