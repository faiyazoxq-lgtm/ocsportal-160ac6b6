
-- =====================================================================
-- OCS demo seed: idempotent demo data + reseed function (dispatcher only)
-- All demo rows use fixed UUIDs so they can be reset cleanly.
-- =====================================================================

create or replace function public.seed_demo_data()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'dispatcher') then
    raise exception 'Only dispatchers may run seed_demo_data';
  end if;

  -- Wipe existing demo rows in dependency-safe order
  delete from public.work_order_events       where work_order_id in (select id from public.work_orders where order_no like 'OCS-DEMO-%');
  delete from public.parsing_reviews         where work_order_id in (select id from public.work_orders where order_no like 'OCS-DEMO-%');
  delete from public.work_order_assignments  where work_order_id in (select id from public.work_orders where order_no like 'OCS-DEMO-%');
  delete from public.work_orders             where order_no like 'OCS-DEMO-%';
  delete from public.engineer_availability   where engineer_id in (select id from public.engineers where engineer_code like 'DEMO-%');
  delete from public.engineers               where engineer_code like 'DEMO-%';
  delete from public.clients                 where id in (
    '11111111-1111-1111-1111-000000000001',
    '11111111-1111-1111-1111-000000000002',
    '11111111-1111-1111-1111-000000000003',
    '11111111-1111-1111-1111-000000000004',
    '11111111-1111-1111-1111-000000000005'
  );

  -- ---------- Clients ----------
  insert into public.clients (id, client_name, client_type, contact_name, contact_email, contact_phone, billing_notes, active) values
    ('11111111-1111-1111-1111-000000000001','Camden Council Housing','council','Sarah Whitfield','repairs@camden-demo.gov.uk','020 7946 0011','PO required on all jobs over £500',true),
    ('11111111-1111-1111-1111-000000000002','Foxtons Lettings (Demo)','agency','Daniel Pereira','maintenance@foxtons-demo.co.uk','020 7946 0022','Net 30, invoice monthly',true),
    ('11111111-1111-1111-1111-000000000003','Hackney Homes Landlord','landlord','Priya Shah','priya@hackneyhomes-demo.com','07700 900033',null,true),
    ('11111111-1111-1111-1111-000000000004','Mr. James Holloway','private','James Holloway','james.holloway@example.com','07700 900044','Card on file',true),
    ('11111111-1111-1111-1111-000000000005','Peabody Trust (Demo)','agency','Aisha Bello','workorders@peabody-demo.org','020 7946 0055','Bulk invoicing - end of month',true);

  -- ---------- Engineers ----------
  insert into public.engineers
    (id, engineer_code, display_name, primary_trade, trade_tags, certification_tags, covered_postcode_zones, complexity_cap, can_lead, active_status, notes) values
    ('22222222-2222-2222-2222-000000000001','DEMO-ENG-01','Tom Bradley','plumbing',     '{plumbing,heating}',       '{gas_safe,unvented_hwss}', '{NW,N,NW1,NW3,N1}',      'advanced',     true,  true,  'Lead plumbing/heating engineer'),
    ('22222222-2222-2222-2222-000000000002','DEMO-ENG-02','Marcus Reid','electrical',   '{electrical}',             '{18th_edition,niceic}',    '{E,EC,E1,E2,EC1}',       'advanced',     true,  true,  'NICEIC qualified'),
    ('22222222-2222-2222-2222-000000000003','DEMO-ENG-03','Liam O''Connor','gas',       '{gas,heating,plumbing}',   '{gas_safe,acs}',           '{SE,SW,SE1,SW9}',        'advanced',     true,  true,  'Gas-safe registered'),
    ('22222222-2222-2222-2222-000000000004','DEMO-ENG-04','Daisy Ngata','multi-trade',  '{handyman,carpentry,painting,plastering}', '{cscs}',  '{N,NW,E,N4,N7}',         'intermediate', true,  true,  'General multi-trade'),
    ('22222222-2222-2222-2222-000000000005','DEMO-ENG-05','Helena Vogt','damp-mould',   '{damp,mould,plastering}',  '{ppe_trained}',            '{SE,SW,SE15,SW2}',       'intermediate', true,  true,  'Damp & mould specialist'),
    ('22222222-2222-2222-2222-000000000006','DEMO-ENG-06','Sam Patel','support',       '{handyman,labour}',        '{}',                       '{N,NW,E,EC}',            'basic',        false, true,  'Support engineer - cannot lead'),
    ('22222222-2222-2222-2222-000000000007','DEMO-ENG-07','Robert King','electrical',  '{electrical}',             '{18th_edition}',           '{W,W2,W11}',             'intermediate', true,  false, 'On extended leave - inactive');

  -- ---------- Availability ----------
  insert into public.engineer_availability (id, engineer_id, availability_type, weekday_rule, start_at, end_at, note) values
    ('77777777-7777-7777-7777-000000000001','22222222-2222-2222-2222-000000000001','working_hours','mon-fri 08:00-17:00', null, null, 'Standard working hours'),
    ('77777777-7777-7777-7777-000000000002','22222222-2222-2222-2222-000000000002','working_hours','mon-fri 08:00-17:00', null, null, 'Standard working hours'),
    ('77777777-7777-7777-7777-000000000003','22222222-2222-2222-2222-000000000003','working_hours','mon-sat 07:00-18:00', null, null, 'Six-day cover'),
    ('77777777-7777-7777-7777-000000000004','22222222-2222-2222-2222-000000000004','time_off',      null, now() + interval '2 days', now() + interval '9 days', 'Annual leave'),
    ('77777777-7777-7777-7777-000000000005','22222222-2222-2222-2222-000000000005','unavailable_block', null, now() + interval '1 day', now() + interval '1 day 4 hours', 'Training course'),
    ('77777777-7777-7777-7777-000000000006','22222222-2222-2222-2222-000000000006','working_hours','mon-fri 09:00-17:00', null, null, 'Standard working hours');

  -- ---------- Work Orders ----------
  -- Intake queue (3): ingested, parsed_ready, categorized
  insert into public.work_orders (id, order_no, client_id, source_channel, current_status, job_summary, job_description,
    address_line_1, city, postcode, postcode_zone, primary_trade, trade_tags, complexity_level, priority_level,
    engineers_required, estimated_duration_minutes, estimated_value_amount, parsing_confidence, categorization_confidence, admin_notes) values

    ('33333333-3333-3333-3333-000000000001','OCS-DEMO-001','11111111-1111-1111-1111-000000000001','email','ingested',
      'Boiler not firing - no hot water','Tenant reports boiler making clicking noise then shutting down. No hot water since yesterday evening.',
      '12 Greenleaf House, Bayham St','London','NW1 0EX','NW1','heating','{heating,gas,plumbing}','intermediate','high',
      1,120,260,0.91,0.88,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000002','OCS-DEMO-002','11111111-1111-1111-1111-000000000002','email','parsed_ready',
      'Leak under kitchen sink','Slow leak from waste trap, water collecting in cupboard. Tenant placed bucket. Needs investigation and re-seal.',
      'Flat 4, 18 Stoke Newington Rd','London','N16 8BJ','N16','plumbing','{plumbing}','basic','normal',
      1,90,180,0.94,0.92,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000003','OCS-DEMO-003','11111111-1111-1111-1111-000000000003','pdf_upload','categorized',
      'Tripping RCD in consumer unit','Whole property loses power intermittently. RCD trips at random. Suspected faulty appliance or shower circuit.',
      '47 Mare Street','London','E8 1HR','E8','electrical','{electrical}','advanced','high',
      1,150,340,0.89,0.83,'[demo seed]'),

  -- Attention queue (2)
    ('33333333-3333-3333-3333-000000000004','OCS-DEMO-004','11111111-1111-1111-1111-000000000005','email','admin_attention',
      'Reported damp in bedroom (low confidence parse)','Email mentions ''black patches'' on wall but no clear address or contact phone provided. Needs dispatcher review.',
      null,'London',null,null,'damp-mould','{damp,mould}','intermediate','normal',
      1,180,420,0.42,0.55,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000005','OCS-DEMO-005','11111111-1111-1111-1111-000000000004','manual_entry','admin_attention',
      'Blocked drain - access unclear','Customer reports drain blockage in rear courtyard. Access route and shared responsibility unclear, dispatcher to confirm.',
      '8 Hillgate Place','London','W8 7SP','W8','drainage','{drainage,plumbing}','intermediate','high',
      1,120,300,0.58,0.61,'[demo seed]'),

  -- Dispatch board (4): ready_for_dispatch x2, assigned x2
    ('33333333-3333-3333-3333-000000000006','OCS-DEMO-006','11111111-1111-1111-1111-000000000001','email','ready_for_dispatch',
      'Replace faulty immersion heater element','Tenant has no hot water from immersion. Element suspected. Unvented HWSS cert preferred.',
      '22 Plender St','London','NW1 0LB','NW1','plumbing','{plumbing,heating}','advanced','normal',
      1,150,310,0.96,0.94,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000007','OCS-DEMO-007','11111111-1111-1111-1111-000000000002','email','ready_for_dispatch',
      'Refurbishment snag list - 6 items','End-of-refurb snag walk. Painting touch-ups, door adjustment, silicone re-seal in bathroom, two light fittings to swap.',
      'Flat 12, 30 Holloway Rd','London','N7 8JG','N7','multi-trade','{handyman,carpentry,painting}','intermediate','low',
      2,300,640,0.93,0.90,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000008','OCS-DEMO-008','11111111-1111-1111-1111-000000000005','email','assigned',
      'Gas leak suspected - urgent','Strong gas smell reported by neighbour. Property currently empty. Gas-safe attendance required ASAP.',
      '5 Coldharbour Ln','London','SE5 9NU','SE5','gas','{gas,heating}','advanced','urgent',
      1,90,420,0.98,0.97,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000009','OCS-DEMO-009','11111111-1111-1111-1111-000000000003','manual_entry','assigned',
      'Bathroom ceiling mould treatment + reskim','Recurring mould in bathroom ceiling. Treat, reskim and repaint. Two engineers preferred for one-day turnaround.',
      '14 Bellenden Rd','London','SE15 4QY','SE15','damp-mould','{damp,mould,plastering,painting}','intermediate','normal',
      2,360,720,0.95,0.91,'[demo seed]'),

  -- Review queue (3)
    ('33333333-3333-3333-3333-000000000010','OCS-DEMO-010','11111111-1111-1111-1111-000000000001','email','dispatcher_review',
      'Radiator cold downstairs - balance + bleed','Engineer attended, bled system and balanced rads. Awaiting dispatcher sign-off before close.',
      '99 Royal College St','London','NW1 0SE','NW1','heating','{heating,plumbing}','basic','normal',
      1,60,140,0.93,0.92,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000011','OCS-DEMO-011','11111111-1111-1111-1111-000000000004','email','field_submitted_incomplete',
      'Replace shower mixer valve - parts not on van','Engineer attended but valve model not stocked. Ordered part, return visit required. Customer informed.',
      '8 Hillgate Place','London','W8 7SP','W8','plumbing','{plumbing}','intermediate','normal',
      1,120,260,0.94,0.92,'[demo seed]'),

    ('33333333-3333-3333-3333-000000000012','OCS-DEMO-012','11111111-1111-1111-1111-000000000002','email','field_submitted_complete',
      'Replace 3x faulty downlights in kitchen','Three GU10 downlights replaced, tested. Photos uploaded. Ready for dispatcher review and close.',
      'Flat 2, 44 Upper St','London','N1 0PN','N1','electrical','{electrical}','basic','low',
      1,75,160,0.97,0.95,'[demo seed]');

  -- ---------- Parsing reviews (for attention queue) ----------
  insert into public.parsing_reviews (id, work_order_id, issue_type, issue_summary, missing_fields_json, confidence_snapshot_json, review_status) values
    ('55555555-5555-5555-5555-000000000001','33333333-3333-3333-3333-000000000004','low_confidence',
      'Parser confidence below threshold - missing address and contact details',
      '["address_line_1","postcode","postcode_zone","contact_phone"]'::jsonb,
      '{"parsing":0.42,"categorization":0.55}'::jsonb,'open'),
    ('55555555-5555-5555-5555-000000000002','33333333-3333-3333-3333-000000000005','ambiguous_scope',
      'Access route and responsibility unclear - confirm with client before dispatch',
      '["access_notes"]'::jsonb,
      '{"parsing":0.58,"categorization":0.61}'::jsonb,'open');

  -- ---------- Assignments ----------
  -- WO 008: lead only (urgent gas)
  insert into public.work_order_assignments (id, work_order_id, engineer_id, assignment_role, assignment_status) values
    ('44444444-4444-4444-4444-000000000001','33333333-3333-3333-3333-000000000008','22222222-2222-2222-2222-000000000003','lead','accepted');

  -- WO 009: lead + support (mould job, two engineers)
  insert into public.work_order_assignments (id, work_order_id, engineer_id, assignment_role, assignment_status) values
    ('44444444-4444-4444-4444-000000000002','33333333-3333-3333-3333-000000000009','22222222-2222-2222-2222-000000000005','lead','assigned'),
    ('44444444-4444-4444-4444-000000000003','33333333-3333-3333-3333-000000000009','22222222-2222-2222-2222-000000000006','support','assigned');

  -- WO 011 (incomplete review): lead historically assigned
  insert into public.work_order_assignments (id, work_order_id, engineer_id, assignment_role, assignment_status) values
    ('44444444-4444-4444-4444-000000000004','33333333-3333-3333-3333-000000000011','22222222-2222-2222-2222-000000000001','lead','accepted');

  -- WO 010, 012: lead engineers who attended
  insert into public.work_order_assignments (id, work_order_id, engineer_id, assignment_role, assignment_status) values
    ('44444444-4444-4444-4444-000000000005','33333333-3333-3333-3333-000000000010','22222222-2222-2222-2222-000000000001','lead','accepted'),
    ('44444444-4444-4444-4444-000000000006','33333333-3333-3333-3333-000000000012','22222222-2222-2222-2222-000000000002','lead','accepted');

  -- ---------- Events (timeline) ----------
  insert into public.work_order_events (id, work_order_id, event_type, event_label, event_payload_json) values
    ('66666666-6666-6666-6666-000000000001','33333333-3333-3333-3333-000000000001','ingest','Work order ingested from email','{"source":"email"}'::jsonb),
    ('66666666-6666-6666-6666-000000000002','33333333-3333-3333-3333-000000000004','parse_flag','Flagged for admin attention - low parsing confidence','{"confidence":0.42}'::jsonb),
    ('66666666-6666-6666-6666-000000000003','33333333-3333-3333-3333-000000000008','assign','Lead engineer assigned','{"engineer":"Liam O''Connor","role":"lead"}'::jsonb),
    ('66666666-6666-6666-6666-000000000004','33333333-3333-3333-3333-000000000008','status_change','Engineer accepted assignment','{"from":"assigned","to":"accepted"}'::jsonb),
    ('66666666-6666-6666-6666-000000000005','33333333-3333-3333-3333-000000000009','assign','Lead + support engineers assigned','{"lead":"Helena Vogt","support":"Sam Patel"}'::jsonb),
    ('66666666-6666-6666-6666-000000000006','33333333-3333-3333-3333-000000000010','field_submit','Engineer submitted job as complete','{}'::jsonb),
    ('66666666-6666-6666-6666-000000000007','33333333-3333-3333-3333-000000000010','review_open','Awaiting dispatcher review','{}'::jsonb),
    ('66666666-6666-6666-6666-000000000008','33333333-3333-3333-3333-000000000011','field_submit','Engineer submitted job as incomplete - parts required','{"reason":"parts_not_available"}'::jsonb),
    ('66666666-6666-6666-6666-000000000009','33333333-3333-3333-3333-000000000012','field_submit','Engineer submitted job as complete','{"photos":3}'::jsonb);
