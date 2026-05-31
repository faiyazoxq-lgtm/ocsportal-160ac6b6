
ALTER TABLE public.work_order_external_contacts
  ADD CONSTRAINT work_order_external_contacts_work_order_id_fkey
    FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT work_order_external_contacts_external_contact_id_fkey
    FOREIGN KEY (external_contact_id) REFERENCES public.external_contacts(id) ON DELETE CASCADE;

ALTER TABLE public.communication_log_entries
  ADD CONSTRAINT communication_log_entries_work_order_id_fkey
    FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE CASCADE,
  ADD CONSTRAINT communication_log_entries_external_contact_id_fkey
    FOREIGN KEY (external_contact_id) REFERENCES public.external_contacts(id) ON DELETE SET NULL,
  ADD CONSTRAINT communication_log_entries_logged_by_profile_id_fkey
    FOREIGN KEY (logged_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.communication_attachments
  ADD CONSTRAINT communication_attachments_entry_id_fkey
    FOREIGN KEY (communication_entry_id) REFERENCES public.communication_log_entries(id) ON DELETE CASCADE;
