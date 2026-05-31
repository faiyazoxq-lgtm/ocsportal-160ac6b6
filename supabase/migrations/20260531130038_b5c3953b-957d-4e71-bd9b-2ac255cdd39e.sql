
-- ============ Enums ============
create type public.notification_type as enum (
  'intake_review_required',
  'duplicate_suspected',
  'work_order_assigned',
  'work_order_reassigned',
  'diary_changed',
  'engineer_rejected',
  'job_completed',
  'job_incomplete',
  'sync_failed',
  'sync_recovered',
  'planner_conflict',
  'overdue_follow_up',
  'billing_ready',
  'billing_on_hold'
);

create type public.notification_severity as enum ('info','warn','critical');

create type public.notification_delivery_status as enum ('pending','sent','failed','skipped');

-- ============ notifications ============
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null,
  notification_type public.notification_type not null,
  severity public.notification_severity not null default 'info',
  title text not null,
  body text,
  link_path text,
  target_record_type text,
  target_record_id uuid,
  payload_json jsonb not null default '{}'::jsonb,
  dedup_key text,
  read_at timestamptz,
  dismissed_at timestamptz,
  telegram_delivery_status public.notification_delivery_status not null default 'skipped',
  telegram_sent_at timestamptz,
  telegram_error text,
  created_at timestamptz not null default now()
);

create index idx_notif_recipient on public.notifications (recipient_profile_id, created_at desc);
create index idx_notif_unread on public.notifications (recipient_profile_id)
  where read_at is null and dismissed_at is null;
create unique index uniq_notif_dedup
  on public.notifications (recipient_profile_id, dedup_key)
  where dedup_key is not null;
create index idx_notif_telegram_pending on public.notifications (recipient_profile_id)
  where telegram_delivery_status = 'pending';

grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;

alter table public.notifications enable row level security;

create policy "Users view own notifications"
  on public.notifications for select to authenticated
  using (recipient_profile_id = auth.uid());

create policy "Users update own notifications"
  on public.notifications for update to authenticated
  using (recipient_profile_id = auth.uid())
  with check (recipient_profile_id = auth.uid());

