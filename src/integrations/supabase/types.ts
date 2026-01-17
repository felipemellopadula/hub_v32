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
      agent_conversations: {
        Row: {
          created_at: string | null
          id: string
          is_favorite: boolean | null
          messages: Json
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          messages?: Json
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_favorite?: boolean | null
          messages?: Json
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      agent_documents: {
        Row: {
          content: string | null
          conversation_id: string | null
          created_at: string | null
          file_name: string
          file_type: string
          file_url: string | null
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          file_name: string
          file_type: string
          file_url?: string | null
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          file_name?: string
          file_type?: string
          file_url?: string | null
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      agent_logs: {
        Row: {
          agent_type: string
          id: string
          level: string
          message: string
          metadata: Json | null
          session_id: string | null
          timestamp: string | null
        }
        Insert: {
          agent_type: string
          id?: string
          level: string
          message: string
          metadata?: Json | null
          session_id?: string | null
          timestamp?: string | null
        }
        Update: {
          agent_type?: string
          id?: string
          level?: string
          message?: string
          metadata?: Json | null
          session_id?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_searches: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          id: string
          query: string
          results: Json | null
          source: string | null
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          query: string
          results?: Json | null
          source?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          query?: string
          results?: Json | null
          source?: string | null
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
      credit_purchases: {
        Row: {
          amount_paid: number | null
          created_at: string | null
          currency: string | null
          id: string
          plan_id: string
          plan_name: string | null
          stripe_session_id: string
          tokens_credited: number
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          plan_id: string
          plan_name?: string | null
          stripe_session_id: string
          tokens_credited: number
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          created_at?: string | null
          currency?: string | null
          id?: string
          plan_id?: string
          plan_name?: string | null
          stripe_session_id?: string
          tokens_credited?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      files: {
        Row: {
          analyzed: boolean | null
          file_path: string
          file_size: number | null
          file_type: string | null
          filename: string
          id: string
          uploaded_at: string | null
          user_id: string | null
        }
        Insert: {
          analyzed?: boolean | null
          file_path: string
          file_size?: number | null
          file_type?: string | null
          filename: string
          id?: string
          uploaded_at?: string | null
          user_id?: string | null
        }
        Update: {
          analyzed?: boolean | null
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          filename?: string
          id?: string
          uploaded_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tools_logs: {
        Row: {
          executed_at: string | null
          id: string
          tool_data: Json
          tool_name: string
          user_id: string | null
        }
        Insert: {
          executed_at?: string | null
          id?: string
          tool_data: Json
          tool_name: string
          user_id?: string | null
        }
        Update: {
          executed_at?: string | null
          id?: string
          tool_data?: Json
          tool_name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mcp_tools_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          id: string
          metadata: Json | null
          metric_type: string
          module_name: string
          timestamp: string | null
          user_id: string | null
          value: number | null
        }
        Insert: {
          id?: string
          metadata?: Json | null
          metric_type: string
          module_name: string
          timestamp?: string | null
          user_id?: string | null
          value?: number | null
        }
        Update: {
          id?: string
          metadata?: Json | null
          metric_type?: string
          module_name?: string
          timestamp?: string | null
          user_id?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      miniagent_files: {
        Row: {
          extracted_content: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          metadata: Json | null
          processed: boolean | null
          session_id: string | null
          storage_path: string | null
          uploaded_at: string | null
        }
        Insert: {
          extracted_content?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          metadata?: Json | null
          processed?: boolean | null
          session_id?: string | null
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Update: {
          extracted_content?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          metadata?: Json | null
          processed?: boolean | null
          session_id?: string | null
          storage_path?: string | null
          uploaded_at?: string | null
        }
        Relationships: []
      }
      miniagent_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          metadata: Json | null
          role: string
          session_id: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string | null
        }
        Relationships: []
      }
      miniagent_sessions: {
        Row: {
          config: Json
          created_at: string
          id: string
          stats: Json
          status: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          stats?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          stats?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      miniagent_tools_logs: {
        Row: {
          error_message: string | null
          executed_at: string | null
          id: string
          input_data: Json | null
          metadata: Json | null
          output_data: Json | null
          session_id: string | null
          success: boolean | null
          tool_name: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          input_data?: Json | null
          metadata?: Json | null
          output_data?: Json | null
          session_id?: string | null
          success?: boolean | null
          tool_name: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          id?: string
          input_data?: Json | null
          metadata?: Json | null
          output_data?: Json | null
          session_id?: string | null
          success?: boolean | null
          tool_name?: string
        }
        Relationships: []
      }
      minimax_responses: {
        Row: {
          created_at: string | null
          id: string
          prompt: string
          response: string
          response_time: number | null
          session_id: string | null
          thinking_process: string | null
          tool_calls: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          prompt: string
          response: string
          response_time?: number | null
          session_id?: string | null
          thinking_process?: string | null
          tool_calls?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          prompt?: string
          response?: string
          response_time?: number | null
          session_id?: string | null
          thinking_process?: string | null
          tool_calls?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minimax_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minimax_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          current_plan: string | null
          current_subscription_id: string | null
          email: string
          has_seen_welcome_modal: boolean
          id: string
          is_legacy_user: boolean
          is_password_set: boolean | null
          name: string
          phone: string | null
          stripe_customer_id: string | null
          subscription_type:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          tokens_remaining: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          current_plan?: string | null
          current_subscription_id?: string | null
          email: string
          has_seen_welcome_modal?: boolean
          id: string
          is_legacy_user?: boolean
          is_password_set?: boolean | null
          name: string
          phone?: string | null
          stripe_customer_id?: string | null
          subscription_type?:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          tokens_remaining?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          current_plan?: string | null
          current_subscription_id?: string | null
          email?: string
          has_seen_welcome_modal?: boolean
          id?: string
          is_legacy_user?: boolean
          is_password_set?: boolean | null
          name?: string
          phone?: string | null
          stripe_customer_id?: string | null
          subscription_type?:
            | Database["public"]["Enums"]["subscription_type"]
            | null
          tokens_remaining?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_subscription_id_fkey"
            columns: ["current_subscription_id"]
            isOneToOne: false
            referencedRelation: "stripe_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          session_type: string
          status: string | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          session_type: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          session_type?: string
          status?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
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
      storyboard_projects: {
        Row: {
          aspect_ratio: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
          video_model: string | null
          visual_consistency: boolean | null
        }
        Insert: {
          aspect_ratio?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id: string
          video_model?: string | null
          visual_consistency?: boolean | null
        }
        Update: {
          aspect_ratio?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
          video_model?: string | null
          visual_consistency?: boolean | null
        }
        Relationships: []
      }
      storyboard_references: {
        Row: {
          created_at: string
          id: string
          image_url: string
          name: string
          project_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url: string
          name?: string
          project_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string
          name?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "storyboard_references_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "storyboard_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      storyboard_scenes: {
        Row: {
          created_at: string | null
          duration: number | null
          generated_image_url: string | null
          id: string
          image_status: string | null
          image_url: string
          motion_prompt: string | null
          order_index: number
          project_id: string
          prompt: string | null
          source_image_id: string | null
          video_status: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          duration?: number | null
          generated_image_url?: string | null
          id?: string
          image_status?: string | null
          image_url: string
          motion_prompt?: string | null
          order_index?: number
          project_id: string
          prompt?: string | null
          source_image_id?: string | null
          video_status?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          duration?: number | null
          generated_image_url?: string | null
          id?: string
          image_status?: string | null
          image_url?: string
          motion_prompt?: string | null
          order_index?: number
          project_id?: string
          prompt?: string | null
          source_image_id?: string | null
          video_status?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "storyboard_scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "storyboard_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "storyboard_scenes_source_image_id_fkey"
            columns: ["source_image_id"]
            isOneToOne: false
            referencedRelation: "user_images"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string
          email: string
          id: string
          stripe_customer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          stripe_customer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          stripe_customer_id?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_products: {
        Row: {
          active: boolean
          amount_cents: number
          billing_period: string
          created_at: string
          currency: string
          id: string
          plan_id: string
          plan_name: string
          stripe_price_id: string
          stripe_product_id: string
          tokens_included: number
        }
        Insert: {
          active?: boolean
          amount_cents: number
          billing_period: string
          created_at?: string
          currency?: string
          id?: string
          plan_id: string
          plan_name: string
          stripe_price_id: string
          stripe_product_id: string
          tokens_included: number
        }
        Update: {
          active?: boolean
          amount_cents?: number
          billing_period?: string
          created_at?: string
          currency?: string
          id?: string
          plan_id?: string
          plan_name?: string
          stripe_price_id?: string
          stripe_product_id?: string
          tokens_included?: number
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan_id: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tokens_per_period: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id: string
          price_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tokens_per_period: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan_id?: string
          price_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tokens_per_period?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string | null
          id: string
          module_name: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value: Json
          created_at?: string | null
          id?: string
          module_name: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string | null
          id?: string
          module_name?: string
          updated_at?: string | null
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
      user_avatars: {
        Row: {
          created_at: string
          id: string
          image_path: string
          prompt: string | null
          style: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_path: string
          prompt?: string | null
          style?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          image_path?: string
          prompt?: string | null
          style?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_images: {
        Row: {
          created_at: string
          format: string | null
          height: number | null
          id: string
          image_path: string
          is_public: boolean
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
          is_public?: boolean
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
          is_public?: boolean
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
      users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          id: string
          name: string | null
          role: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          id?: string
          name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string | null
          role?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_reset_user_tokens: {
        Args: { p_new_token_amount: number; p_user_email: string }
        Returns: Json
      }
      delete_all_storage_files: {
        Args: { bucket_name: string }
        Returns: number
      }
      delete_storage_file: {
        Args: { bucket_name: string; file_path: string }
        Returns: boolean
      }
      has_admin_role: { Args: { _user_id: string }; Returns: boolean }
      insert_image_usage: {
        Args: {
          p_cost: number
          p_model_name: string
          p_prompt: string
          p_user_id: string
        }
        Returns: undefined
      }
      owns_miniagent_session: {
        Args: { p_session_id: string }
        Returns: boolean
      }
    }
    Enums: {
      subscription_type: "free" | "paid" | "admin" | "basic" | "plus" | "pro"
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
      subscription_type: ["free", "paid", "admin", "basic", "plus", "pro"],
    },
  },
} as const
