-- Add engineer_permissions JSONB to company_settings to control what data engineers can see
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS engineer_permissions jsonb NOT NULL DEFAULT jsonb_build_object(
  'contact_info', jsonb_build_object(
    'see_client_phone', true,
    'see_client_email', true,
    'see_tenant_phone', true,
    'see_tenant_email', true,
    'see_other_engineer_contact', false
  ),
  'work_order_info', jsonb_build_object(
    'see_spend_limit', false,
    'see_agency_details', true,
    'see_tenant_details', true,
    'see_billing_notes', false,
    'see_full_address_pre_assignment', false
  ),
  'communications', jsonb_build_object(
    'see_communication_log', true,
    'see_attachments', true
  ),
  'directory', jsonb_build_object(
    'see_contacts_directory', true,
    'see_client_list', false,
    'see_external_contacts', false
  )
);