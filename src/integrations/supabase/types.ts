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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      campaigns: {
        Row: {
          audience: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          link_url: string | null
          list_id: string | null
          media_id: string | null
          media_type: string | null
          media_url: string | null
          name: string
          reengagement_of: string | null
          scheduled_at: string | null
          segment_id: string | null
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_url?: string | null
          list_id?: string | null
          media_id?: string | null
          media_type?: string | null
          media_url?: string | null
          name: string
          reengagement_of?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          audience?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          link_url?: string | null
          list_id?: string | null
          media_id?: string | null
          media_type?: string | null
          media_url?: string | null
          name?: string
          reengagement_of?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media_library"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_reengagement_of_fkey"
            columns: ["reengagement_of"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_list_members: {
        Row: {
          created_at: string
          id: string
          journalist_id: string
          list_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          journalist_id: string
          list_id: string
        }
        Update: {
          created_at?: string
          id?: string
          journalist_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_list_members_journalist_id_fkey"
            columns: ["journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_list_members_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          body: string
          channel: string
          created_at: string
          direction: string
          id: string
          journalist_id: string | null
          read_by_admin: boolean
          status: string
          wa_message_id: string | null
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          direction: string
          id?: string
          journalist_id?: string | null
          read_by_admin?: boolean
          status?: string
          wa_message_id?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          journalist_id?: string | null
          read_by_admin?: boolean
          status?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_journalist_id_fkey"
            columns: ["journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_logs: {
        Row: {
          campaign_id: string
          created_at: string
          delivered_at: string | null
          email: string | null
          error_code: string | null
          error_message: string | null
          id: string
          journalist_id: string | null
          phone: string | null
          read_at: string | null
          resend_message_id: string | null
          sent_at: string | null
          status: string
          wa_message_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          journalist_id?: string | null
          phone?: string | null
          read_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delivered_at?: string | null
          email?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          journalist_id?: string | null
          phone?: string | null
          read_at?: string | null
          resend_message_id?: string | null
          sent_at?: string | null
          status?: string
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_logs_journalist_id_fkey"
            columns: ["journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string
          dispatch_log_id: string | null
          event_type: string
          id: string
          payload: Json
        }
        Insert: {
          created_at?: string
          dispatch_log_id?: string | null
          event_type: string
          id?: string
          payload?: Json
        }
        Update: {
          created_at?: string
          dispatch_log_id?: string | null
          event_type?: string
          id?: string
          payload?: Json
        }
        Relationships: [
          {
            foreignKeyName: "email_events_dispatch_log_id_fkey"
            columns: ["dispatch_log_id"]
            isOneToOne: false
            referencedRelation: "dispatch_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      journalists: {
        Row: {
          active: boolean
          audience: string
          bounce_reason: string | null
          bounced_at: string | null
          company: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          opt_in: boolean
          opt_in_email: boolean
          opt_in_whatsapp: boolean
          outlet: string | null
          owner_note: string | null
          phone: string
          region: string | null
          role_title: string | null
          source: string | null
          stage: string | null
          tags: string[]
        }
        Insert: {
          active?: boolean
          audience?: string
          bounce_reason?: string | null
          bounced_at?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          opt_in?: boolean
          opt_in_email?: boolean
          opt_in_whatsapp?: boolean
          outlet?: string | null
          owner_note?: string | null
          phone: string
          region?: string | null
          role_title?: string | null
          source?: string | null
          stage?: string | null
          tags?: string[]
        }
        Update: {
          active?: boolean
          audience?: string
          bounce_reason?: string | null
          bounced_at?: string | null
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          opt_in?: boolean
          opt_in_email?: boolean
          opt_in_whatsapp?: boolean
          outlet?: string | null
          owner_note?: string | null
          phone?: string
          region?: string | null
          role_title?: string | null
          source?: string | null
          stage?: string | null
          tags?: string[]
        }
        Relationships: []
      }
      media_library: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_size_bytes: number | null
          id: string
          media_type: string
          meta_media_id: string | null
          meta_media_uploaded_at: string | null
          mime_type: string
          public_url: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          media_type: string
          meta_media_id?: string | null
          meta_media_uploaded_at?: string | null
          mime_type: string
          public_url: string
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          media_type?: string
          meta_media_id?: string | null
          meta_media_uploaded_at?: string | null
          mime_type?: string
          public_url?: string
          storage_path?: string
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body_text: string
          category: string
          channel: string
          created_at: string
          html_body: string | null
          id: string
          language: string
          last_used_at: string | null
          meta_template_name: string | null
          name: string | null
          status: string
          subject: string | null
          tags: string[]
          usage_count: number
        }
        Insert: {
          body_text: string
          category?: string
          channel?: string
          created_at?: string
          html_body?: string | null
          id?: string
          language?: string
          last_used_at?: string | null
          meta_template_name?: string | null
          name?: string | null
          status?: string
          subject?: string | null
          tags?: string[]
          usage_count?: number
        }
        Update: {
          body_text?: string
          category?: string
          channel?: string
          created_at?: string
          html_body?: string | null
          id?: string
          language?: string
          last_used_at?: string | null
          meta_template_name?: string | null
          name?: string | null
          status?: string
          subject?: string | null
          tags?: string[]
          usage_count?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      segments: {
        Row: {
          audience: string
          created_at: string
          description: string | null
          id: string
          name: string
          rules: Json
        }
        Insert: {
          audience?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          rules?: Json
        }
        Update: {
          audience?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          rules?: Json
        }
        Relationships: []
      }
      short_link_clicks: {
        Row: {
          clicked_at: string
          id: string
          journalist_id: string | null
          short_link_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          journalist_id?: string | null
          short_link_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          journalist_id?: string | null
          short_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_link_clicks_journalist_id_fkey"
            columns: ["journalist_id"]
            isOneToOne: false
            referencedRelation: "journalists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "short_link_clicks_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      short_links: {
        Row: {
          campaign_id: string | null
          click_count: number
          created_at: string
          id: string
          original_url: string
          short_code: string
        }
        Insert: {
          campaign_id?: string | null
          click_count?: number
          created_at?: string
          id?: string
          original_url: string
          short_code: string
        }
        Update: {
          campaign_id?: string | null
          click_count?: number
          created_at?: string
          id?: string
          original_url?: string
          short_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "short_links_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
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
      waba_config: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          messaging_limit_tier: string | null
          phone_number_id: string | null
          quality_checked_at: string | null
          quality_rating: string
          waba_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          messaging_limit_tier?: string | null
          phone_number_id?: string | null
          quality_checked_at?: string | null
          quality_rating?: string
          waba_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          messaging_limit_tier?: string | null
          phone_number_id?: string | null
          quality_checked_at?: string | null
          quality_rating?: string
          waba_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