-- ============ notification_preferences ============
create table public.notification_preferences (
  profile_id uuid primary key,
  in_app_enabled boolean not null default true,
  telegram_enabled boolean not null default true,
  muted_types public.notification_type[] not null default '{}'::public.notification_type[],
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.notification_preferences to authenticated;
grant all on public.notification_preferences to service_role;

alter table public.notification_preferences enable row level security;

create policy "Own prefs view" on public.notification_preferences
  for select to authenticated using (profile_id = auth.uid());
create policy "Own prefs insert" on public.notification_preferences
  for insert to authenticated with check (profile_id = auth.uid());
create policy "Own prefs update" on public.notification_preferences
  for update to authenticated using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create trigger trg_notif_prefs_updated
  before update on public.notification_preferences
  for each row execute function public.tg_set_updated_at();

-- ============ Helpers ============
create or replace function public.create_notification(
  _recipient uuid,
  _type public.notification_type,
  _severity public.notification_severity,
  _title text,
  _body text,
  _link text,
  _target_type text,
  _target_id uuid,
  _payload jsonb default '{}'::jsonb,
  _dedup text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  _id uuid;
  _muted boolean := false;
  _in_app boolean := true;
  _tg_enabled boolean := true;
  _has_tg boolean := false;
  _tg_status public.notification_delivery_status;
begin
  if _recipient is null then return null; end if;

  select coalesce(np.in_app_enabled, true),
         coalesce(np.telegram_enabled, true),
         (_type = any(coalesce(np.muted_types, '{}'::public.notification_type[])))
    into _in_app, _tg_enabled, _muted
  from public.profiles p
  left join public.notification_preferences np on np.profile_id = p.id
  where p.id = _recipient;

  if _muted or not _in_app then
    return null;
  end if;

  select telegram_chat_id is not null into _has_tg
    from public.user_contact_profiles
    where profile_id = _recipient;

  _tg_status := case
    when coalesce(_tg_enabled,true) and coalesce(_has_tg,false) then 'pending'::public.notification_delivery_status
    else 'skipped'::public.notification_delivery_status
  end;

  if _dedup is not null then
    insert into public.notifications
      (recipient_profile_id, notification_type, severity, title, body, link_path,
       target_record_type, target_record_id, payload_json, dedup_key,
       telegram_delivery_status)
    values
      (_recipient, _type, _severity, _title, _body, _link,
       _target_type, _target_id, _payload, _dedup, _tg_status)
    on conflict (recipient_profile_id, dedup_key) where dedup_key is not null
    do nothing
    returning id into _id;
  else
    insert into public.notifications
      (recipient_profile_id, notification_type, severity, title, body, link_path,
       target_record_type, target_record_id, payload_json,
       telegram_delivery_status)
    values
      (_recipient, _type, _severity, _title, _body, _link,
       _target_type, _target_id, _payload, _tg_status)
    returning id into _id;
  end if;

  return _id;
end $$;

grant execute on function public.create_notification(
  uuid, public.notification_type, public.notification_severity,
  text, text, text, text, uuid, jsonb, text
) to authenticated, service_role;

create or replace function public.notify_dispatchers(
  _type public.notification_type,
  _severity public.notification_severity,
  _title text,
  _body text,
  _link text,
  _target_type text,
  _target_id uuid,
  _payload jsonb default '{}'::jsonb,
  _dedup text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select ur.user_id from public.user_roles ur where ur.role = 'dispatcher' loop
    perform public.create_notification(
      r.user_id, _type, _severity, _title, _body, _link, _target_type, _target_id, _payload,
      case when _dedup is not null then _dedup || ':' || r.user_id::text else null end
    );
  end loop;
end $$;

create or replace function public.notify_assigned_engineers(
  _wo uuid,
  _type public.notification_type,
  _severity public.notification_severity,
  _title text,
  _body text,
  _link text,
  _payload jsonb default '{}'::jsonb,
  _dedup_prefix text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select distinct e.profile_id
    from public.work_order_assignments wa
    join public.engineers e on e.id = wa.engineer_id
    where wa.work_order_id = _wo
      and wa.assignment_status in ('assigned','accepted')
      and e.profile_id is not null
  loop
    perform public.create_notification(
      r.profile_id, _type, _severity, _title, _body, _link, 'work_order', _wo, _payload,
      case when _dedup_prefix is not null then _dedup_prefix || ':' || _wo::text || ':' || r.profile_id::text else null end
    );
  end loop;
end $$;

-- ============ Triggers ============

-- Assignment insert → notify engineer
create or replace function public.tg_notif_assignment_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  _profile uuid;
  _wo public.work_orders%rowtype;
  _sev public.notification_severity;
begin
  select profile_id into _profile from public.engineers where id = NEW.engineer_id;
  if _profile is null then return NEW; end if;
  select * into _wo from public.work_orders where id = NEW.work_order_id;
  _sev := case when _wo.priority_level = 'urgent' then 'critical'::public.notification_severity
               when _wo.priority_level = 'high'   then 'warn'::public.notification_severity
               else 'info'::public.notification_severity end;
  perform public.create_notification(
    _profile,
    'work_order_assigned',
    _sev,
    'New job assigned',
    coalesce(_wo.order_no, '') || ' · ' || coalesce(_wo.job_summary, 'New job') ||
      coalesce(' · ' || _wo.postcode_zone, ''),
    '/engineer/jobs/' || NEW.work_order_id::text,
    'work_order',
    NEW.work_order_id,
    jsonb_build_object('role', NEW.assignment_role, 'priority', _wo.priority_level),
    'assigned:' || NEW.id::text
  );
  return NEW;
end $$;
create trigger trg_notif_assignment_insert
  after insert on public.work_order_assignments
  for each row execute function public.tg_notif_assignment_insert();

-- Assignment update → rejection alert to dispatchers
create or replace function public.tg_notif_assignment_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare _wo public.work_orders%rowtype; _eng text;
begin
  if NEW.assignment_status is not distinct from OLD.assignment_status then
    return NEW;
  end if;
  if NEW.assignment_status = 'rejected' then
    select * into _wo from public.work_orders where id = NEW.work_order_id;
    select display_name into _eng from public.engineers where id = NEW.engineer_id;
    perform public.notify_dispatchers(
      'engineer_rejected', 'warn',
      'Engineer rejected job',
      coalesce(_eng,'Engineer') || ' rejected ' || coalesce(_wo.order_no,'a job') ||
        coalesce(' (' || NEW.rejection_reason || ')',''),
      '/admin/dispatch?wo=' || NEW.work_order_id::text,
      'work_order', NEW.work_order_id,
      jsonb_build_object('reason', NEW.rejection_reason),
      'rejected:' || NEW.id::text
    );
  end if;
  return NEW;
end $$;
create trigger trg_notif_assignment_update
  after update on public.work_order_assignments
  for each row execute function public.tg_notif_assignment_update();

-- Work order updates
create or replace function public.tg_notif_work_order_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Diary or schedule changed → notify engineers
  if (NEW.diary_date is distinct from OLD.diary_date)
     or (NEW.scheduled_start_at is distinct from OLD.scheduled_start_at)
     or (NEW.scheduled_end_at is distinct from OLD.scheduled_end_at) then
    perform public.notify_assigned_engineers(
      NEW.id, 'diary_changed', 'info',
      'Diary updated',
      coalesce(NEW.order_no,'Job') || ' · ' ||
        coalesce(to_char(NEW.diary_date,'Dy DD Mon'),'TBC') ||
        coalesce(' · ' || to_char(NEW.scheduled_start_at,'HH24:MI'), ''),
      '/engineer/jobs/' || NEW.id::text,
      jsonb_build_object('diary_date', NEW.diary_date),
      'diary'
    );
  end if;

  if NEW.current_status = 'field_submitted_complete'
     and OLD.current_status is distinct from NEW.current_status then
    perform public.notify_dispatchers(
      'job_completed', 'info',
      'Job submitted complete',
      coalesce(NEW.order_no,'Job') || ' · ready for review',
      '/admin/review?wo=' || NEW.id::text,
      'work_order', NEW.id, '{}'::jsonb,
      'jobcomplete:' || NEW.id::text
    );
  end if;

  if NEW.current_status = 'field_submitted_incomplete'
     and OLD.current_status is distinct from NEW.current_status then
    perform public.notify_dispatchers(
      'job_incomplete', 'warn',
      'Job submitted incomplete',
      coalesce(NEW.order_no,'Job') || coalesce(' · ' || NEW.current_outcome_reason::text, ' · follow-up needed'),
      '/admin/review?wo=' || NEW.id::text,
      'work_order', NEW.id,
      jsonb_build_object('reason', NEW.current_outcome_reason),
      'jobincomplete:' || NEW.id::text
    );
  end if;

  if NEW.planner_conflict_flag = true
     and OLD.planner_conflict_flag is distinct from true then
    perform public.notify_dispatchers(
      'planner_conflict', 'warn',
      'Planner conflict',
      coalesce(NEW.order_no,'Job') || coalesce(' · ' || NEW.planner_conflict_message,''),
      '/admin/dispatch?wo=' || NEW.id::text,
      'work_order', NEW.id, '{}'::jsonb,
      'planner:' || NEW.id::text
    );
  end if;

  return NEW;
end $$;
create trigger trg_notif_work_order_update
  after update on public.work_orders
  for each row execute function public.tg_notif_work_order_update();

-- Parsing review → dispatchers
create or replace function public.tg_notif_parsing_review_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare _wo public.work_orders%rowtype;
begin
  select * into _wo from public.work_orders where id = NEW.work_order_id;
  perform public.notify_dispatchers(
    'intake_review_required', 'info',
    'Intake needs review',
    coalesce(_wo.order_no,'Job') || ' · ' || coalesce(NEW.issue_summary, NEW.issue_type),
    '/admin/review?wo=' || NEW.work_order_id::text,
    'work_order', NEW.work_order_id,
    jsonb_build_object('issue', NEW.issue_type),
    'pr:' || NEW.id::text
  );
  return NEW;
end $$;
create trigger trg_notif_parsing_review_insert
  after insert on public.parsing_reviews
  for each row execute function public.tg_notif_parsing_review_insert();

-- Intake records → duplicate suspected
create or replace function public.tg_notif_intake_record()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(NEW.duplicate_confidence,0) >= 0.7
     and (TG_OP='INSERT' or coalesce(OLD.duplicate_confidence,0) < 0.7) then
    perform public.notify_dispatchers(
      'duplicate_suspected', 'warn',
      'Possible duplicate intake',
      coalesce(NEW.source_reference,'Inbound') || ' · ' ||
        (round((NEW.duplicate_confidence*100))::int)::text || '% match',
      '/admin/intake?id=' || NEW.id::text,
      'intake_record', NEW.id, '{}'::jsonb,
      'dup:' || NEW.id::text
    );
  end if;
  return NEW;
end $$;
create trigger trg_notif_intake_insert
  after insert on public.intake_records
  for each row execute function public.tg_notif_intake_record();
create trigger trg_notif_intake_update
  after update on public.intake_records
  for each row execute function public.tg_notif_intake_record();

-- Billing status events
create or replace function public.tg_notif_billing_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.to_status::text = 'ready_for_invoice' then
    perform public.notify_dispatchers(
      'billing_ready', 'info', 'Billing case ready', null,
      '/admin/billing?case=' || NEW.billing_case_id::text,
      'billing_case', NEW.billing_case_id, '{}'::jsonb,
      'br:' || NEW.billing_case_id::text || ':' || NEW.id::text
    );
  elsif NEW.to_status::text = 'on_hold' then
    perform public.notify_dispatchers(
      'billing_on_hold', 'warn', 'Billing case on hold', NEW.note,
      '/admin/billing?case=' || NEW.billing_case_id::text,
      'billing_case', NEW.billing_case_id, '{}'::jsonb,
      'bh:' || NEW.billing_case_id::text || ':' || NEW.id::text
    );
  end if;
  return NEW;
end $$;
create trigger trg_notif_billing_status
  after insert on public.billing_status_events
  for each row execute function public.tg_notif_billing_status();

-- Realtime
alter publication supabase_realtime add table public.notifications;
