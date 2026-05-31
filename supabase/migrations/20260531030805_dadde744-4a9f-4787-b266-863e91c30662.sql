
-- =====================================================================
-- Engineer-scoped RLS for the field portal
-- =====================================================================

create or replace function public.current_engineer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.engineers where profile_id = auth.uid() limit 1;
$$;

create or replace function public.engineer_is_assigned(_wo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_order_assignments wa
    where wa.work_order_id = _wo
      and wa.engineer_id = public.current_engineer_id()
      and wa.assignment_status in ('assigned','accepted')
  );
$$;

create or replace function public.engineer_is_lead(_wo uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.work_order_assignments wa
    where wa.work_order_id = _wo
      and wa.engineer_id = public.current_engineer_id()
      and wa.assignment_role = 'lead'
      and wa.assignment_status in ('assigned','accepted')
  );
$$;

revoke execute on function public.current_engineer_id() from public;
revoke execute on function public.engineer_is_assigned(uuid) from public;
revoke execute on function public.engineer_is_lead(uuid) from public;
grant execute on function public.current_engineer_id() to authenticated;
grant execute on function public.engineer_is_assigned(uuid) to authenticated;
grant execute on function public.engineer_is_lead(uuid) to authenticated;

-- Engineers can read their own engineer record
drop policy if exists "Engineers can view own record" on public.engineers;
create policy "Engineers can view own record"
on public.engineers
for select
to authenticated
using (profile_id = auth.uid());

-- Engineers can view assigned work orders
drop policy if exists "Engineers view assigned work orders" on public.work_orders;
create policy "Engineers view assigned work orders"
on public.work_orders
for select
to authenticated
using (public.engineer_is_assigned(id));

-- Lead engineers can update their assigned work orders (status / outcome)
drop policy if exists "Lead engineers update assigned work orders" on public.work_orders;
create policy "Lead engineers update assigned work orders"
on public.work_orders
for update
to authenticated
using (public.engineer_is_lead(id))
with check (public.engineer_is_lead(id));

-- Engineers can view assignments on their jobs (so they can see teammates)
drop policy if exists "Engineers view assignments for their jobs" on public.work_order_assignments;
create policy "Engineers view assignments for their jobs"
on public.work_order_assignments
for select
to authenticated
using (public.engineer_is_assigned(work_order_id));

-- Engineers can view timeline events for their assigned jobs
drop policy if exists "Engineers view events for their jobs" on public.work_order_events;
create policy "Engineers view events for their jobs"
on public.work_order_events
for select
to authenticated
using (public.engineer_is_assigned(work_order_id));

-- Lead engineers can insert timeline events for their jobs
drop policy if exists "Lead engineers insert events for their jobs" on public.work_order_events;
create policy "Lead engineers insert events for their jobs"
on public.work_order_events
for insert
to authenticated
with check (public.engineer_is_lead(work_order_id));

-- Engineers can view clients linked to their assigned jobs
drop policy if exists "Engineers view clients via assigned jobs" on public.clients;
create policy "Engineers view clients via assigned jobs"
on public.clients
for select
to authenticated
using (
  exists (
    select 1 from public.work_orders wo
    where wo.client_id = clients.id
      and public.engineer_is_assigned(wo.id)
  )
);
