-- Restrict engineer direct SELECT on work_orders; expose a safe view that omits
-- sensitive financial/admin columns (estimated_value_amount, admin_notes,
-- private_notes, billing-relevant fields).

DROP POLICY IF EXISTS "Engineers view assigned work orders" ON public.work_orders;

CREATE OR REPLACE VIEW public.work_orders_engineer_view
WITH (security_invoker = false) AS
SELECT
  id, order_no, client_id, source_channel,
  address_line_1, address_line_2, city, postcode, postcode_zone,
  latitude, longitude,
  job_summary, job_description,
  trade_tags, certification_tags,
  estimated_duration_minutes,
  priority_level, engineers_required, tools_materials_hint,
  current_status, current_outcome_reason,
  diary_date, diary_slot_label,
  review_outcome,
  field_lock_active, field_lock_started_at, active_editor_engineer_id,
  pending_sync_flag, last_synced_at,
  created_at, updated_at,
  scheduled_start_at, scheduled_end_at, schedule_notes,
  diary_slot_status, rescheduled_at,
  tenant_contact_id, tenant_name, tenant_phone, tenant_email, tenant_notes
FROM public.work_orders
WHERE public.engineer_is_assigned(id);

GRANT SELECT ON public.work_orders_engineer_view TO authenticated;