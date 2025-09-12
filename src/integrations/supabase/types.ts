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
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          is_favorite: boolean
          messages: Json
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          messages?: Json
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_favorite?: boolean
          messages?: Json
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cron_job_logs: {
        Row: {
          details: Json | null
          executed_at: string | null
          id: string
          job_name: string
          status: string | null
        }
        Insert: {
          details?: Json | null
          executed_at?: string | null
          id?: string
          job_name: string
          status?: string | null
        }
        Update: {
          details?: Json | null
          executed_at?: string | null
          id?: string
          job_name?: string
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          subscription_type:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          tokens_remaining: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id: string
          name: string
          phone?: string | null
          subscription_type?:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          tokens_remaining?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          subscription_type?:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          tokens_remaining?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      storage_cleanup_logs: {
        Row: {
          created_at: string | null
          deleted_files: number | null
          errors: string[] | null
          freed_space_mb: number | null
          id: string
          success: boolean | null
          total_files: number | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_files?: number | null
          errors?: string[] | null
          freed_space_mb?: number | null
          id?: string
          success?: boolean | null
          total_files?: number | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_files?: number | null
          errors?: string[] | null
          freed_space_mb?: number | null
          id?: string
          success?: boolean | null
          total_files?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      token_usage: {
        Row: {
          ai_response_content: string | null
          created_at: string | null
          id: string
          input_tokens: number | null
          message_content: string | null
          model_name: string
          output_tokens: number | null
          tokens_used: number
          user_id: string | null
        }
        Insert: {
          ai_response_content?: string | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          message_content?: string | null
          model_name: string
          output_tokens?: number | null
          tokens_used: number
          user_id?: string | null
        }
        Update: {
          ai_response_content?: string | null
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          message_content?: string | null
          model_name?: string
          output_tokens?: number | null
          tokens_used?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "token_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_images: {
        Row: {
          created_at: string
          format: string | null
          height: number | null
          id: string
          image_path: string
          prompt: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          created_at?: string
          format?: string | null
          height?: number | null
          id?: string
          image_path: string
          prompt?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          created_at?: string
          format?: string | null
          height?: number | null
          id?: string
          image_path?: string
          prompt?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: []
      }
      user_videos: {
        Row: {
          aspect_ratio: string | null
          created_at: string
          duration: number | null
          final_frame_url: string | null
          format: string | null
          id: string
          initial_frame_url: string | null
          model: string
          prompt: string | null
          resolution: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string
          duration?: number | null
          final_frame_url?: string | null
          format?: string | null
          id?: string
          initial_frame_url?: string | null
          model: string
          prompt?: string | null
          resolution?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string
          duration?: number | null
          final_frame_url?: string | null
          format?: string | null
          id?: string
          initial_frame_url?: string | null
          model?: string
          prompt?: string | null
          resolution?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_all_storage_files: {
        Args: { bucket_name: string }
        Returns: number
      }
      delete_storage_file: {
        Args: { bucket_name: string; file_path: string }
        Returns: boolean
      }
      insert_image_usage: {
        Args: {
          p_cost: number
          p_model_name: string
          p_prompt: string
          p_user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      subscription_type: "free" | "paid" | "admin"
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
      subscription_type: ["free", "paid", "admin"],
    },
  },
} as const
