drop policy if exists "Engineers can view own record" on public.engineers;
create policy "Authenticated can view engineers"
on public.engineers
for select
to authenticated
using (true);