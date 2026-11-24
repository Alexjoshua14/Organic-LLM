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
      account_entitlements: {
        Row: {
          cycle_anchor: string
          plan: string
          profile_id: string
          resets_remaining: number
          updated_at: string
        }
        Insert: {
          cycle_anchor?: string
          plan?: string
          profile_id: string
          resets_remaining?: number
          updated_at?: string
        }
        Update: {
          cycle_anchor?: string
          plan?: string
          profile_id?: string
          resets_remaining?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_entitlements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_access: {
        Row: {
          granted_at: string
          profile_id: string
        }
        Insert: {
          granted_at?: string
          profile_id: string
        }
        Update: {
          granted_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_stream_leases: {
        Row: {
          expires_at: string
          kind: string
          owner_id: string
          parent_thread_id: string | null
          thread_id: string
          token: string
        }
        Insert: {
          expires_at: string
          kind?: string
          owner_id: string
          parent_thread_id?: string | null
          thread_id: string
          token: string
        }
        Update: {
          expires_at?: string
          kind?: string
          owner_id?: string
          parent_thread_id?: string | null
          thread_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_stream_leases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ergon_connections: {
        Row: {
          connected_at: string
          expires_at: string | null
          last_ok_at: string | null
          mcp_url: string
          owner_id: string
          refresh_lock_until: string | null
          refresh_token_ciphertext: string | null
          scopes: string[]
          token_ciphertext: string
          updated_at: string
          url: string
          version: number
        }
        Insert: {
          connected_at?: string
          expires_at?: string | null
          last_ok_at?: string | null
          mcp_url: string
          owner_id: string
          refresh_lock_until?: string | null
          refresh_token_ciphertext?: string | null
          scopes: string[]
          token_ciphertext: string
          updated_at?: string
          url: string
          version?: number
        }
        Update: {
          connected_at?: string
          expires_at?: string | null
          last_ok_at?: string | null
          mcp_url?: string
          owner_id?: string
          refresh_lock_until?: string | null
          refresh_token_ciphertext?: string | null
          scopes?: string[]
          token_ciphertext?: string
          updated_at?: string
          url?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "ergon_connections_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      heartbeat_runs: {
        Row: {
          cost_usd: number | null
          duration_ms: number
          error_code: string | null
          evaluation_attempted: boolean
          evaluation_duration_ms: number | null
          event_count: number
          generation_id: string | null
          id: string
          input_tokens: number | null
          model_id: string | null
          output_tokens: number | null
          owner_id: string
          provider: string | null
          snapshot_chars: number | null
          snapshot_duration_ms: number | null
          stage: string
          started_at: string
          status: string
          subagent_count: number | null
          thread_id: string
          total_tokens: number | null
          working_subagent_count: number | null
        }
        Insert: {
          cost_usd?: number | null
          duration_ms: number
          error_code?: string | null
          evaluation_attempted: boolean
          evaluation_duration_ms?: number | null
          event_count: number
          generation_id?: string | null
          id: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          owner_id: string
          provider?: string | null
          snapshot_chars?: number | null
          snapshot_duration_ms?: number | null
          stage: string
          started_at: string
          status: string
          subagent_count?: number | null
          thread_id: string
          total_tokens?: number | null
          working_subagent_count?: number | null
        }
        Update: {
          cost_usd?: number | null
          duration_ms?: number
          error_code?: string | null
          evaluation_attempted?: boolean
          evaluation_duration_ms?: number | null
          event_count?: number
          generation_id?: string | null
          id?: string
          input_tokens?: number | null
          model_id?: string | null
          output_tokens?: number | null
          owner_id?: string
          provider?: string | null
          snapshot_chars?: number | null
          snapshot_duration_ms?: number | null
          stage?: string
          started_at?: string
          status?: string
          subagent_count?: number | null
          thread_id?: string
          total_tokens?: number | null
          working_subagent_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "heartbeat_runs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heartbeat_runs_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeat_runs_hourly: {
        Row: {
          cost_samples: number
          cost_usd_sum: number
          duration_ms_max: number
          duration_ms_sum: number
          error_code: string
          evaluation_count: number
          evaluation_duration_count: number
          evaluation_duration_ms_max: number | null
          evaluation_duration_ms_sum: number
          event_count_sum: number
          hour_start: string
          input_tokens_samples: number
          input_tokens_sum: number
          model_id: string
          output_tokens_samples: number
          output_tokens_sum: number
          owner_id: string
          provider: string
          run_count: number
          snapshot_chars_samples: number
          snapshot_chars_sum: number
          snapshot_duration_ms_sum: number
          snapshot_duration_samples: number
          stage: string
          status: string
          subagent_count_samples: number
          subagent_count_sum: number
          total_tokens_samples: number
          total_tokens_sum: number
          working_subagent_max: number | null
          working_subagent_samples: number
          working_subagent_sum: number
        }
        Insert: {
          cost_samples: number
          cost_usd_sum: number
          duration_ms_max: number
          duration_ms_sum: number
          error_code: string
          evaluation_count: number
          evaluation_duration_count: number
          evaluation_duration_ms_max?: number | null
          evaluation_duration_ms_sum: number
          event_count_sum: number
          hour_start: string
          input_tokens_samples: number
          input_tokens_sum: number
          model_id: string
          output_tokens_samples: number
          output_tokens_sum: number
          owner_id: string
          provider: string
          run_count: number
          snapshot_chars_samples?: number
          snapshot_chars_sum?: number
          snapshot_duration_ms_sum?: number
          snapshot_duration_samples?: number
          stage: string
          status: string
          subagent_count_samples: number
          subagent_count_sum: number
          total_tokens_samples: number
          total_tokens_sum: number
          working_subagent_max?: number | null
          working_subagent_samples?: number
          working_subagent_sum?: number
        }
        Update: {
          cost_samples?: number
          cost_usd_sum?: number
          duration_ms_max?: number
          duration_ms_sum?: number
          error_code?: string
          evaluation_count?: number
          evaluation_duration_count?: number
          evaluation_duration_ms_max?: number | null
          evaluation_duration_ms_sum?: number
          event_count_sum?: number
          hour_start?: string
          input_tokens_samples?: number
          input_tokens_sum?: number
          model_id?: string
          output_tokens_samples?: number
          output_tokens_sum?: number
          owner_id?: string
          provider?: string
          run_count?: number
          snapshot_chars_samples?: number
          snapshot_chars_sum?: number
          snapshot_duration_ms_sum?: number
          snapshot_duration_samples?: number
          stage?: string
          status?: string
          subagent_count_samples?: number
          subagent_count_sum?: number
          total_tokens_samples?: number
          total_tokens_sum?: number
          working_subagent_max?: number | null
          working_subagent_samples?: number
          working_subagent_sum?: number
        }
        Relationships: [
          {
            foreignKeyName: "heartbeat_runs_hourly_owner_id_fkey"
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
      lab_access: {
        Row: {
          granted_at: string
          profile_id: string
        }
        Insert: {
          granted_at?: string
          profile_id: string
        }
        Update: {
          granted_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_access_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage_adjustments: {
        Row: {
          created_at: string
          created_by: string
          delta_usd: number
          effective_at: string
          event_id: string | null
          id: string
          owner_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by: string
          delta_usd: number
          effective_at: string
          event_id?: string | null
          id: string
          owner_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          delta_usd?: number
          effective_at?: string
          event_id?: string | null
          id?: string
          owner_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_usage_adjustments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "llm_usage_events"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_usage_events: {
        Row: {
          audio_input_tokens: number
          audio_output_tokens: number
          cache_reported: boolean | null
          cached_input_tokens: number
          cost_usd: number
          created_at: string
          id: string
          input_tokens: number
          model_id: string
          operation: string | null
          output_tokens: number
          owner_id: string
          reasoning_tokens: number
          route: string | null
          surface: string | null
          total_tokens: number
        }
        Insert: {
          audio_input_tokens?: number
          audio_output_tokens?: number
          cache_reported?: boolean | null
          cached_input_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model_id: string
          operation?: string | null
          output_tokens?: number
          owner_id?: string
          reasoning_tokens?: number
          route?: string | null
          surface?: string | null
          total_tokens?: number
        }
        Update: {
          audio_input_tokens?: number
          audio_output_tokens?: number
          cache_reported?: boolean | null
          cached_input_tokens?: number
          cost_usd?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model_id?: string
          operation?: string | null
          output_tokens?: number
          owner_id?: string
          reasoning_tokens?: number
          route?: string | null
          surface?: string | null
          total_tokens?: number
        }
        Relationships: []
      }
      memory_feedback: {
        Row: {
          created_at: string
          id: string
          memory_ciphertext: string | null
          memory_id: string
          memory_shared_at: string | null
          note_approved_at: string | null
          note_ciphertext: string | null
          revision: number
          signal: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          memory_ciphertext?: string | null
          memory_id: string
          memory_shared_at?: string | null
          note_approved_at?: string | null
          note_ciphertext?: string | null
          revision?: number
          signal: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          memory_ciphertext?: string | null
          memory_id?: string
          memory_shared_at?: string | null
          note_approved_at?: string | null
          note_ciphertext?: string | null
          revision?: number
          signal?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      jev_stage_turn_eval: {
        Row: {
          created_at: string
          id: string
          note_approved_at: string | null
          note_ciphertext: string | null
          revision: number
          signal: string
          turn_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note_approved_at?: string | null
          note_ciphertext?: string | null
          revision?: number
          signal: string
          turn_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note_approved_at?: string | null
          note_ciphertext?: string | null
          revision?: number
          signal?: string
          turn_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jev_stage_turn_eval_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_quality_daily: {
        Row: {
          char_count_mean: number | null
          char_count_p50: number | null
          char_count_p90: number | null
          day: string
          delete_count: number
          delete_rate: number | null
          feedback_down: number
          feedback_up: number
          id: string
          ingest_count: number
          positive_rate: number | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          char_count_mean?: number | null
          char_count_p50?: number | null
          char_count_p90?: number | null
          day: string
          delete_count?: number
          delete_rate?: number | null
          feedback_down?: number
          feedback_up?: number
          id?: string
          ingest_count?: number
          positive_rate?: number | null
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          char_count_mean?: number | null
          char_count_p50?: number | null
          char_count_p90?: number | null
          day?: string
          delete_count?: number
          delete_rate?: number | null
          feedback_down?: number
          feedback_up?: number
          id?: string
          ingest_count?: number
          positive_rate?: number | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_quality_daily_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_quality_events: {
        Row: {
          char_count: number | null
          created_at: string
          event: string
          id: string
          memory_id: string | null
          metadata: Json
          source: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          char_count?: number | null
          created_at?: string
          event: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          source: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          char_count?: number | null
          created_at?: string
          event?: string
          id?: string
          memory_id?: string | null
          metadata?: Json
          source?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "memory_quality_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_context_links: {
        Row: {
          created_at: string
          created_by: string
          id: string
          message_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["pin_target_type"]
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          message_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["pin_target_type"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          message_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["pin_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "message_context_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_context_links_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_send_queue: {
        Row: {
          body: string
          created_at: string
          dispatched_at: string | null
          error: string | null
          hold_reason: string | null
          id: string
          owner_id: string
          payload: Json
          position: number
          sent_at: string | null
          status: string
          target_agent_id: string | null
          thread_id: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          dispatched_at?: string | null
          error?: string | null
          hold_reason?: string | null
          id?: string
          owner_id?: string
          payload?: Json
          position: number
          sent_at?: string | null
          status?: string
          target_agent_id?: string | null
          thread_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          dispatched_at?: string | null
          error?: string | null
          hold_reason?: string | null
          id?: string
          owner_id?: string
          payload?: Json
          position?: number
          sent_at?: string | null
          status?: string
          target_agent_id?: string | null
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_send_queue_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_send_queue_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
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
          send_mode: string | null
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
          send_mode?: string | null
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
          send_mode?: string | null
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
      mise_events: {
        Row: {
          created_at: string
          event_date: string | null
          event_time: string | null
          guest_count: number | null
          id: string
          location: string | null
          notes: string | null
          owner_id: string
          thread_id: string | null
          timeline: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          guest_count?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          thread_id?: string | null
          timeline?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_date?: string | null
          event_time?: string | null
          guest_count?: number | null
          id?: string
          location?: string | null
          notes?: string | null
          owner_id?: string
          thread_id?: string | null
          timeline?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mise_events_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mise_ingredients: {
        Row: {
          category: string | null
          checked: boolean
          client_key: string
          created_at: string
          event_id: string
          id: string
          name: string
          owner_id: string
          quantity: string | null
          recipe_key: string | null
          status: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          checked?: boolean
          client_key: string
          created_at?: string
          event_id: string
          id?: string
          name: string
          owner_id?: string
          quantity?: string | null
          recipe_key?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          checked?: boolean
          client_key?: string
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          owner_id?: string
          quantity?: string | null
          recipe_key?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mise_ingredients_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "mise_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mise_ingredients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mise_recipes: {
        Row: {
          client_key: string
          complexity: string | null
          cook_time: string | null
          created_at: string
          cuisine: string | null
          duration: string | null
          equipment: string[] | null
          event_id: string
          id: string
          ingredients: Json
          main_carbs: string | null
          main_protein: string | null
          notes: string | null
          owner_id: string
          prep_time: string | null
          servings: string | null
          source_url: string | null
          steps: string[]
          title: string
          updated_at: string
        }
        Insert: {
          client_key: string
          complexity?: string | null
          cook_time?: string | null
          created_at?: string
          cuisine?: string | null
          duration?: string | null
          equipment?: string[] | null
          event_id: string
          id?: string
          ingredients?: Json
          main_carbs?: string | null
          main_protein?: string | null
          notes?: string | null
          owner_id?: string
          prep_time?: string | null
          servings?: string | null
          source_url?: string | null
          steps?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          client_key?: string
          complexity?: string | null
          cook_time?: string | null
          created_at?: string
          cuisine?: string | null
          duration?: string | null
          equipment?: string[] | null
          event_id?: string
          id?: string
          ingredients?: Json
          main_carbs?: string | null
          main_protein?: string | null
          notes?: string | null
          owner_id?: string
          prep_time?: string | null
          servings?: string | null
          source_url?: string | null
          steps?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mise_recipes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "mise_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mise_recipes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      perf_events: {
        Row: {
          build: string
          conn: string
          device: string
          hour: string
          id: number
          journey: string
          kind: string
          ms: number
          phase: string
          route: string
          trigger: string
        }
        Insert: {
          build: string
          conn: string
          device: string
          hour: string
          id?: never
          journey: string
          kind: string
          ms: number
          phase: string
          route: string
          trigger: string
        }
        Update: {
          build?: string
          conn?: string
          device?: string
          hour?: string
          id?: never
          journey?: string
          kind?: string
          ms?: number
          phase?: string
          route?: string
          trigger?: string
        }
        Relationships: []
      }
      perf_metrics_consent: {
        Row: {
          enabled: boolean
          noticed_at: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          enabled: boolean
          noticed_at?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          noticed_at?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perf_metrics_consent_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_placements: {
        Row: {
          created_at: string
          date: string
          id: string
          leftover_of_placement_id: string | null
          owner_id: string
          recipe_id: string
          slot: string
          updated_at: string
          week_id: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          leftover_of_placement_id?: string | null
          owner_id?: string
          recipe_id: string
          slot: string
          updated_at?: string
          week_id: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          leftover_of_placement_id?: string | null
          owner_id?: string
          recipe_id?: string
          slot?: string
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_placements_leftover_of_placement_id_fkey"
            columns: ["leftover_of_placement_id"]
            isOneToOne: false
            referencedRelation: "prep_placements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_placements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_placements_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "prep_recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_placements_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "prep_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_recipes: {
        Row: {
          client_key: string
          complexity: string | null
          cook_time: string | null
          created_at: string
          cuisine: string | null
          duration: string | null
          equipment: string[] | null
          id: string
          ingredients: Json
          main_carbs: string | null
          main_protein: string | null
          notes: string | null
          owner_id: string
          prep_time: string | null
          servings: string | null
          source_url: string | null
          steps: string[]
          title: string
          updated_at: string
        }
        Insert: {
          client_key: string
          complexity?: string | null
          cook_time?: string | null
          created_at?: string
          cuisine?: string | null
          duration?: string | null
          equipment?: string[] | null
          id?: string
          ingredients?: Json
          main_carbs?: string | null
          main_protein?: string | null
          notes?: string | null
          owner_id?: string
          prep_time?: string | null
          servings?: string | null
          source_url?: string | null
          steps?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          client_key?: string
          complexity?: string | null
          cook_time?: string | null
          created_at?: string
          cuisine?: string | null
          duration?: string | null
          equipment?: string[] | null
          id?: string
          ingredients?: Json
          main_carbs?: string | null
          main_protein?: string | null
          notes?: string | null
          owner_id?: string
          prep_time?: string | null
          servings?: string | null
          source_url?: string | null
          steps?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_recipes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_week_ingredients: {
        Row: {
          category: string | null
          checked: boolean
          created_at: string
          id: string
          identity: string
          name: string
          owner_id: string
          quantity: string | null
          status: string
          unit: string | null
          updated_at: string
          week_id: string
        }
        Insert: {
          category?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          identity: string
          name: string
          owner_id?: string
          quantity?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          week_id: string
        }
        Update: {
          category?: string | null
          checked?: boolean
          created_at?: string
          id?: string
          identity?: string
          name?: string
          owner_id?: string
          quantity?: string | null
          status?: string
          unit?: string | null
          updated_at?: string
          week_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_week_ingredients_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_week_ingredients_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "prep_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_weeks: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_weeks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_tree_revisions: {
        Row: {
          created_at: string
          generation_metadata: Json
          id: string
          owner_id: string
          profile_tree: Json
          review_score: number | null
          source: string
          status: string
        }
        Insert: {
          created_at?: string
          generation_metadata?: Json
          id?: string
          owner_id?: string
          profile_tree: Json
          review_score?: number | null
          source: string
          status: string
        }
        Update: {
          created_at?: string
          generation_metadata?: Json
          id?: string
          owner_id?: string
          profile_tree?: Json
          review_score?: number | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_tree_revisions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clerk_user_id: string
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          profile_tree: Json | null
          profile_tree_source: string | null
          profile_tree_updated_at: string | null
        }
        Insert: {
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          profile_tree?: Json | null
          profile_tree_source?: string | null
          profile_tree_updated_at?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          profile_tree?: Json | null
          profile_tree_source?: string | null
          profile_tree_updated_at?: string | null
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
          summary: string | null
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
          summary?: string | null
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
          summary?: string | null
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
          chat_thread_id: string | null
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
          chat_thread_id?: string | null
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
          chat_thread_id?: string | null
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
            foreignKeyName: "rabbit_hole_sessions_chat_thread_id_fkey"
            columns: ["chat_thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
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
      release_notes_cache: {
        Row: {
          commit_count: number
          created_at: string
          from_sha: string
          from_version: string | null
          generated_at: string
          model: string
          notes: Json
          to_sha: string
          to_version: string | null
          updated_at: string
        }
        Insert: {
          commit_count?: number
          created_at?: string
          from_sha: string
          from_version?: string | null
          generated_at?: string
          model: string
          notes: Json
          to_sha: string
          to_version?: string | null
          updated_at?: string
        }
        Update: {
          commit_count?: number
          created_at?: string
          from_sha?: string
          from_version?: string | null
          generated_at?: string
          model?: string
          notes?: Json
          to_sha?: string
          to_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      research_ledgers: {
        Row: {
          created_at: string
          id: string
          legacy_thread_id: string | null
          owner_id: string
          payload: string | null
          payload_rev: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          legacy_thread_id?: string | null
          owner_id?: string
          payload?: string | null
          payload_rev?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          legacy_thread_id?: string | null
          owner_id?: string
          payload?: string | null
          payload_rev?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_ledgers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strata_note_snapshots: {
        Row: {
          note_id: string
          page_id: string
          snapshot: string
          state_vector: string
          updated_at: string
          version: number
        }
        Insert: {
          note_id: string
          page_id: string
          snapshot: string
          state_vector: string
          updated_at?: string
          version?: number
        }
        Update: {
          note_id?: string
          page_id?: string
          snapshot?: string
          state_vector?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "strata_note_snapshots_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "strata_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      strata_note_updates: {
        Row: {
          client_id: string
          created_at: string
          id: string
          note_id: string
          page_id: string
          update: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          note_id: string
          page_id: string
          update: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          note_id?: string
          page_id?: string
          update?: string
        }
        Relationships: [
          {
            foreignKeyName: "strata_note_updates_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "strata_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      strata_pages: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strata_pages_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      strata_sections: {
        Row: {
          content: string
          content_json: Json | null
          created_at: string
          id: string
          page_id: string
          section_key: string
          updated_at: string
        }
        Insert: {
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          page_id: string
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: string
          content_json?: Json | null
          created_at?: string
          id?: string
          page_id?: string
          section_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "strata_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "strata_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      task_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          owner_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          owner_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_categories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          category_id: string | null
          completed_at: string | null
          created_at: string
          due_date: string | null
          est_minutes: number | null
          id: string
          is_active: boolean
          mental_effort: string | null
          notes: string | null
          owner_id: string
          planned_at: string | null
          planned_has_time: boolean
          priority: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          est_minutes?: number | null
          id?: string
          is_active?: boolean
          mental_effort?: string | null
          notes?: string | null
          owner_id?: string
          planned_at?: string | null
          planned_has_time?: boolean
          priority?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          est_minutes?: number | null
          id?: string
          is_active?: boolean
          mental_effort?: string | null
          notes?: string | null
          owner_id?: string
          planned_at?: string | null
          planned_has_time?: boolean
          priority?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "task_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_attention: {
        Row: {
          last_activity_at: string | null
          last_seen_at: string | null
          owner_id: string
          thread_id: string
          unseen: boolean | null
        }
        Insert: {
          last_activity_at?: string | null
          last_seen_at?: string | null
          owner_id?: string
          thread_id: string
          unseen?: boolean | null
        }
        Update: {
          last_activity_at?: string | null
          last_seen_at?: string | null
          owner_id?: string
          thread_id?: string
          unseen?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "thread_attention_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_attention_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: true
            referencedRelation: "threads"
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
          arcadia_multitask_view: boolean
          arcadia_starter_key: string | null
          archived: boolean | null
          conversation_summary: string | null
          created_at: string
          feature: string
          flags: number
          id: string
          introspection_bootstrap_nonce: string | null
          introspection_config_ciphertext: string | null
          introspection_guided_state_ciphertext: string | null
          owner_id: string
          parent_thread_id: string | null
          path: string | null
          persisted_schemas: Json | null
          persona: string | null
          pinned: boolean
          research_ledger: string | null
          research_ledger_id: string | null
          research_ledger_rev: string | null
          subagent_agent_id: string | null
          subagent_heartbeat_at: string | null
          subagent_heartbeat_baseline: string | null
          subagent_heartbeat_digest: string | null
          subagent_status: string | null
          subagent_status_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          active_stream_id?: string | null
          active_stream_started_at?: string | null
          arcadia_multitask_view?: boolean
          arcadia_starter_key?: string | null
          archived?: boolean | null
          conversation_summary?: string | null
          created_at?: string
          feature?: string
          flags?: number
          id?: string
          introspection_bootstrap_nonce?: string | null
          introspection_config_ciphertext?: string | null
          introspection_guided_state_ciphertext?: string | null
          owner_id: string
          parent_thread_id?: string | null
          path?: string | null
          persisted_schemas?: Json | null
          persona?: string | null
          pinned?: boolean
          research_ledger?: string | null
          research_ledger_id?: string | null
          research_ledger_rev?: string | null
          subagent_agent_id?: string | null
          subagent_heartbeat_at?: string | null
          subagent_heartbeat_baseline?: string | null
          subagent_heartbeat_digest?: string | null
          subagent_status?: string | null
          subagent_status_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          active_stream_id?: string | null
          active_stream_started_at?: string | null
          arcadia_multitask_view?: boolean
          arcadia_starter_key?: string | null
          archived?: boolean | null
          conversation_summary?: string | null
          created_at?: string
          feature?: string
          flags?: number
          id?: string
          introspection_bootstrap_nonce?: string | null
          introspection_config_ciphertext?: string | null
          introspection_guided_state_ciphertext?: string | null
          owner_id?: string
          parent_thread_id?: string | null
          path?: string | null
          persisted_schemas?: Json | null
          persona?: string | null
          pinned?: boolean
          research_ledger?: string | null
          research_ledger_id?: string | null
          research_ledger_rev?: string | null
          subagent_agent_id?: string | null
          subagent_heartbeat_at?: string | null
          subagent_heartbeat_baseline?: string | null
          subagent_heartbeat_digest?: string | null
          subagent_status?: string | null
          subagent_status_at?: string | null
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
          {
            foreignKeyName: "threads_parent_thread_id_fkey"
            columns: ["parent_thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "threads_research_ledger_owner_fkey"
            columns: ["research_ledger_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "research_ledgers"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      threads_hierarchy_locks: {
        Row: {
          owner_key: string
          revision: boolean
        }
        Insert: {
          owner_key: string
          revision?: boolean
        }
        Update: {
          owner_key?: string
          revision?: boolean
        }
        Relationships: []
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
      user_connectors_profiles: {
        Row: {
          owner_id: string
          payload_ciphertext: string
          updated_at: string
          version: number
        }
        Insert: {
          owner_id: string
          payload_ciphertext: string
          updated_at?: string
          version?: number
        }
        Update: {
          owner_id?: string
          payload_ciphertext?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_connectors_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
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
      acquire_chat_stream_lease: {
        Args: { p_owner_id: string; p_thread_id: string; p_token: string }
        Returns: string
      }
      acquire_subagent_stream_lease: {
        Args: {
          p_owner_id: string
          p_parent_thread_id: string
          p_thread_id: string
          p_token: string
        }
        Returns: string
      }
      admin_token_analytics: {
        Args: { p_owner: string; p_since: string; p_until: string }
        Returns: {
          cached: number
          calls: number
          day: string
          input: number
          model: string
          operation: string
          output: number
          surface: string
          uncached: number
          unknown: number
        }[]
      }
      append_llm_usage_adjustment: {
        Args: {
          p_actor: string
          p_delta: number
          p_event_id: string
          p_id: string
          p_owner: string
          p_reason: string
        }
        Returns: {
          created_at: string
          created_by: string
          delta_usd: number
          effective_at: string
          event_id: string | null
          id: string
          owner_id: string
          reason: string
        }[]
        SetofOptions: {
          from: "*"
          to: "llm_usage_adjustments"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_ergon_refresh_lock: {
        Args: { p_owner_id: string; p_ttl_seconds: number }
        Returns: boolean
      }
      cleanup_heartbeat_runs: { Args: { batch_size?: number }; Returns: number }
      clerk_sub: { Args: never; Returns: string }
      consume_usage_reset: {
        Args: { p_expected_anchor: string; p_profile_id: string }
        Returns: {
          cycle_anchor: string
          resets_remaining: number
        }[]
      }
      current_profile_id: { Args: never; Returns: string }
      delete_message_with_links: {
        Args: { p_force?: boolean; p_message_id: string }
        Returns: boolean
      }
      perf_daily: {
        Args: { p_since: string }
        Returns: {
          day: string
          journey: string
          p50: number
          p95: number
          samples: number
        }[]
      }
      perf_prune: { Args: { p_keep?: string }; Returns: number }
      perf_summary: {
        Args: { p_budget_ms?: number; p_since: string }
        Returns: {
          device: string
          journey: string
          kind: string
          p50: number
          p75: number
          p95: number
          p99: number
          phase: string
          route: string
          samples: number
          within_budget: number
        }[]
      }
      read_admin_heartbeat_telemetry: {
        Args: {
          p_hours?: number
          p_offset?: number
          p_status?: string
          p_until?: string
        }
        Returns: Json
      }
      sidebar_thread_attention: {
        Args: { p_owner_id: string; p_since: string }
        Returns: {
          generation_step: string
          thread_id: string
          unseen: boolean
          working: boolean
        }[]
      }
      sum_llm_usage_cost: {
        Args: { p_owner: string; p_since: string; p_until: string }
        Returns: number
      }
    }
    Enums: {
      message_schema_kind: "ui_message"
      pin_target_type: "thread" | "persona"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      pin_target_type: ["thread", "persona"],
      summary_status: ["idle", "running", "dirty"],
    },
  },
} as const
