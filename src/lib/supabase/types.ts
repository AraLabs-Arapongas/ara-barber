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
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
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
          transaction_fee_type: Database['public']['Enums']['transaction_fee_type']
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
          transaction_fee_type?: Database['public']['Enums']['transaction_fee_type']
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
          transaction_fee_type?: Database['public']['Enums']['transaction_fee_type']
          transaction_fee_value?: number
          trial_days_default?: number
          updated_at?: string
        }
        Relationships: []
      }
      tenants: {
        Row: {
          accent_color: string | null
          address_line1: string | null
          address_line2: string | null
          billing_model: Database['public']['Enums']['billing_model']
          billing_status: Database['public']['Enums']['billing_status']
          city: string | null
          contact_phone: string | null
          created_at: string
          current_plan_id: string | null
          custom_domain: string | null
          email: string | null
          favicon_url: string | null
          grace_period_ends_at: string | null
          id: string
          is_custom_trial: boolean
          logo_url: string | null
          monthly_price_cents: number
          name: string
          notes_internal: string | null
          operation_mode_pin_hash: string | null
          postal_code: string | null
          primary_color: string | null
          secondary_color: string | null
          slug: string
          state: string | null
          status: Database['public']['Enums']['tenant_status']
          subdomain: string
          subscription_ends_at: string | null
          subscription_starts_at: string | null
          timezone: string
          transaction_fee_fixed_cents: number | null
          transaction_fee_type: Database['public']['Enums']['transaction_fee_type']
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
          billing_model?: Database['public']['Enums']['billing_model']
          billing_status?: Database['public']['Enums']['billing_status']
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          current_plan_id?: string | null
          custom_domain?: string | null
          email?: string | null
          favicon_url?: string | null
          grace_period_ends_at?: string | null
          id?: string
          is_custom_trial?: boolean
          logo_url?: string | null
          monthly_price_cents?: number
          name: string
          notes_internal?: string | null
          operation_mode_pin_hash?: string | null
          postal_code?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug: string
          state?: string | null
          status?: Database['public']['Enums']['tenant_status']
          subdomain: string
          subscription_ends_at?: string | null
          subscription_starts_at?: string | null
          timezone?: string
          transaction_fee_fixed_cents?: number | null
          transaction_fee_type?: Database['public']['Enums']['transaction_fee_type']
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
          billing_model?: Database['public']['Enums']['billing_model']
          billing_status?: Database['public']['Enums']['billing_status']
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          current_plan_id?: string | null
          custom_domain?: string | null
          email?: string | null
          favicon_url?: string | null
          grace_period_ends_at?: string | null
          id?: string
          is_custom_trial?: boolean
          logo_url?: string | null
          monthly_price_cents?: number
          name?: string
          notes_internal?: string | null
          operation_mode_pin_hash?: string | null
          postal_code?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          slug?: string
          state?: string | null
          status?: Database['public']['Enums']['tenant_status']
          subdomain?: string
          subscription_ends_at?: string | null
          subscription_starts_at?: string | null
          timezone?: string
          transaction_fee_fixed_cents?: number | null
          transaction_fee_type?: Database['public']['Enums']['transaction_fee_type']
          transaction_fee_value?: number
          trial_days_granted?: number | null
          trial_ends_at?: string | null
          trial_starts_at?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'tenants_current_plan_id_fkey'
            columns: ['current_plan_id']
            isOneToOne: false
            referencedRelation: 'plans'
            referencedColumns: ['id']
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          role: Database['public']['Enums']['user_role']
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          role: Database['public']['Enums']['user_role']
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          role?: Database['public']['Enums']['user_role']
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'user_profiles_tenant_id_fkey'
            columns: ['tenant_id']
            isOneToOne: false
            referencedRelation: 'tenants'
            referencedColumns: ['id']
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
        Returns: Database['public']['Enums']['user_role']
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_tenant_staff: { Args: { target_tenant: string }; Returns: boolean }
    }
    Enums: {
      billing_model: 'TRIAL' | 'SUBSCRIPTION_WITH_TRANSACTION_FEE'
      billing_status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELED'
      tenant_status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
      transaction_fee_type: 'PERCENTAGE' | 'FIXED' | 'NONE'
      user_role: 'PLATFORM_ADMIN' | 'SALON_OWNER' | 'RECEPTIONIST' | 'PROFESSIONAL' | 'CUSTOMER'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      billing_model: ['TRIAL', 'SUBSCRIPTION_WITH_TRANSACTION_FEE'],
      billing_status: ['TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELED'],
      tenant_status: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'],
      transaction_fee_type: ['PERCENTAGE', 'FIXED', 'NONE'],
      user_role: ['PLATFORM_ADMIN', 'SALON_OWNER', 'RECEPTIONIST', 'PROFESSIONAL', 'CUSTOMER'],
    },
  },
} as const
