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
      appointments: {
        Row: {
          cancel_reason: string | null
          canceled_at: string | null
          canceled_by: string | null
          created_at: string
          customer_id: string | null
          customer_name_snapshot: string | null
          end_at: string
          id: string
          notes: string | null
          price_cents_snapshot: number | null
          professional_id: string
          reminder_24h_sent_at: string | null
          reminder_2h_sent_at: string | null
          service_id: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          end_at: string
          id?: string
          notes?: string | null
          price_cents_snapshot?: number | null
          professional_id: string
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          service_id: string
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          cancel_reason?: string | null
          canceled_at?: string | null
          canceled_by?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name_snapshot?: string | null
          end_at?: string
          id?: string
          notes?: string | null
          price_cents_snapshot?: number | null
          professional_id?: string
          reminder_24h_sent_at?: string | null
          reminder_2h_sent_at?: string | null
          service_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          created_at: string
          end_at: string
          id: string
          professional_id: string | null
          reason: string | null
          start_at: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_at: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          professional_id?: string | null
          reason?: string | null
          start_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      business_hours: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_open: boolean
          start_time: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_open?: boolean
          start_time: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_open?: boolean
          start_time?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          birth_date: string | null
          consent_given_at: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string | null
          notes: string | null
          phone: string | null
          pwa_install_dismissed_at: string | null
          pwa_installed_at: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          birth_date?: string | null
          consent_given_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          pwa_install_dismissed_at?: string | null
          pwa_installed_at?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          birth_date?: string | null
          consent_given_at?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string | null
          notes?: string | null
          phone?: string | null
          pwa_install_dismissed_at?: string | null
          pwa_installed_at?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          appointment_id: string | null
          channel: string
          created_at: string
          error_message: string | null
          event: string
          id: string
          recipient: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          channel: string
          created_at?: string
          error_message?: string | null
          event: string
          id?: string
          recipient?: string | null
          status: string
          tenant_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          event?: string
          id?: string
          recipient?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          monthly_price_cents: number
          name: string
          transaction_fee_fixed_cents: number | null
          transaction_fee_type: Database["public"]["Enums"]["transaction_fee_type"]
          transaction_fee_value: number
          trial_days_default: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          monthly_price_cents: number
          name: string
          transaction_fee_fixed_cents?: number | null
          transaction_fee_type?: Database["public"]["Enums"]["transaction_fee_type"]
          transaction_fee_value?: number
          trial_days_default?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          monthly_price_cents?: number
          name?: string
          transaction_fee_fixed_cents?: number | null
          transaction_fee_type?: Database["public"]["Enums"]["transaction_fee_type"]
          transaction_fee_value?: number
          trial_days_default?: number
          updated_at?: string
        }
        Relationships: []
      }
      professional_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_available: boolean
          professional_id: string
          start_time: string
          tenant_id: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_available?: boolean
          professional_id: string
          start_time: string
          tenant_id: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_available?: boolean
          professional_id?: string
          start_time?: string
          tenant_id?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_availability_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_services: {
        Row: {
          created_at: string
          id: string
          professional_id: string
          service_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          professional_id: string
          service_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          professional_id?: string
          service_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_services_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "professionals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "professional_services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      professionals: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          photo_url: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          photo_url?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          photo_url?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professionals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          p256dh_key: string
          tenant_id: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          p256dh_key: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          p256dh_key?: string
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          deposit_percentage: number | null
          deposit_required: boolean
          deposit_type: Database["public"]["Enums"]["deposit_type"] | null
          deposit_value_cents: number | null
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price_cents: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deposit_percentage?: number | null
          deposit_required?: boolean
          deposit_type?: Database["public"]["Enums"]["deposit_type"] | null
          deposit_value_cents?: number | null
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price_cents: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deposit_percentage?: number | null
          deposit_required?: boolean
          deposit_type?: Database["public"]["Enums"]["deposit_type"] | null
          deposit_value_cents?: number | null
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          enabled: boolean
          event: string
          id: string
          subject: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body: string
          channel: string
          created_at?: string
          enabled?: boolean
          event: string
          id?: string
          subject?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          enabled?: boolean
          event?: string
          id?: string
          subject?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accent_color: string | null
          address_line1: string | null
          address_line2: string | null
          billing_model: Database["public"]["Enums"]["billing_model"]
          billing_status: Database["public"]["Enums"]["billing_status"]
          cancellation_window_hours: number
          city: string | null
          contact_phone: string | null
          created_at: string
          current_plan_id: string | null
          custom_domain: string | null
          customer_can_cancel: boolean
          email: string | null
          favicon_url: string | null
          grace_period_ends_at: string | null
          home_headline_accent: string | null
          home_headline_top: string | null
          id: string
          is_custom_trial: boolean
          logo_url: string | null
          min_advance_hours: number
          monthly_price_cents: number
          name: string
          notes_internal: string | null
          operation_mode_pin_hash: string | null
          postal_code: string | null
          primary_color: string | null
          secondary_color: string | null
          slot_interval_minutes: number
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          subdomain: string
          subscription_ends_at: string | null
          subscription_starts_at: string | null
          timezone: string
          transaction_fee_fixed_cents: number | null
          transaction_fee_type: Database["public"]["Enums"]["transaction_fee_type"]
          transaction_fee_value: number
          trial_days_granted: number | null
          trial_ends_at: string | null
          trial_starts_at: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          accent_color?: string | null
          address_line1?: string | null
          address_line2?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"]
          billing_status?: Database["public"]["Enums"]["billing_status"]
          cancellation_window_hours?: number
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          current_plan_id?: string | null
          custom_domain?: string | null
          customer_can_cancel?: boolean
          email?: string | null
          favicon_url?: string | null
          grace_period_ends_at?: string | null
          home_headline_accent?: string | null
          home_headline_top?: string | null
          id?: string
          is_custom_trial?: boolean
          logo_url?: string | null
          min_advance_hours?: number
          monthly_price_cents?: number
          name: string
          notes_internal?: string | null
          operation_mode_pin_hash?: string | null
          postal_code?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slot_interval_minutes?: number
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain: string
          subscription_ends_at?: string | null
          subscription_starts_at?: string | null
          timezone?: string
          transaction_fee_fixed_cents?: number | null
          transaction_fee_type?: Database["public"]["Enums"]["transaction_fee_type"]
          transaction_fee_value?: number
          trial_days_granted?: number | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          accent_color?: string | null
          address_line1?: string | null
          address_line2?: string | null
          billing_model?: Database["public"]["Enums"]["billing_model"]
          billing_status?: Database["public"]["Enums"]["billing_status"]
          cancellation_window_hours?: number
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          current_plan_id?: string | null
          custom_domain?: string | null
          customer_can_cancel?: boolean
          email?: string | null
          favicon_url?: string | null
          grace_period_ends_at?: string | null
          home_headline_accent?: string | null
          home_headline_top?: string | null
          id?: string
          is_custom_trial?: boolean
          logo_url?: string | null
          min_advance_hours?: number
          monthly_price_cents?: number
          name?: string
          notes_internal?: string | null
          operation_mode_pin_hash?: string | null
          postal_code?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slot_interval_minutes?: number
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain?: string
          subscription_ends_at?: string | null
          subscription_starts_at?: string | null
          timezone?: string
          transaction_fee_fixed_cents?: number | null
          transaction_fee_type?: Database["public"]["Enums"]["transaction_fee_type"]
          transaction_fee_value?: number
          trial_days_granted?: number | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenants_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_staff: { Args: { target_tenant: string }; Returns: boolean }
      select_reminder_candidates: {
        Args: {
          p_flag_column: string
          p_lower_interval: string
          p_upper_interval: string
        }
        Returns: {
          customer_user_id: string
          id: string
          service_name: string
          start_at: string
          tenant_id: string
        }[]
      }
      validate_appointment_conflict: {
        Args: {
          p_end_at: string
          p_exclude_id?: string
          p_professional_id: string
          p_start_at: string
          p_tenant_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status:
        | "SCHEDULED"
        | "CONFIRMED"
        | "COMPLETED"
        | "CANCELED"
        | "NO_SHOW"
      billing_model: "TRIAL" | "SUBSCRIPTION_WITH_TRANSACTION_FEE"
      billing_status:
        | "TRIALING"
        | "ACTIVE"
        | "PAST_DUE"
        | "SUSPENDED"
        | "CANCELED"
      deposit_type: "FIXED" | "PERCENTAGE"
      tenant_status: "ACTIVE" | "SUSPENDED" | "ARCHIVED"
      transaction_fee_type: "PERCENTAGE" | "FIXED" | "NONE"
      user_role:
        | "PLATFORM_ADMIN"
        | "BUSINESS_OWNER"
        | "RECEPTIONIST"
        | "PROFESSIONAL"
        | "CUSTOMER"
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
      appointment_status: [
        "SCHEDULED",
        "CONFIRMED",
        "COMPLETED",
        "CANCELED",
        "NO_SHOW",
      ],
      billing_model: ["TRIAL", "SUBSCRIPTION_WITH_TRANSACTION_FEE"],
      billing_status: [
        "TRIALING",
        "ACTIVE",
        "PAST_DUE",
        "SUSPENDED",
        "CANCELED",
      ],
      deposit_type: ["FIXED", "PERCENTAGE"],
      tenant_status: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
      transaction_fee_type: ["PERCENTAGE", "FIXED", "NONE"],
      user_role: [
        "PLATFORM_ADMIN",
        "BUSINESS_OWNER",
        "RECEPTIONIST",
        "PROFESSIONAL",
        "CUSTOMER",
      ],
    },
  },
} as const
