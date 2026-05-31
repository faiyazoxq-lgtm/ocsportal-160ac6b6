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
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
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
      work_orders: {
        Row: {
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
          duplicate_flag: boolean
          engineers_required: number
          estimated_duration_minutes: number | null
          estimated_value_amount: number | null
          field_lock_active: boolean
          id: string
          job_description: string | null
          job_summary: string | null
          latitude: number | null
          longitude: number | null
          order_no: string
          parsing_confidence: number | null
          postcode: string | null
          postcode_zone: string | null
          primary_trade: string | null
          priority_level: Database["public"]["Enums"]["priority_level"]
          review_outcome: Database["public"]["Enums"]["review_outcome"] | null
          source_channel: Database["public"]["Enums"]["source_channel"]
          tools_materials_hint: string | null
          trade_tags: string[]
          updated_at: string
        }
        Insert: {
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
          duplicate_flag?: boolean
          engineers_required?: number
          estimated_duration_minutes?: number | null
          estimated_value_amount?: number | null
          field_lock_active?: boolean
          id?: string
          job_description?: string | null
          job_summary?: string | null
          latitude?: number | null
          longitude?: number | null
          order_no: string
          parsing_confidence?: number | null
          postcode?: string | null
          postcode_zone?: string | null
          primary_trade?: string | null
          priority_level?: Database["public"]["Enums"]["priority_level"]
          review_outcome?: Database["public"]["Enums"]["review_outcome"] | null
          source_channel?: Database["public"]["Enums"]["source_channel"]
          tools_materials_hint?: string | null
          trade_tags?: string[]
          updated_at?: string
        }
        Update: {
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
          duplicate_flag?: boolean
          engineers_required?: number
          estimated_duration_minutes?: number | null
          estimated_value_amount?: number | null
          field_lock_active?: boolean
          id?: string
          job_description?: string | null
          job_summary?: string | null
          latitude?: number | null
          longitude?: number | null
          order_no?: string
          parsing_confidence?: number | null
          postcode?: string | null
          postcode_zone?: string | null
          primary_trade?: string | null
          priority_level?: Database["public"]["Enums"]["priority_level"]
          review_outcome?: Database["public"]["Enums"]["review_outcome"] | null
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
      seed_demo_data: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "dispatcher" | "engineer"
      assignment_role: "lead" | "support"
      assignment_status: "assigned" | "accepted" | "rejected" | "removed"
      client_type: "council" | "agency" | "landlord" | "private"
      complexity_level: "basic" | "intermediate" | "advanced"
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
      priority_level: "low" | "normal" | "high" | "urgent"
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
      app_role: ["dispatcher", "engineer"],
      assignment_role: ["lead", "support"],
      assignment_status: ["assigned", "accepted", "rejected", "removed"],
      client_type: ["council", "agency", "landlord", "private"],
      complexity_level: ["basic", "intermediate", "advanced"],
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
      priority_level: ["low", "normal", "high", "urgent"],
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
