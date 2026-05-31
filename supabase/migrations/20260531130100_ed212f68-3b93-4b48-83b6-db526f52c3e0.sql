
revoke execute on function public.create_notification(uuid, public.notification_type, public.notification_severity, text, text, text, text, uuid, jsonb, text) from public, anon;
revoke execute on function public.notify_dispatchers(public.notification_type, public.notification_severity, text, text, text, text, uuid, jsonb, text) from public, anon;
revoke execute on function public.notify_assigned_engineers(uuid, public.notification_type, public.notification_severity, text, text, text, jsonb, text) from public, anon;
revoke execute on function public.tg_notif_assignment_insert() from public, anon, authenticated;
revoke execute on function public.tg_notif_assignment_update() from public, anon, authenticated;
revoke execute on function public.tg_notif_work_order_update() from public, anon, authenticated;
revoke execute on function public.tg_notif_parsing_review_insert() from public, anon, authenticated;
revoke execute on function public.tg_notif_intake_record() from public, anon, authenticated;
revoke execute on function public.tg_notif_billing_status() from public, anon, authenticated;