end;
$$;

grant execute on function public.seed_demo_data() to authenticated;

-- Run the seed once now so the environment is populated.
-- We bypass the auth.uid() guard by calling the body inline via a privileged DO block.
do $$
begin
  -- Mirror seed_demo_data() body but skip the role check (this runs as superuser during migration).
  delete from public.work_order_events       where work_order_id in (select id from public.work_orders where order_no like 'OCS-DEMO-%');
  delete from public.parsing_reviews         where work_order_id in (select id from public.work_orders where order_no like 'OCS-DEMO-%');
  delete from public.work_order_assignments  where work_order_id in (select id from public.work_orders where order_no like 'OCS-DEMO-%');
  delete from public.work_orders             where order_no like 'OCS-DEMO-%';
  delete from public.engineer_availability   where engineer_id in (select id from public.engineers where engineer_code like 'DEMO-%');
  delete from public.engineers               where engineer_code like 'DEMO-%';
  delete from public.clients                 where id in (
    '11111111-1111-1111-1111-000000000001',
    '11111111-1111-1111-1111-000000000002',
    '11111111-1111-1111-1111-000000000003',
    '11111111-1111-1111-1111-000000000004',
    '11111111-1111-1111-1111-000000000005'
  );
end $$;

-- Invoke the function as service role (during migration, has_role(auth.uid(),...) returns false because auth.uid() is null).
-- So duplicate the inserts inline here for the initial seed. Wrap in a DO block.
do $$
begin
  insert into public.clients (id, client_name, client_type, contact_name, contact_email, contact_phone, billing_notes, active) values
    ('11111111-1111-1111-1111-000000000001','Camden Council Housing','council','Sarah Whitfield','repairs@camden-demo.gov.uk','020 7946 0011','PO required on all jobs over £500',true),
    ('11111111-1111-1111-1111-000000000002','Foxtons Lettings (Demo)','agency','Daniel Pereira','maintenance@foxtons-demo.co.uk','020 7946 0022','Net 30, invoice monthly',true),
    ('11111111-1111-1111-1111-000000000003','Hackney Homes Landlord','landlord','Priya Shah','priya@hackneyhomes-demo.com','07700 900033',null,true),
    ('11111111-1111-1111-1111-000000000004','Mr. James Holloway','private','James Holloway','james.holloway@example.com','07700 900044','Card on file',true),
    ('11111111-1111-1111-1111-000000000005','Peabody Trust (Demo)','agency','Aisha Bello','workorders@peabody-demo.org','020 7946 0055','Bulk invoicing - end of month',true);

  insert into public.engineers
    (id, engineer_code, display_name, primary_trade, trade_tags, certification_tags, covered_postcode_zones, complexity_cap, can_lead, active_status, notes) values
    ('22222222-2222-2222-2222-000000000001','DEMO-ENG-01','Tom Bradley','plumbing',     '{plumbing,heating}',       '{gas_safe,unvented_hwss}', '{NW,N,NW1,NW3,N1}',      'advanced',     true,  true,  'Lead plumbing/heating engineer'),
    ('22222222-2222-2222-2222-000000000002','DEMO-ENG-02','Marcus Reid','electrical',   '{electrical}',             '{18th_edition,niceic}',    '{E,EC,E1,E2,EC1}',       'advanced',     true,  true,  'NICEIC qualified'),
    ('22222222-2222-2222-2222-000000000003','DEMO-ENG-03','Liam O''Connor','gas',       '{gas,heating,plumbing}',   '{gas_safe,acs}',           '{SE,SW,SE1,SW9}',        'advanced',     true,  true,  'Gas-safe registered'),
    ('22222222-2222-2222-2222-000000000004','DEMO-ENG-04','Daisy Ngata','multi-trade',  '{handyman,carpentry,painting,plastering}', '{cscs}',  '{N,NW,E,N4,N7}',         'intermediate', true,  true,  'General multi-trade'),
    ('22222222-2222-2222-2222-000000000005','DEMO-ENG-05','Helena Vogt','damp-mould',   '{damp,mould,plastering}',  '{ppe_trained}',            '{SE,SW,SE15,SW2}',       'intermediate', true,  true,  'Damp & mould specialist'),
    ('22222222-2222-2222-2222-000000000006','DEMO-ENG-06','Sam Patel','support',       '{handyman,labour}',        '{}',                       '{N,NW,E,EC}',            'basic',        false, true,  'Support engineer - cannot lead'),
    ('22222222-2222-2222-2222-000000000007','DEMO-ENG-07','Robert King','electrical',  '{electrical}',             '{18th_edition}',           '{W,W2,W11}',             'intermediate', true,  false, 'On extended leave - inactive');

  insert into public.engineer_availability (id, engineer_id, availability_type, weekday_rule, start_at, end_at, note) values
    ('77777777-7777-7777-7777-000000000001','22222222-2222-2222-2222-000000000001','working_hours','mon-fri 08:00-17:00', null, null, 'Standard working hours'),
    ('77777777-7777-7777-7777-000000000002','22222222-2222-2222-2222-000000000002','working_hours','mon-fri 08:00-17:00', null, null, 'Standard working hours'),
    ('77777777-7777-7777-7777-000000000003','22222222-2222-2222-2222-000000000003','working_hours','mon-sat 07:00-18:00', null, null, 'Six-day cover'),
    ('77777777-7777-7777-7777-000000000004','22222222-2222-2222-2222-000000000004','time_off',      null, now() + interval '2 days', now() + interval '9 days', 'Annual leave'),
    ('77777777-7777-7777-7777-000000000005','22222222-2222-2222-2222-000000000005','unavailable_block', null, now() + interval '1 day', now() + interval '1 day 4 hours', 'Training course'),
    ('77777777-7777-7777-7777-000000000006','22222222-2222-2222-2222-000000000006','working_hours','mon-fri 09:00-17:00', null, null, 'Standard working hours');

  insert into public.work_orders (id, order_no, client_id, source_channel, current_status, job_summary, job_description,
    address_line_1, city, postcode, postcode_zone, primary_trade, trade_tags, complexity_level, priority_level,
    engineers_required, estimated_duration_minutes, estimated_value_amount, parsing_confidence, categorization_confidence, admin_notes) values
    ('33333333-3333-3333-3333-000000000001','OCS-DEMO-001','11111111-1111-1111-1111-000000000001','email','ingested',
      'Boiler not firing - no hot water','Tenant reports boiler making clicking noise then shutting down. No hot water since yesterday evening.',
      '12 Greenleaf House, Bayham St','London','NW1 0EX','NW1','heating','{heating,gas,plumbing}','intermediate','high',
      1,120,260,0.91,0.88,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000002','OCS-DEMO-002','11111111-1111-1111-1111-000000000002','email','parsed_ready',
      'Leak under kitchen sink','Slow leak from waste trap, water collecting in cupboard. Tenant placed bucket. Needs investigation and re-seal.',
      'Flat 4, 18 Stoke Newington Rd','London','N16 8BJ','N16','plumbing','{plumbing}','basic','normal',
      1,90,180,0.94,0.92,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000003','OCS-DEMO-003','11111111-1111-1111-1111-000000000003','pdf_upload','categorized',
      'Tripping RCD in consumer unit','Whole property loses power intermittently. RCD trips at random. Suspected faulty appliance or shower circuit.',
      '47 Mare Street','London','E8 1HR','E8','electrical','{electrical}','advanced','high',
      1,150,340,0.89,0.83,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000004','OCS-DEMO-004','11111111-1111-1111-1111-000000000005','email','admin_attention',
      'Reported damp in bedroom (low confidence parse)','Email mentions ''black patches'' on wall but no clear address or contact phone provided. Needs dispatcher review.',
      null,'London',null,null,'damp-mould','{damp,mould}','intermediate','normal',
      1,180,420,0.42,0.55,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000005','OCS-DEMO-005','11111111-1111-1111-1111-000000000004','manual_entry','admin_attention',
      'Blocked drain - access unclear','Customer reports drain blockage in rear courtyard. Access route and shared responsibility unclear, dispatcher to confirm.',
      '8 Hillgate Place','London','W8 7SP','W8','drainage','{drainage,plumbing}','intermediate','high',
      1,120,300,0.58,0.61,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000006','OCS-DEMO-006','11111111-1111-1111-1111-000000000001','email','ready_for_dispatch',
      'Replace faulty immersion heater element','Tenant has no hot water from immersion. Element suspected. Unvented HWSS cert preferred.',
      '22 Plender St','London','NW1 0LB','NW1','plumbing','{plumbing,heating}','advanced','normal',
      1,150,310,0.96,0.94,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000007','OCS-DEMO-007','11111111-1111-1111-1111-000000000002','email','ready_for_dispatch',
      'Refurbishment snag list - 6 items','End-of-refurb snag walk. Painting touch-ups, door adjustment, silicone re-seal in bathroom, two light fittings to swap.',
      'Flat 12, 30 Holloway Rd','London','N7 8JG','N7','multi-trade','{handyman,carpentry,painting}','intermediate','low',
      2,300,640,0.93,0.90,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000008','OCS-DEMO-008','11111111-1111-1111-1111-000000000005','email','assigned',
      'Gas leak suspected - urgent','Strong gas smell reported by neighbour. Property currently empty. Gas-safe attendance required ASAP.',
      '5 Coldharbour Ln','London','SE5 9NU','SE5','gas','{gas,heating}','advanced','urgent',
      1,90,420,0.98,0.97,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000009','OCS-DEMO-009','11111111-1111-1111-1111-000000000003','manual_entry','assigned',
      'Bathroom ceiling mould treatment + reskim','Recurring mould in bathroom ceiling. Treat, reskim and repaint. Two engineers preferred for one-day turnaround.',
      '14 Bellenden Rd','London','SE15 4QY','SE15','damp-mould','{damp,mould,plastering,painting}','intermediate','normal',
      2,360,720,0.95,0.91,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000010','OCS-DEMO-010','11111111-1111-1111-1111-000000000001','email','dispatcher_review',
      'Radiator cold downstairs - balance + bleed','Engineer attended, bled system and balanced rads. Awaiting dispatcher sign-off before close.',
      '99 Royal College St','London','NW1 0SE','NW1','heating','{heating,plumbing}','basic','normal',
      1,60,140,0.93,0.92,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000011','OCS-DEMO-011','11111111-1111-1111-1111-000000000004','email','field_submitted_incomplete',
      'Replace shower mixer valve - parts not on van','Engineer attended but valve model not stocked. Ordered part, return visit required. Customer informed.',
      '8 Hillgate Place','London','W8 7SP','W8','plumbing','{plumbing}','intermediate','normal',
      1,120,260,0.94,0.92,'[demo seed]'),
    ('33333333-3333-3333-3333-000000000012','OCS-DEMO-012','11111111-1111-1111-1111-000000000002','email','field_submitted_complete',
      'Replace 3x faulty downlights in kitchen','Three GU10 downlights replaced, tested. Photos uploaded. Ready for dispatcher review and close.',
      'Flat 2, 44 Upper St','London','N1 0PN','N1','electrical','{electrical}','basic','low',
      1,75,160,0.97,0.95,'[demo seed]');

  insert into public.parsing_reviews (id, work_order_id, issue_type, issue_summary, missing_fields_json, confidence_snapshot_json, review_status) values
    ('55555555-5555-5555-5555-000000000001','33333333-3333-3333-3333-000000000004','low_confidence',
      'Parser confidence below threshold - missing address and contact details',
      '["address_line_1","postcode","postcode_zone","contact_phone"]'::jsonb,
      '{"parsing":0.42,"categorization":0.55}'::jsonb,'open'),
    ('55555555-5555-5555-5555-000000000002','33333333-3333-3333-3333-000000000005','ambiguous_scope',
      'Access route and responsibility unclear - confirm with client before dispatch',
      '["access_notes"]'::jsonb,
      '{"parsing":0.58,"categorization":0.61}'::jsonb,'open');

  insert into public.work_order_assignments (id, work_order_id, engineer_id, assignment_role, assignment_status) values
    ('44444444-4444-4444-4444-000000000001','33333333-3333-3333-3333-000000000008','22222222-2222-2222-2222-000000000003','lead','accepted'),
    ('44444444-4444-4444-4444-000000000002','33333333-3333-3333-3333-000000000009','22222222-2222-2222-2222-000000000005','lead','assigned'),
    ('44444444-4444-4444-4444-000000000003','33333333-3333-3333-3333-000000000009','22222222-2222-2222-2222-000000000006','support','assigned'),
    ('44444444-4444-4444-4444-000000000004','33333333-3333-3333-3333-000000000011','22222222-2222-2222-2222-000000000001','lead','accepted'),
    ('44444444-4444-4444-4444-000000000005','33333333-3333-3333-3333-000000000010','22222222-2222-2222-2222-000000000001','lead','accepted'),
    ('44444444-4444-4444-4444-000000000006','33333333-3333-3333-3333-000000000012','22222222-2222-2222-2222-000000000002','lead','accepted');

  insert into public.work_order_events (id, work_order_id, event_type, event_label, event_payload_json) values
    ('66666666-6666-6666-6666-000000000001','33333333-3333-3333-3333-000000000001','ingest','Work order ingested from email','{"source":"email"}'::jsonb),
    ('66666666-6666-6666-6666-000000000002','33333333-3333-3333-3333-000000000004','parse_flag','Flagged for admin attention - low parsing confidence','{"confidence":0.42}'::jsonb),
    ('66666666-6666-6666-6666-000000000003','33333333-3333-3333-3333-000000000008','assign','Lead engineer assigned','{"engineer":"Liam O''Connor","role":"lead"}'::jsonb),
    ('66666666-6666-6666-6666-000000000004','33333333-3333-3333-3333-000000000008','status_change','Engineer accepted assignment','{"from":"assigned","to":"accepted"}'::jsonb),
    ('66666666-6666-6666-6666-000000000005','33333333-3333-3333-3333-000000000009','assign','Lead + support engineers assigned','{"lead":"Helena Vogt","support":"Sam Patel"}'::jsonb),
    ('66666666-6666-6666-6666-000000000006','33333333-3333-3333-3333-000000000010','field_submit','Engineer submitted job as complete','{}'::jsonb),
    ('66666666-6666-6666-6666-000000000007','33333333-3333-3333-3333-000000000010','review_open','Awaiting dispatcher review','{}'::jsonb),
    ('66666666-6666-6666-6666-000000000008','33333333-3333-3333-3333-000000000011','field_submit','Engineer submitted job as incomplete - parts required','{"reason":"parts_not_available"}'::jsonb),
    ('66666666-6666-6666-6666-000000000009','33333333-3333-3333-3333-000000000012','field_submit','Engineer submitted job as complete','{"photos":3}'::jsonb);
end $$;
