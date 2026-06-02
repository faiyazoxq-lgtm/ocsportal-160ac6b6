CREATE POLICY "Boss reads gmail_oauth_secrets"
  ON public.gmail_oauth_secrets
  FOR SELECT TO authenticated
  USING (public.is_boss(auth.uid()));

CREATE POLICY "Boss writes gmail_oauth_secrets"
  ON public.gmail_oauth_secrets
  FOR ALL TO authenticated
  USING (public.is_boss(auth.uid()))
  WITH CHECK (public.is_boss(auth.uid()));