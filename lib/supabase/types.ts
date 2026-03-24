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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      extraction_logs: {
        Row: {
          counts: Json | null
          id: number
          owner_id: string
          reason: string | null
          stage: string
          ts: string
        }
        Insert: {
          counts?: Json | null
          id?: number
          owner_id?: string
          reason?: string | null
          stage: string
          ts?: string
        }
        Update: {
          counts?: Json | null
          id?: number
          owner_id?: string
          reason?: string | null
          stage?: string
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "extraction_logs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          ai_version: number
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          priority: number
          status: string
          summary: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          ai_version?: number
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          priority?: number
          status?: string
          summary?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          ai_version?: number
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          priority?: number
          status?: string
          summary?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: Json
          created_at: string
          id: string
          role: string
          schema_kind: Database["public"]["Enums"]["message_schema_kind"]
          schema_version: number
          text_excerpt: string
          thread_id: string
        }
        Insert: {
          content: Json
          created_at?: string
          id: string
          role: string
          schema_kind?: Database["public"]["Enums"]["message_schema_kind"]
          schema_version?: number
          text_excerpt?: string
          thread_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          role?: string
          schema_kind?: Database["public"]["Enums"]["message_schema_kind"]
          schema_version?: number
          text_excerpt?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      organic_state: {
        Row: {
          clerk_user_id: string
          state: Json
          updated_at: string
        }
        Insert: {
          clerk_user_id: string
          state: Json
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string
          state?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          clerk_user_id: string
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      rabbit_hole_branch_suggestions: {
        Row: {
          branch_id: string
          id: string
          label: string
          node_id: string
          session_id: string
          short_description: string | null
        }
        Insert: {
          branch_id: string
          id?: string
          label: string
          node_id: string
          session_id: string
          short_description?: string | null
        }
        Update: {
          branch_id?: string
          id?: string
          label?: string
          node_id?: string
          session_id?: string
          short_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rabbit_hole_branch_suggestions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rabbit_hole_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      rabbit_hole_edges: {
        Row: {
          edge_type: string | null
          from_node_id: string
          id: string
          session_id: string
          to_node_id: string
        }
        Insert: {
          edge_type?: string | null
          from_node_id: string
          id?: string
          session_id: string
          to_node_id: string
        }
        Update: {
          edge_type?: string | null
          from_node_id?: string
          id?: string
          session_id?: string
          to_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rabbit_hole_edges_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rabbit_hole_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      rabbit_hole_nodes: {
        Row: {
          article_html: string | null
          created_at: string
          id: string
          key_takeaways: string[]
          node_id: string
          preview: string | null
          raw_prompt: string
          session_id: string
          title: string | null
          user_question: string
        }
        Insert: {
          article_html?: string | null
          created_at?: string
          id?: string
          key_takeaways: string[]
          node_id: string
          preview?: string | null
          raw_prompt: string
          session_id: string
          title?: string | null
          user_question: string
        }
        Update: {
          article_html?: string | null
          created_at?: string
          id?: string
          key_takeaways?: string[]
          node_id?: string
          preview?: string | null
          raw_prompt?: string
          session_id?: string
          title?: string | null
          user_question?: string
        }
        Relationships: [
          {
            foreignKeyName: "rabbit_hole_nodes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rabbit_hole_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      rabbit_hole_path_segments: {
        Row: {
          id: string
          label: string
          node_id: string
          parent_node_id: string | null
          position: number
          session_id: string
        }
        Insert: {
          id?: string
          label: string
          node_id: string
          parent_node_id?: string | null
          position: number
          session_id: string
        }
        Update: {
          id?: string
          label?: string
          node_id?: string
          parent_node_id?: string | null
          position?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rabbit_hole_path_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rabbit_hole_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      rabbit_hole_sessions: {
        Row: {
          active_node_id: string | null
          created_at: string
          generating_node_id: string | null
          generation_step: string | null
          id: string
          owner_id: string
          root_question: string
          session_id: string
          updated_at: string
        }
        Insert: {
          active_node_id?: string | null
          created_at?: string
          generating_node_id?: string | null
          generation_step?: string | null
          id?: string
          owner_id?: string
          root_question: string
          session_id: string
          updated_at?: string
        }
        Update: {
          active_node_id?: string | null
          created_at?: string
          generating_node_id?: string | null
          generation_step?: string | null
          id?: string
          owner_id?: string
          root_question?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rabbit_hole_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rabbit_hole_sources: {
        Row: {
          analysis: Json | null
          author: string | null
          favicon_url: string | null
          highlights: string[] | null
          id: string
          node_id: string
          published_date: string | null
          session_id: string
          snippet: string | null
          source_id: string
          title: string
          url: string
        }
        Insert: {
          analysis?: Json | null
          author?: string | null
          favicon_url?: string | null
          highlights?: string[] | null
          id?: string
          node_id: string
          published_date?: string | null
          session_id: string
          snippet?: string | null
          source_id: string
          title: string
          url: string
        }
        Update: {
          analysis?: Json | null
          author?: string | null
          favicon_url?: string | null
          highlights?: string[] | null
          id?: string
          node_id?: string
          published_date?: string | null
          session_id?: string
          snippet?: string | null
          source_id?: string
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "rabbit_hole_sources_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "rabbit_hole_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          notes: string | null
          owner_id: string
          priority: number
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          priority?: number
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          priority?: number
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_summaries: {
        Row: {
          created_at: string
          id: string
          last_summarized_at: string | null
          last_summarized_message_id: string | null
          status: Database["public"]["Enums"]["summary_status"]
          summary_text: string
          summary_tokens: number
          thread_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_summarized_at?: string | null
          last_summarized_message_id?: string | null
          status?: Database["public"]["Enums"]["summary_status"]
          summary_text?: string
          summary_tokens?: number
          thread_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_summarized_at?: string | null
          last_summarized_message_id?: string | null
          status?: Database["public"]["Enums"]["summary_status"]
          summary_text?: string
          summary_tokens?: number
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_summaries_last_summarized_message_id_fkey"
            columns: ["last_summarized_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_summaries_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          active_stream_id: string | null
          active_stream_started_at: string | null
          conversation_summary: string | null
          created_at: string
          feature: string
          flags: number
          id: string
          owner_id: string
          path: string | null
          persisted_schemas: Json | null
          pinned: boolean
          title: string | null
          updated_at: string
        }
        Insert: {
          active_stream_id?: string | null
          active_stream_started_at?: string | null
          conversation_summary?: string | null
          created_at?: string
          feature?: string
          flags?: number
          id?: string
          owner_id: string
          path?: string | null
          persisted_schemas?: Json | null
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Update: {
          active_stream_id?: string | null
          active_stream_started_at?: string | null
          conversation_summary?: string | null
          created_at?: string
          feature?: string
          flags?: number
          id?: string
          owner_id?: string
          path?: string | null
          persisted_schemas?: Json | null
          pinned?: boolean
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "threads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts: {
        Row: {
          content: string
          created_at: string
          extracted_json: Json | null
          id: string
          needs_review: boolean
          owner_id: string
        }
        Insert: {
          content: string
          created_at?: string
          extracted_json?: Json | null
          id?: string
          needs_review?: boolean
          owner_id?: string
        }
        Update: {
          content?: string
          created_at?: string
          extracted_json?: Json | null
          id?: string
          needs_review?: boolean
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_owner_id_fkey"
            columns: ["owner_id"]
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
      clerk_sub: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
    }
    Enums: {
      message_schema_kind: "ui_message"
      summary_status: "idle" | "running" | "dirty"
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
      message_schema_kind: ["ui_message"],
      summary_status: ["idle", "running", "dirty"],
    },
  },
} as const
