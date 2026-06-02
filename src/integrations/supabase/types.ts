export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      billing_adjustments: {
        Row: {
          adjustment_type: string
          amount: number | null
          billing_case_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
        }
        Insert: {
          adjustment_type: string
          amount?: number | null
          billing_case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
        }
        Update: {
          adjustment_type?: string
          amount?: number | null
          billing_case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_adjustments_billing_case_id_fkey"
            columns: ["billing_case_id"]
            isOneToOne: false
            referencedRelation: "billing_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_cases: {
        Row: {
          billable_total: number | null
          billing_notes: string | null
          billing_status: Database["public"]["Enums"]["billing_status"]
          client_reference: string | null
          created_at: string
          created_by: string | null
          expense_total: number | null
          exported_at: string | null
          id: string
          invoice_reference: string | null
          labour_summary: string | null
          materials_summary: string | null
          non_billable_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          billable_total?: number | null
          billing_notes?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          client_reference?: string | null
          created_at?: string
          created_by?: string | null
          expense_total?: number | null
          exported_at?: string | null
          id?: string
          invoice_reference?: string | null
          labour_summary?: string | null
          materials_summary?: string | null
          non_billable_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          billable_total?: number | null
          billing_notes?: string | null
          billing_status?: Database["public"]["Enums"]["billing_status"]
          client_reference?: string | null
          created_at?: string
          created_by?: string | null
          expense_total?: number | null
          exported_at?: string | null
          id?: string
          invoice_reference?: string | null
          labour_summary?: string | null
          materials_summary?: string | null
          non_billable_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: []
      }
      billing_status_events: {
        Row: {
          actor_profile_id: string | null
          billing_case_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["billing_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["billing_status"]
        }
        Insert: {
          actor_profile_id?: string | null
          billing_case_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["billing_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["billing_status"]
        }
        Update: {
          actor_profile_id?: string | null
          billing_case_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["billing_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["billing_status"]
        }
        Relationships: [
          {
            foreignKeyName: "billing_status_events_billing_case_id_fkey"
            columns: ["billing_case_id"]
            isOneToOne: false
            referencedRelation: "billing_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      boss_audit_log: {
        Row: {
          action_type: string
          actor_profile_id: string
          after_json: Json
          before_json: Json
          context_json: Json
          created_at: string
          id: string
          reason: string | null
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action_type: string
          actor_profile_id: string
          after_json?: Json
          before_json?: Json
          context_json?: Json
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action_type?: string
          actor_profile_id?: string
          after_json?: Json
          before_json?: Json
          context_json?: Json
          created_at?: string
          id?: string
          reason?: string | null
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          active: boolean
          billing_notes: string | null
          client_name: string
          client_type: Database["public"]["Enums"]["client_type"]
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
        }
        Insert: {
          active?: boolean
          billing_notes?: string | null
          client_name: string
          client_type?: Database["public"]["Enums"]["client_type"]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
        }
        Update: {
          active?: boolean
          billing_notes?: string | null
          client_name?: string
          client_type?: Database["public"]["Enums"]["client_type"]
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      communication_attachments: {
        Row: {
          byte_size: number | null
          communication_entry_id: string
          id: string
          mime_type: string | null
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          uploaded_by_profile_id: string | null
        }
        Insert: {
          byte_size?: number | null
          communication_entry_id: string
          id?: string
          mime_type?: string | null
          storage_bucket: string
          storage_path: string
          uploaded_at?: string
          uploaded_by_profile_id?: string | null
        }
        Update: {
          byte_size?: number | null
          communication_entry_id?: string
          id?: string
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_attachments_entry_id_fkey"
            columns: ["communication_entry_id"]
            isOneToOne: false
            referencedRelation: "communication_log_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_log_entries: {
        Row: {
          communication_type: Database["public"]["Enums"]["communication_type"]
          created_at: string
          direction: Database["public"]["Enums"]["communication_direction"]
          external_contact_id: string | null
          follow_up_due_at: string | null
          follow_up_resolved_at: string | null
          follow_up_resolved_by: string | null
          follow_up_status:
            | Database["public"]["Enums"]["follow_up_status"]
            | null
          id: string
          logged_by_profile_id: string | null
          occurred_at: string
          outcome: Database["public"]["Enums"]["follow_up_status"]
          requires_follow_up: boolean
          subject: string | null
          summary: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          communication_type: Database["public"]["Enums"]["communication_type"]
          created_at?: string
          direction?: Database["public"]["Enums"]["communication_direction"]
          external_contact_id?: string | null
          follow_up_due_at?: string | null
          follow_up_resolved_at?: string | null
          follow_up_resolved_by?: string | null
          follow_up_status?:
            | Database["public"]["Enums"]["follow_up_status"]
            | null
          id?: string
          logged_by_profile_id?: string | null
          occurred_at?: string
          outcome?: Database["public"]["Enums"]["follow_up_status"]
          requires_follow_up?: boolean
          subject?: string | null
          summary?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          communication_type?: Database["public"]["Enums"]["communication_type"]
          created_at?: string
          direction?: Database["public"]["Enums"]["communication_direction"]
          external_contact_id?: string | null
          follow_up_due_at?: string | null
          follow_up_resolved_at?: string | null
          follow_up_resolved_by?: string | null
          follow_up_status?:
            | Database["public"]["Enums"]["follow_up_status"]
            | null
          id?: string
          logged_by_profile_id?: string | null
          occurred_at?: string
          outcome?: Database["public"]["Enums"]["follow_up_status"]
          requires_follow_up?: boolean
          subject?: string | null
          summary?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_log_entries_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_entries_logged_by_profile_id_fkey"
            columns: ["logged_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_log_entries_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          created_at: string
          id: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
          work_email: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          work_email?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          work_email?: string | null
        }
        Relationships: []
      }
      direct_message_files: {
        Row: {
          byte_size: number | null
          file_kind: string
          id: string
          message_id: string
          metadata_json: Json
          mime_type: string | null
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          uploaded_by_profile_id: string | null
        }
        Insert: {
          byte_size?: number | null
          file_kind: string
          id?: string
          message_id: string
          metadata_json?: Json
          mime_type?: string | null
          storage_bucket: string
          storage_path: string
          uploaded_at?: string
          uploaded_by_profile_id?: string | null
        }
        Update: {
          byte_size?: number | null
          file_kind?: string
          id?: string
          message_id?: string
          metadata_json?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_files_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_message_files_uploaded_by_profile_id_fkey"
            columns: ["uploaded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_participants: {
        Row: {
          id: string
          joined_at: string
          last_read_at: string | null
          profile_id: string
          thread_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          profile_id: string
          thread_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          last_read_at?: string | null
          profile_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_message_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_threads: {
        Row: {
          created_at: string
          created_by: string
          deleted_at: string | null
          deleted_by: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_threads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          body_text: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          message_type: Database["public"]["Enums"]["dm_message_type"]
          metadata_json: Json
          sender_profile_id: string
          sent_at: string
          thread_id: string
        }
        Insert: {
          body_text?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["dm_message_type"]
          metadata_json?: Json
          sender_profile_id: string
          sent_at?: string
          thread_id: string
        }
        Update: {
          body_text?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: Database["public"]["Enums"]["dm_message_type"]
          metadata_json?: Json
          sender_profile_id?: string
          sent_at?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      engineer_availability: {
        Row: {
          availability_type: string
          created_at: string
          created_by: string | null
          end_at: string | null
          engineer_id: string
          id: string
          note: string | null
          start_at: string | null
          weekday_rule: string | null
        }
        Insert: {
          availability_type: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          engineer_id: string
          id?: string
          note?: string | null
          start_at?: string | null
          weekday_rule?: string | null
        }
        Update: {
          availability_type?: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          engineer_id?: string
          id?: string
          note?: string | null
          start_at?: string | null
          weekday_rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "engineer_availability_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
        ]
      }
      engineers: {
        Row: {
          active_status: boolean
          can_lead: boolean
          can_support: boolean
          certification_tags: string[]
          complexity_cap: Database["public"]["Enums"]["complexity_level"]
          covered_postcode_zones: string[]
          created_at: string
          display_name: string
          engineer_code: string | null
          id: string
          notes: string | null
          primary_trade: string | null
          profile_id: string | null
          trade_tags: string[]
          updated_at: string
        }
        Insert: {
          active_status?: boolean
          can_lead?: boolean
          can_support?: boolean
          certification_tags?: string[]
          complexity_cap?: Database["public"]["Enums"]["complexity_level"]
          covered_postcode_zones?: string[]
          created_at?: string
          display_name: string
          engineer_code?: string | null
          id?: string
          notes?: string | null
          primary_trade?: string | null
          profile_id?: string | null
          trade_tags?: string[]
          updated_at?: string
        }
        Update: {
          active_status?: boolean
          can_lead?: boolean
          can_support?: boolean
          certification_tags?: string[]
          complexity_cap?: Database["public"]["Enums"]["complexity_level"]
          covered_postcode_zones?: string[]
          created_at?: string
          display_name?: string
          engineer_code?: string | null
          id?: string
          notes?: string | null
          primary_trade?: string | null
          profile_id?: string | null
          trade_tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "engineers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_contacts: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          contact_type: Database["public"]["Enums"]["external_contact_type"]
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          organization: string | null
          phone: string | null
          role_label: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          contact_type?: Database["public"]["Enums"]["external_contact_type"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          contact_type?: Database["public"]["Enums"]["external_contact_type"]
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization?: string | null
          phone?: string | null
          role_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gmail_connection: {
        Row: {
          connected_at: string | null
          connected_by: string | null
          connection_id: string | null
          created_at: string
          disconnected_at: string | null
          disconnected_by: string | null
          display_name: string | null
          email_address: string | null
          history_id: string | null
          id: string
          is_connected: boolean
          last_sync_at: string | null
          last_sync_error: string | null
          singleton: boolean
          updated_at: string
        }
        Insert: {
          connected_at?: string | null
          connected_by?: string | null
          connection_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          disconnected_by?: string | null
          display_name?: string | null
          email_address?: string | null
          history_id?: string | null
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Update: {
          connected_at?: string | null
          connected_by?: string | null
          connection_id?: string | null
          created_at?: string
          disconnected_at?: string | null
          disconnected_by?: string | null
          display_name?: string | null
          email_address?: string | null
          history_id?: string | null
          id?: string
          is_connected?: boolean
          last_sync_at?: string | null
          last_sync_error?: string | null
          singleton?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      gmail_messages: {
        Row: {
          body_preview: string | null
          cc_addresses: string[]
          classification: Database["public"]["Enums"]["gmail_classification"]
          classification_reasons_json: Json
          classification_score: number | null
          classified_at: string | null
          created_at: string
          from_address: string | null
          from_name: string | null
          gmail_message_id: string
          gmail_thread_id: string
          has_attachments: boolean
          history_id: string | null
          id: string
          import_error: string | null
          imported_at: string | null
          imported_by: string | null
          imported_intake_id: string | null
          internal_date: string | null
          is_unread: boolean
          label_ids: string[]
          replied_at: string | null
          replied_by: string | null
          reply_gmail_message_id: string | null
          snippet: string | null
          subject: string | null
          to_addresses: string[]
          triage_state: Database["public"]["Enums"]["gmail_triage_state"]
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          body_preview?: string | null
          cc_addresses?: string[]
          classification?: Database["public"]["Enums"]["gmail_classification"]
          classification_reasons_json?: Json
          classification_score?: number | null
          classified_at?: string | null
          created_at?: string
          from_address?: string | null
          from_name?: string | null
          gmail_message_id: string
          gmail_thread_id: string
          has_attachments?: boolean
          history_id?: string | null
          id?: string
          import_error?: string | null
          imported_at?: string | null
          imported_by?: string | null
          imported_intake_id?: string | null
          internal_date?: string | null
          is_unread?: boolean
          label_ids?: string[]
          replied_at?: string | null
          replied_by?: string | null
          reply_gmail_message_id?: string | null
          snippet?: string | null
          subject?: string | null
          to_addresses?: string[]
          triage_state?: Database["public"]["Enums"]["gmail_triage_state"]
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          body_preview?: string | null
          cc_addresses?: string[]
          classification?: Database["public"]["Enums"]["gmail_classification"]
          classification_reasons_json?: Json
          classification_score?: number | null
          classified_at?: string | null
          created_at?: string
          from_address?: string | null
          from_name?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string
          has_attachments?: boolean
          history_id?: string | null
          id?: string
          import_error?: string | null
          imported_at?: string | null
          imported_by?: string | null
          imported_intake_id?: string | null
          internal_date?: string | null
          is_unread?: boolean
          label_ids?: string[]
          replied_at?: string | null
          replied_by?: string | null
          reply_gmail_message_id?: string | null
          snippet?: string | null
          subject?: string | null
          to_addresses?: string[]
          triage_state?: Database["public"]["Enums"]["gmail_triage_state"]
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gmail_oauth_secrets: {
        Row: {
          access_token: string
          expires_at: string
          id: string
          refresh_token: string | null
          scope: string | null
          singleton: boolean
          token_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_token: string
          expires_at: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          singleton?: boolean
          token_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_token?: string
          expires_at?: string
          id?: string
          refresh_token?: string | null
          scope?: string | null
          singleton?: boolean
          token_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      intake_records: {
        Row: {
          capture_status: string
          categorization_confidence: number | null
          converted_work_order_id: string | null
          created_at: string
          created_by: string | null
          duplicate_candidates_json: Json
          duplicate_confidence: number | null
          duplicate_rationale_json: Json
          duplicate_resolved_at: string | null
          duplicate_resolved_by: string | null
          duplicate_review_status: string
          duplicate_scanned_at: string | null
          extracted_fields_json: Json
          extracted_sections_json: Json
          extracted_text: string | null
          extraction_confidence_by_field: Json
          id: string
          missing_fields_json: Json
          normalization_applied_at: string | null
          normalization_applied_by: string | null
          normalization_version: string | null
          normalization_warnings_json: Json
          normalized_fields_json: Json
          ocr_used: boolean
          original_byte_size: number | null
          original_filename: string | null
          original_mime_type: string | null
          parse_confidence: number | null
          parse_error: string | null
          parse_method: string | null
          parse_status: Database["public"]["Enums"]["intake_state"]
          parser_version: string | null
          parsing_completed_at: string | null
          parsing_issues_json: Json
          parsing_queued_at: string | null
          parsing_started_at: string | null
          raw_payload_json: Json
          raw_text: string | null
          received_at: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_bucket: string | null
          source_file_path: string | null
          source_reference: string | null
          source_sender: string | null
          source_subject: string | null
          source_type: Database["public"]["Enums"]["intake_source_type"]
          suggested_categorization_json: Json
          suggested_work_order_id: string | null
          updated_at: string
        }
        Insert: {
          capture_status?: string
          categorization_confidence?: number | null
          converted_work_order_id?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_candidates_json?: Json
          duplicate_confidence?: number | null
          duplicate_rationale_json?: Json
          duplicate_resolved_at?: string | null
          duplicate_resolved_by?: string | null
          duplicate_review_status?: string
          duplicate_scanned_at?: string | null
          extracted_fields_json?: Json
          extracted_sections_json?: Json
          extracted_text?: string | null
          extraction_confidence_by_field?: Json
          id?: string
          missing_fields_json?: Json
          normalization_applied_at?: string | null
          normalization_applied_by?: string | null
          normalization_version?: string | null
          normalization_warnings_json?: Json
          normalized_fields_json?: Json
          ocr_used?: boolean
          original_byte_size?: number | null
          original_filename?: string | null
          original_mime_type?: string | null
          parse_confidence?: number | null
          parse_error?: string | null
          parse_method?: string | null
          parse_status?: Database["public"]["Enums"]["intake_state"]
          parser_version?: string | null
          parsing_completed_at?: string | null
          parsing_issues_json?: Json
          parsing_queued_at?: string | null
          parsing_started_at?: string | null
          raw_payload_json?: Json
          raw_text?: string | null
          received_at?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_bucket?: string | null
          source_file_path?: string | null
          source_reference?: string | null
          source_sender?: string | null
          source_subject?: string | null
          source_type?: Database["public"]["Enums"]["intake_source_type"]
          suggested_categorization_json?: Json
          suggested_work_order_id?: string | null
          updated_at?: string
        }
        Update: {
          capture_status?: string
          categorization_confidence?: number | null
          converted_work_order_id?: string | null
          created_at?: string
          created_by?: string | null
          duplicate_candidates_json?: Json
          duplicate_confidence?: number | null
          duplicate_rationale_json?: Json
          duplicate_resolved_at?: string | null
          duplicate_resolved_by?: string | null
          duplicate_review_status?: string
          duplicate_scanned_at?: string | null
          extracted_fields_json?: Json
          extracted_sections_json?: Json
          extracted_text?: string | null
          extraction_confidence_by_field?: Json
          id?: string
          missing_fields_json?: Json
          normalization_applied_at?: string | null
          normalization_applied_by?: string | null
          normalization_version?: string | null
          normalization_warnings_json?: Json
          normalized_fields_json?: Json
          ocr_used?: boolean
          original_byte_size?: number | null
          original_filename?: string | null
          original_mime_type?: string | null
          parse_confidence?: number | null
          parse_error?: string | null
          parse_method?: string | null
          parse_status?: Database["public"]["Enums"]["intake_state"]
          parser_version?: string | null
          parsing_completed_at?: string | null
          parsing_issues_json?: Json
          parsing_queued_at?: string | null
          parsing_started_at?: string | null
          raw_payload_json?: Json
          raw_text?: string | null
          received_at?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_bucket?: string | null
          source_file_path?: string | null
          source_reference?: string | null
          source_sender?: string | null
          source_subject?: string | null
          source_type?: Database["public"]["Enums"]["intake_source_type"]
          suggested_categorization_json?: Json
          suggested_work_order_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          in_app_enabled: boolean
          muted_types: Database["public"]["Enums"]["notification_type"][]
          profile_id: string
          telegram_enabled: boolean
          updated_at: string
        }
        Insert: {
          in_app_enabled?: boolean
          muted_types?: Database["public"]["Enums"]["notification_type"][]
          profile_id: string
          telegram_enabled?: boolean
          updated_at?: string
        }
        Update: {
          in_app_enabled?: boolean
          muted_types?: Database["public"]["Enums"]["notification_type"][]
          profile_id?: string
          telegram_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedup_key: string | null
          dismissed_at: string | null
          id: string
          link_path: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          payload_json: Json
          read_at: string | null
          recipient_profile_id: string
          severity: Database["public"]["Enums"]["notification_severity"]
          target_record_id: string | null
          target_record_type: string | null
          telegram_delivery_status: Database["public"]["Enums"]["notification_delivery_status"]
          telegram_error: string | null
          telegram_sent_at: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedup_key?: string | null
          dismissed_at?: string | null
          id?: string
          link_path?: string | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          payload_json?: Json
          read_at?: string | null
          recipient_profile_id: string
          severity?: Database["public"]["Enums"]["notification_severity"]
          target_record_id?: string | null
          target_record_type?: string | null
          telegram_delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          telegram_error?: string | null
          telegram_sent_at?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedup_key?: string | null
          dismissed_at?: string | null
          id?: string
          link_path?: string | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          payload_json?: Json
          read_at?: string | null
          recipient_profile_id?: string
          severity?: Database["public"]["Enums"]["notification_severity"]
          target_record_id?: string | null
          target_record_type?: string | null
          telegram_delivery_status?: Database["public"]["Enums"]["notification_delivery_status"]
          telegram_error?: string | null
          telegram_sent_at?: string | null
          title?: string
        }
        Relationships: []
      }
      parsing_review_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          intake_record_id: string
          next_values_json: Json
          note: string | null
          previous_values_json: Json
          reviewer_profile_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          intake_record_id: string
          next_values_json?: Json
          note?: string | null
          previous_values_json?: Json
          reviewer_profile_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          intake_record_id?: string
          next_values_json?: Json
          note?: string | null
          previous_values_json?: Json
          reviewer_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parsing_review_actions_intake_record_id_fkey"
            columns: ["intake_record_id"]
            isOneToOne: false
            referencedRelation: "intake_records"
            referencedColumns: ["id"]
          },
        ]
      }
      parsing_reviews: {
        Row: {
          confidence_snapshot_json: Json
          created_at: string
          id: string
          issue_summary: string | null
          issue_type: string
          missing_fields_json: Json
          resolved_at: string | null
          resolved_by: string | null
          review_status: string
          work_order_id: string
        }
        Insert: {
          confidence_snapshot_json?: Json
          created_at?: string
          id?: string
          issue_summary?: string | null
          issue_type: string
          missing_fields_json?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          review_status?: string
          work_order_id: string
        }
        Update: {
          confidence_snapshot_json?: Json
          created_at?: string
          id?: string
          issue_summary?: string | null
          issue_type?: string
          missing_fields_json?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          review_status?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parsing_reviews_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parsing_reviews_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          password_reset_requested_at: string | null
          password_reset_requested_by: string | null
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          temp_password_set_at: string | null
          temp_password_set_by: string | null
          updated_at: string
          work_email: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          password_reset_requested_at?: string | null
          password_reset_requested_by?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          temp_password_set_at?: string | null
          temp_password_set_by?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          password_reset_requested_at?: string | null
          password_reset_requested_by?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          temp_password_set_at?: string | null
          temp_password_set_by?: string | null
          updated_at?: string
          work_email?: string | null
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          confidence_score: number | null
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          generated_at: string
          id: string
          rationale_json: Json
          recommendation_payload_json: Json
          recommendation_type: Database["public"]["Enums"]["recommendation_type"]
          target_record_id: string
          target_record_type: Database["public"]["Enums"]["recommendation_target_type"]
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          confidence_score?: number | null
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          generated_at?: string
          id?: string
          rationale_json?: Json
          recommendation_payload_json?: Json
          recommendation_type: Database["public"]["Enums"]["recommendation_type"]
          target_record_id: string
          target_record_type: Database["public"]["Enums"]["recommendation_target_type"]
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          confidence_score?: number | null
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          generated_at?: string
          id?: string
          rationale_json?: Json
          recommendation_payload_json?: Json
          recommendation_type?: Database["public"]["Enums"]["recommendation_type"]
          target_record_id?: string
          target_record_type?: Database["public"]["Enums"]["recommendation_target_type"]
          updated_at?: string
        }
        Relationships: []
      }
      sheet_sync_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          payload_snapshot_json: Json
          sheet_name: string | null
          sheet_row_key: string | null
          sync_direction: string
          sync_status: string
          synced_at: string | null
          triggered_by: string | null
          work_order_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload_snapshot_json?: Json
          sheet_name?: string | null
          sheet_row_key?: string | null
          sync_direction: string
          sync_status: string
          synced_at?: string | null
          triggered_by?: string | null
          work_order_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          payload_snapshot_json?: Json
          sheet_name?: string | null
          sheet_row_key?: string | null
          sync_direction?: string
          sync_status?: string
          synced_at?: string | null
          triggered_by?: string | null
          work_order_id?: string | null
        }
        Relationships: []
      }
      telegram_notification_log: {
        Row: {
          created_at: string
          delivery_status: string
          error_message: string | null
          id: string
          message_id: string | null
          notification_type: string
          profile_id: string | null
          sent_at: string | null
          thread_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_status: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          notification_type: string
          profile_id?: string | null
          sent_at?: string | null
          thread_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          notification_type?: string
          profile_id?: string | null
          sent_at?: string | null
          thread_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notification_log_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_notification_log_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_notification_log_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "direct_message_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_contact_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          capability_summary: string | null
          created_at: string
          job_title: string | null
          last_seen_at: string | null
          profile_id: string
          telegram_chat_id: string | null
          telegram_linked_at: string | null
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          capability_summary?: string | null
          created_at?: string
          job_title?: string | null
          last_seen_at?: string | null
          profile_id: string
          telegram_chat_id?: string | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          capability_summary?: string | null
          created_at?: string
          job_title?: string | null
          last_seen_at?: string | null
          profile_id?: string
          telegram_chat_id?: string | null
          telegram_linked_at?: string | null
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_contact_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_order_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          assignment_role: Database["public"]["Enums"]["assignment_role"]
          assignment_status: Database["public"]["Enums"]["assignment_status"]
          engineer_id: string
          id: string
          rejection_reason: string | null
          updated_at: string
          work_order_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          assignment_status?: Database["public"]["Enums"]["assignment_status"]
          engineer_id: string
          id?: string
          rejection_reason?: string | null
          updated_at?: string
          work_order_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          assignment_role?: Database["public"]["Enums"]["assignment_role"]
          assignment_status?: Database["public"]["Enums"]["assignment_status"]
          engineer_id?: string
          id?: string
          rejection_reason?: string | null
          updated_at?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_assignments_engineer_id_fkey"
            columns: ["engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_assignments_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_events: {
        Row: {
          actor_engineer_id: string | null
          actor_profile_id: string | null
          created_at: string
          event_label: string | null
          event_payload_json: Json
          event_type: string
          id: string
          work_order_id: string
        }
        Insert: {
          actor_engineer_id?: string | null
          actor_profile_id?: string | null
          created_at?: string
          event_label?: string | null
          event_payload_json?: Json
          event_type: string
          id?: string
          work_order_id: string
        }
        Update: {
          actor_engineer_id?: string | null
          actor_profile_id?: string | null
          created_at?: string
          event_label?: string | null
          event_payload_json?: Json
          event_type?: string
          id?: string
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_events_actor_engineer_id_fkey"
            columns: ["actor_engineer_id"]
            isOneToOne: false
            referencedRelation: "engineers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_events_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_expenses: {
        Row: {
          amount: number
          created_at: string
          entered_by_engineer_id: string | null
          entered_by_profile_id: string | null
          expense_date: string | null
          expense_time: string | null
          expense_type: Database["public"]["Enums"]["expense_type"]
          extracted_items_json: Json
          extracted_text: string | null
          extraction_confidence: number | null
          extraction_status: string
          id: string
          note: string | null
          paid_at: string | null
          paid_by: string | null
          paid_note: string | null
          payment_method: string | null
          payment_reference: string | null
          payment_status: string
          receipt_file_id: string | null
          receipt_number: string | null
          updated_at: string
          updated_by_engineer_id: string | null
          updated_by_profile_id: string | null
          vendor: string | null
          work_order_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          entered_by_engineer_id?: string | null
          entered_by_profile_id?: string | null
          expense_date?: string | null
          expense_time?: string | null
          expense_type?: Database["public"]["Enums"]["expense_type"]
          extracted_items_json?: Json
          extracted_text?: string | null
          extraction_confidence?: number | null
          extraction_status?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          paid_by?: string | null
          paid_note?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          receipt_file_id?: string | null
          receipt_number?: string | null
          updated_at?: string
          updated_by_engineer_id?: string | null
          updated_by_profile_id?: string | null
          vendor?: string | null
          work_order_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          entered_by_engineer_id?: string | null
          entered_by_profile_id?: string | null
          expense_date?: string | null
          expense_time?: string | null
          expense_type?: Database["public"]["Enums"]["expense_type"]
          extracted_items_json?: Json
          extracted_text?: string | null
          extraction_confidence?: number | null
          extraction_status?: string
          id?: string
          note?: string | null
          paid_at?: string | null
          paid_by?: string | null
          paid_note?: string | null
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string
          receipt_file_id?: string | null
          receipt_number?: string | null
          updated_at?: string
          updated_by_engineer_id?: string | null
          updated_by_profile_id?: string | null
          vendor?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_expenses_receipt_file_id_fkey"
            columns: ["receipt_file_id"]
            isOneToOne: false
            referencedRelation: "work_order_files"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_external_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          external_contact_id: string
          id: string
          is_primary: boolean
          relationship_label: string | null
          work_order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          external_contact_id: string
          id?: string
          is_primary?: boolean
          relationship_label?: string | null
          work_order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          external_contact_id?: string
          id?: string
          is_primary?: boolean
          relationship_label?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_external_contacts_external_contact_id_fkey"
            columns: ["external_contact_id"]
            isOneToOne: false
            referencedRelation: "external_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_order_external_contacts_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_order_files: {
        Row: {
          byte_size: number | null
          captured_by_engineer_id: string | null
          captured_by_profile_id: string | null
          created_at: string
          file_kind: Database["public"]["Enums"]["file_kind"]
          id: string
          metadata_json: Json
          mime_type: string | null
          storage_bucket: string
          storage_path: string
          sync_status: Database["public"]["Enums"]["file_sync_status"]
          uploaded_at: string
          uploaded_offline: boolean
          work_order_id: string
        }
        Insert: {
          byte_size?: number | null
          captured_by_engineer_id?: string | null
          captured_by_profile_id?: string | null
          created_at?: string
          file_kind: Database["public"]["Enums"]["file_kind"]
          id?: string
          metadata_json?: Json
          mime_type?: string | null
          storage_bucket: string
          storage_path: string
          sync_status?: Database["public"]["Enums"]["file_sync_status"]
          uploaded_at?: string
          uploaded_offline?: boolean
          work_order_id: string
        }
        Update: {
          byte_size?: number | null
          captured_by_engineer_id?: string | null
          captured_by_profile_id?: string | null
          created_at?: string
          file_kind?: Database["public"]["Enums"]["file_kind"]
          id?: string
          metadata_json?: Json
          mime_type?: string | null
          storage_bucket?: string
          storage_path?: string
          sync_status?: Database["public"]["Enums"]["file_sync_status"]
          uploaded_at?: string
          uploaded_offline?: boolean
          work_order_id?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          active_editor_engineer_id: string | null
          address_line_1: string | null
          address_line_2: string | null
          admin_notes: string | null
          categorization_confidence: number | null
          certification_tags: string[]
          city: string | null
          client_id: string | null
          complexity_level:
            | Database["public"]["Enums"]["complexity_level"]
            | null
          created_at: string
          created_by: string | null
          current_outcome_reason:
            | Database["public"]["Enums"]["incomplete_reason"]
            | null
          current_status: Database["public"]["Enums"]["work_order_status"]
          diary_date: string | null
          diary_slot_label: string | null
          diary_slot_status:
            | Database["public"]["Enums"]["diary_slot_status"]
            | null
          duplicate_flag: boolean
          engineers_required: number
          estimated_duration_minutes: number | null
          estimated_value_amount: number | null
          expenses_ack_required: boolean
          expenses_pushed_at: string | null
          expenses_pushed_by: string | null
          field_lock_active: boolean
          field_lock_started_at: string | null
          geocode_confidence: number | null
          geocoded_at: string | null
          id: string
          job_description: string | null
          job_summary: string | null
          last_synced_at: string | null
          latitude: number | null
          longitude: number | null
          order_no: string
          parsing_confidence: number | null
          pending_sync_flag: boolean
          planner_conflict_flag: boolean
          planner_conflict_message: string | null
          planner_last_pulled_at: string | null
          planner_last_pulled_hash: string | null
          planner_last_pushed_at: string | null
          planner_last_pushed_hash: string | null
          planner_row_key: string | null
          planner_sheet_name: string | null
          postcode: string | null
          postcode_zone: string | null
          primary_trade: string | null
          priority_level: Database["public"]["Enums"]["priority_level"]
          rescheduled_at: string | null
          rescheduled_by: string | null
          review_outcome: Database["public"]["Enums"]["review_outcome"] | null
          schedule_notes: string | null
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          source_channel: Database["public"]["Enums"]["source_channel"]
          tools_materials_hint: string | null
          trade_tags: string[]
          updated_at: string
        }
        Insert: {
          active_editor_engineer_id?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          admin_notes?: string | null
          categorization_confidence?: number | null
          certification_tags?: string[]
          city?: string | null
          client_id?: string | null
          complexity_level?:
            | Database["public"]["Enums"]["complexity_level"]
            | null
          created_at?: string
          created_by?: string | null
          current_outcome_reason?:
            | Database["public"]["Enums"]["incomplete_reason"]
            | null
          current_status?: Database["public"]["Enums"]["work_order_status"]
          diary_date?: string | null
          diary_slot_label?: string | null
          diary_slot_status?:
            | Database["public"]["Enums"]["diary_slot_status"]
            | null
          duplicate_flag?: boolean
          engineers_required?: number
          estimated_duration_minutes?: number | null
          estimated_value_amount?: number | null
          expenses_ack_required?: boolean
          expenses_pushed_at?: string | null
          expenses_pushed_by?: string | null
          field_lock_active?: boolean
          field_lock_started_at?: string | null
          geocode_confidence?: number | null
          geocoded_at?: string | null
          id?: string
          job_description?: string | null
          job_summary?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          longitude?: number | null
          order_no: string
          parsing_confidence?: number | null
          pending_sync_flag?: boolean
          planner_conflict_flag?: boolean
          planner_conflict_message?: string | null
          planner_last_pulled_at?: string | null
          planner_last_pulled_hash?: string | null
          planner_last_pushed_at?: string | null
          planner_last_pushed_hash?: string | null
          planner_row_key?: string | null
          planner_sheet_name?: string | null
          postcode?: string | null
          postcode_zone?: string | null
          primary_trade?: string | null
          priority_level?: Database["public"]["Enums"]["priority_level"]
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          review_outcome?: Database["public"]["Enums"]["review_outcome"] | null
          schedule_notes?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          source_channel?: Database["public"]["Enums"]["source_channel"]
          tools_materials_hint?: string | null
          trade_tags?: string[]
          updated_at?: string
        }
        Update: {
          active_editor_engineer_id?: string | null
          address_line_1?: string | null
          address_line_2?: string | null
          admin_notes?: string | null
          categorization_confidence?: number | null
          certification_tags?: string[]
          city?: string | null
          client_id?: string | null
          complexity_level?:
            | Database["public"]["Enums"]["complexity_level"]
            | null
          created_at?: string
          created_by?: string | null
          current_outcome_reason?:
            | Database["public"]["Enums"]["incomplete_reason"]
            | null
          current_status?: Database["public"]["Enums"]["work_order_status"]
          diary_date?: string | null
          diary_slot_label?: string | null
          diary_slot_status?:
            | Database["public"]["Enums"]["diary_slot_status"]
            | null
          duplicate_flag?: boolean
          engineers_required?: number
          estimated_duration_minutes?: number | null
          estimated_value_amount?: number | null
          expenses_ack_required?: boolean
          expenses_pushed_at?: string | null
          expenses_pushed_by?: string | null
          field_lock_active?: boolean
          field_lock_started_at?: string | null
          geocode_confidence?: number | null
          geocoded_at?: string | null
          id?: string
          job_description?: string | null
          job_summary?: string | null
          last_synced_at?: string | null
          latitude?: number | null
          longitude?: number | null
          order_no?: string
          parsing_confidence?: number | null
          pending_sync_flag?: boolean
          planner_conflict_flag?: boolean
          planner_conflict_message?: string | null
          planner_last_pulled_at?: string | null
          planner_last_pulled_hash?: string | null
          planner_last_pushed_at?: string | null
          planner_last_pushed_hash?: string | null
          planner_row_key?: string | null
          planner_sheet_name?: string | null
          postcode?: string | null
          postcode_zone?: string | null
          primary_trade?: string | null
          priority_level?: Database["public"]["Enums"]["priority_level"]
          rescheduled_at?: string | null
          rescheduled_by?: string | null
          review_outcome?: Database["public"]["Enums"]["review_outcome"] | null
          schedule_notes?: string | null
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          source_channel?: Database["public"]["Enums"]["source_channel"]
          tools_materials_hint?: string | null
          trade_tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_first_boss: { Args: never; Returns: boolean }
      create_notification: {
        Args: {
          _body: string
          _dedup?: string
          _link: string
          _payload?: Json
          _recipient: string
          _severity: Database["public"]["Enums"]["notification_severity"]
          _target_id: string
          _target_type: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: string
      }
      current_engineer_id: { Args: never; Returns: string }
      engineer_is_assigned: { Args: { _wo: string }; Returns: boolean }
      engineer_is_lead: { Args: { _wo: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_boss: { Args: { _user_id: string }; Returns: boolean }
      is_thread_participant: { Args: { _thread: string }; Returns: boolean }
      notify_assigned_engineers: {
        Args: {
          _body: string
          _dedup_prefix?: string
          _link: string
          _payload?: Json
          _severity: Database["public"]["Enums"]["notification_severity"]
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _wo: string
        }
        Returns: undefined
      }
      notify_dispatchers: {
        Args: {
          _body: string
          _dedup?: string
          _link: string
          _payload?: Json
          _severity: Database["public"]["Enums"]["notification_severity"]
          _target_id: string
          _target_type: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
        }
        Returns: undefined
      }
      seed_demo_data: { Args: never; Returns: undefined }
      wo_id_from_path: { Args: { _name: string }; Returns: string }
    }
    Enums: {
      app_role: "dispatcher" | "engineer" | "boss"
      assignment_role: "lead" | "support"
      assignment_status: "assigned" | "accepted" | "rejected" | "removed"
      billing_status:
        | "pending_review"
        | "ready_to_invoice"
        | "invoiced"
        | "on_hold"
        | "rejected"
      client_type: "council" | "agency" | "landlord" | "private"
      communication_direction: "outbound" | "inbound"
      communication_type:
        | "call"
        | "email"
        | "note"
        | "visit"
        | "message"
        | "voicemail"
      complexity_level: "basic" | "intermediate" | "advanced"
      diary_slot_status: "planned" | "confirmed" | "tentative" | "cancelled"
      dm_message_type: "text" | "image" | "file" | "voice_note" | "system"
      expense_type:
        | "parts"
        | "materials"
        | "parking"
        | "congestion"
        | "fuel"
        | "tools"
        | "other"
      external_contact_type:
        | "tenant"
        | "landlord"
        | "agency"
        | "council"
        | "contractor"
        | "other"
      file_kind:
        | "source_pdf"
        | "arrival_photo"
        | "before_leave_photo"
        | "completion_signature"
        | "receipt_photo"
        | "general_evidence"
      file_sync_status: "pending" | "syncing" | "synced" | "failed"
      follow_up_status:
        | "not_required"
        | "information_given"
        | "awaiting_response"
        | "follow_up_booked"
        | "unresolved"
        | "resolved"
      gmail_classification:
        | "unclassified"
        | "work_order_candidate"
        | "not_work_order"
        | "imported"
        | "ignored"
      gmail_triage_state: "pending" | "reviewed" | "replied" | "ignored"
      incomplete_reason:
        | "insufficient_time"
        | "insufficient_materials"
        | "unable_to_access"
        | "no_answer"
        | "tenant_refused"
        | "unsafe_conditions"
        | "additional_work_found"
        | "specialist_required"
        | "follow_up_required"
        | "other"
      intake_source_type: "email" | "webhook" | "upload" | "manual"
      intake_state:
        | "received"
        | "parsing"
        | "parsed"
        | "needs_review"
        | "duplicate_suspected"
        | "approved"
        | "rejected"
        | "converted"
      notification_delivery_status: "pending" | "sent" | "failed" | "skipped"
      notification_severity: "info" | "warn" | "critical"
      notification_type:
        | "intake_review_required"
        | "duplicate_suspected"
        | "work_order_assigned"
        | "work_order_reassigned"
        | "diary_changed"
        | "engineer_rejected"
        | "job_completed"
        | "job_incomplete"
        | "sync_failed"
        | "sync_recovered"
        | "planner_conflict"
        | "overdue_follow_up"
        | "billing_ready"
        | "billing_on_hold"
      priority_level: "low" | "normal" | "high" | "urgent"
      recommendation_target_type:
        | "intake_record"
        | "work_order"
        | "billing_case"
      recommendation_type:
        | "intake_categorization"
        | "intake_diary_ready"
        | "intake_duplicate"
        | "assignment_engineer"
        | "scheduling_slot"
        | "scheduling_duration"
        | "scheduling_coassign"
        | "billing_invoice_ready"
        | "billing_missing_evidence"
        | "billing_followup_needed"
      review_outcome:
        | "closed"
        | "follow_up_required"
        | "further_quote_needed"
        | "client_update_required"
        | "duplicate_confirmed"
        | "cancelled"
      source_channel: "email" | "pdf_upload" | "manual_entry" | "webhook"
      work_order_status:
        | "ingested"
        | "parsing_in_progress"
        | "admin_attention"
        | "parsed_ready"
        | "categorized"
        | "ready_for_dispatch"
        | "scheduled_in_sheet"
        | "assigned"
        | "accepted"
        | "en_route"
        | "on_site"
        | "field_in_progress"
        | "field_submitted_complete"
        | "field_submitted_incomplete"
        | "dispatcher_review"
        | "follow_up_required"
        | "closed"
        | "cancelled"
        | "duplicate_flagged"
        | "ignored"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["dispatcher", "engineer", "boss"],
      assignment_role: ["lead", "support"],
      assignment_status: ["assigned", "accepted", "rejected", "removed"],
      billing_status: [
        "pending_review",
        "ready_to_invoice",
        "invoiced",
        "on_hold",
        "rejected",
      ],
      client_type: ["council", "agency", "landlord", "private"],
      communication_direction: ["outbound", "inbound"],
      communication_type: [
        "call",
        "email",
        "note",
        "visit",
        "message",
        "voicemail",
      ],
      complexity_level: ["basic", "intermediate", "advanced"],
      diary_slot_status: ["planned", "confirmed", "tentative", "cancelled"],
      dm_message_type: ["text", "image", "file", "voice_note", "system"],
      expense_type: [
        "parts",
        "materials",
        "parking",
        "congestion",
        "fuel",
        "tools",
        "other",
      ],
      external_contact_type: [
        "tenant",
        "landlord",
        "agency",
        "council",
        "contractor",
        "other",
      ],
      file_kind: [
        "source_pdf",
        "arrival_photo",
        "before_leave_photo",
        "completion_signature",
        "receipt_photo",
        "general_evidence",
      ],
      file_sync_status: ["pending", "syncing", "synced", "failed"],
      follow_up_status: [
        "not_required",
        "information_given",
        "awaiting_response",
        "follow_up_booked",
        "unresolved",
        "resolved",
      ],
      gmail_classification: [
        "unclassified",
        "work_order_candidate",
        "not_work_order",
        "imported",
        "ignored",
      ],
      gmail_triage_state: ["pending", "reviewed", "replied", "ignored"],
      incomplete_reason: [
        "insufficient_time",
        "insufficient_materials",
        "unable_to_access",
        "no_answer",
        "tenant_refused",
        "unsafe_conditions",
        "additional_work_found",
        "specialist_required",
        "follow_up_required",
        "other",
      ],
      intake_source_type: ["email", "webhook", "upload", "manual"],
      intake_state: [
        "received",
        "parsing",
        "parsed",
        "needs_review",
        "duplicate_suspected",
        "approved",
        "rejected",
        "converted",
      ],
      notification_delivery_status: ["pending", "sent", "failed", "skipped"],
      notification_severity: ["info", "warn", "critical"],
      notification_type: [
        "intake_review_required",
        "duplicate_suspected",
        "work_order_assigned",
        "work_order_reassigned",
        "diary_changed",
        "engineer_rejected",
        "job_completed",
        "job_incomplete",
        "sync_failed",
        "sync_recovered",
        "planner_conflict",
        "overdue_follow_up",
        "billing_ready",
        "billing_on_hold",
      ],
      priority_level: ["low", "normal", "high", "urgent"],
      recommendation_target_type: [
        "intake_record",
        "work_order",
        "billing_case",
      ],
      recommendation_type: [
        "intake_categorization",
        "intake_diary_ready",
        "intake_duplicate",
        "assignment_engineer",
        "scheduling_slot",
        "scheduling_duration",
        "scheduling_coassign",
        "billing_invoice_ready",
        "billing_missing_evidence",
        "billing_followup_needed",
      ],
      review_outcome: [
        "closed",
        "follow_up_required",
        "further_quote_needed",
        "client_update_required",
        "duplicate_confirmed",
        "cancelled",
      ],
      source_channel: ["email", "pdf_upload", "manual_entry", "webhook"],
      work_order_status: [
        "ingested",
        "parsing_in_progress",
        "admin_attention",
        "parsed_ready",
        "categorized",
        "ready_for_dispatch",
        "scheduled_in_sheet",
        "assigned",
        "accepted",
        "en_route",
        "on_site",
        "field_in_progress",
        "field_submitted_complete",
        "field_submitted_incomplete",
        "dispatcher_review",
        "follow_up_required",
        "closed",
        "cancelled",
        "duplicate_flagged",
        "ignored",
      ],
    },
  },
} as const
