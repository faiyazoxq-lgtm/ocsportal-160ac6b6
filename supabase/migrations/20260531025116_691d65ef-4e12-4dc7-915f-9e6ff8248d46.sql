
-- ============ ENUMS ============
create type public.client_type as enum ('council','agency','landlord','private');
create type public.complexity_level as enum ('basic','intermediate','advanced');
create type public.priority_level as enum ('low','normal','high','urgent');
create type public.source_channel as enum ('email','pdf_upload','manual_entry','webhook');
create type public.assignment_role as enum ('lead','support');
create type public.assignment_status as enum ('assigned','accepted','rejected','removed');
create type public.work_order_status as enum (
  'ingested','parsing_in_progress','admin_attention','parsed_ready','categorized',
  'ready_for_dispatch','scheduled_in_sheet','assigned','accepted','en_route','on_site',
  'field_in_progress','field_submitted_complete','field_submitted_incomplete',
  'dispatcher_review','follow_up_required','closed','cancelled','duplicate_flagged','ignored'
);
create type public.incomplete_reason as enum (
  'insufficient_time','insufficient_materials','unable_to_access','no_answer',
  'tenant_refused','unsafe_conditions','additional_work_found','specialist_required',
  'follow_up_required','other'
);
create type public.review_outcome as enum (
  'closed','follow_up_required','further_quote_needed','client_update_required',
  'duplicate_confirmed','cancelled'
);

-- ============ CLIENTS ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  client_name text not null,
  client_type public.client_type not null default 'private',
  contact_name text,
  contact_email text,
  contact_phone text,
  billing_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "Dispatchers manage clients" on public.clients
  for all to authenticated
  using (public.has_role(auth.uid(),'dispatcher'))
  with check (public.has_role(auth.uid(),'dispatcher'));

-- ============ ENGINEERS ============
create table public.engineers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles(id) on delete set null,
  engineer_code text unique,
  display_name text not null,
  primary_trade text,
  trade_tags text[] not null default '{}',
  certification_tags text[] not null default '{}',
  covered_postcode_zones text[] not null default '{}',
  complexity_cap public.complexity_level not null default 'intermediate',
  can_lead boolean not null default true,
  active_status boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.engineers to authenticated;
grant all on public.engineers to service_role;
alter table public.engineers enable row level security;
create policy "Dispatchers manage engineers" on public.engineers
  for all to authenticated
  using (public.has_role(auth.uid(),'dispatcher'))
  with check (public.has_role(auth.uid(),'dispatcher'));
create trigger tg_engineers_updated_at before update on public.engineers
  for each row execute function public.tg_set_updated_at();

-- ============ WORK ORDERS ============
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  source_channel public.source_channel not null default 'manual_entry',
  parsing_confidence numeric(4,3),
  categorization_confidence numeric(4,3),
  duplicate_flag boolean not null default false,
  address_line_1 text,
  address_line_2 text,
  city text,
  postcode text,
  postcode_zone text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  job_summary text,
  job_description text,
  primary_trade text,
  trade_tags text[] not null default '{}',
  complexity_level public.complexity_level,
  certification_tags text[] not null default '{}',
  estimated_duration_minutes int,
  estimated_value_amount numeric(10,2),
  priority_level public.priority_level not null default 'normal',
  engineers_required int not null default 1,
  tools_materials_hint text,
  current_status public.work_order_status not null default 'ingested',
  current_outcome_reason public.incomplete_reason,
  diary_date date,
  diary_slot_label text,
  review_outcome public.review_outcome,
  admin_notes text,
  field_lock_active boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_work_orders_status on public.work_orders(current_status);
create index idx_work_orders_client on public.work_orders(client_id);
create index idx_work_orders_diary_date on public.work_orders(diary_date);
grant select, insert, update, delete on public.work_orders to authenticated;
grant all on public.work_orders to service_role;
alter table public.work_orders enable row level security;
create policy "Dispatchers manage work orders" on public.work_orders
  for all to authenticated
  using (public.has_role(auth.uid(),'dispatcher'))
  with check (public.has_role(auth.uid(),'dispatcher'));
create trigger tg_work_orders_updated_at before update on public.work_orders
  for each row execute function public.tg_set_updated_at();

-- ============ ASSIGNMENTS ============
create table public.work_order_assignments (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete restrict,
  assignment_role public.assignment_role not null default 'lead',
  assignment_status public.assignment_status not null default 'assigned',
  rejection_reason text,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_assignments_wo on public.work_order_assignments(work_order_id);
create index idx_assignments_engineer on public.work_order_assignments(engineer_id);
grant select, insert, update, delete on public.work_order_assignments to authenticated;
grant all on public.work_order_assignments to service_role;
alter table public.work_order_assignments enable row level security;
create policy "Dispatchers manage assignments" on public.work_order_assignments
  for all to authenticated
  using (public.has_role(auth.uid(),'dispatcher'))
  with check (public.has_role(auth.uid(),'dispatcher'));
create trigger tg_assignments_updated_at before update on public.work_order_assignments
  for each row execute function public.tg_set_updated_at();

-- ============ EVENTS ============
create table public.work_order_events (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_engineer_id uuid references public.engineers(id) on delete set null,
  event_type text not null,
  event_label text,
  event_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index idx_events_wo on public.work_order_events(work_order_id, created_at desc);
grant select, insert, update, delete on public.work_order_events to authenticated;
grant all on public.work_order_events to service_role;
alter table public.work_order_events enable row level security;
create policy "Dispatchers manage events" on public.work_order_events
  for all to authenticated
  using (public.has_role(auth.uid(),'dispatcher'))
  with check (public.has_role(auth.uid(),'dispatcher'));

-- ============ PARSING REVIEWS ============
create table public.parsing_reviews (
  id uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  issue_type text not null,
  issue_summary text,
  missing_fields_json jsonb not null default '[]'::jsonb,
  confidence_snapshot_json jsonb not null default '{}'::jsonb,
  review_status text not null default 'open',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_parsing_reviews_wo on public.parsing_reviews(work_order_id);
create index idx_parsing_reviews_status on public.parsing_reviews(review_status);
grant select, insert, update, delete on public.parsing_reviews to authenticated;
grant all on public.parsing_reviews to service_role;
alter table public.parsing_reviews enable row level security;
create policy "Dispatchers manage parsing reviews" on public.parsing_reviews
  for all to authenticated
  using (public.has_role(auth.uid(),'dispatcher'))
  with check (public.has_role(auth.uid(),'dispatcher'));
