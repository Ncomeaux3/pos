export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  core: {
    Tables: {
      connections: {
        Row: {
          created_at: string
          credentials_encrypted: string
          expires_at: string | null
          id: string
          integration_id: string
          last_test_detail: string | null
          last_tested_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials_encrypted: string
          expires_at?: string | null
          id?: string
          integration_id: string
          last_test_detail?: string | null
          last_tested_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials_encrypted?: string
          expires_at?: string | null
          id?: string
          integration_id?: string
          last_test_detail?: string | null
          last_tested_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      dashboard_summary: {
        Row: {
          created_at: string
          headline: string | null
          id: string
          notified_at: string | null
          run_at: string
          summary: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          headline?: string | null
          id?: string
          notified_at?: string | null
          run_at?: string
          summary?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          headline?: string | null
          id?: string
          notified_at?: string | null
          run_at?: string
          summary?: Json
          updated_at?: string
        }
        Relationships: []
      }
      digests: {
        Row: {
          created_at: string
          id: string
          module: string
          payload: Json
          run_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          module: string
          payload?: Json
          run_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          module?: string
          payload?: Json
          run_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          content_hash: string
          created_at: string
          embedded_at: string | null
          embedding: string | null
          entity_id: string
          id: string
          tsv: unknown
          updated_at: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          entity_id: string
          id?: string
          tsv?: unknown
          updated_at?: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          embedded_at?: string | null
          embedding?: string | null
          entity_id?: string
          id?: string
          tsv?: unknown
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_entity_id_fkey"
            columns: ["entity_id"]
            isOneToOne: true
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      entities: {
        Row: {
          body: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          module: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          module: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          module?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          entity_ref: string | null
          event_type: string
          id: string
          module: string
          occurred_at: string
          payload: Json
          title_snapshot: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_ref?: string | null
          event_type: string
          id?: string
          module: string
          occurred_at?: string
          payload?: Json
          title_snapshot: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_ref?: string | null
          event_type?: string
          id?: string
          module?: string
          occurred_at?: string
          payload?: Json
          title_snapshot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_entity_ref_fkey"
            columns: ["entity_ref"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          id: string
          last_run: string | null
          last_status: string | null
          log: Json
          module: string
          name: string
          schedule: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_run?: string | null
          last_status?: string | null
          log?: Json
          module: string
          name: string
          schedule?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_run?: string | null
          last_status?: string | null
          log?: Json
          module?: string
          name?: string
          schedule?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      llm_calls: {
        Row: {
          cost_cents: number
          created_at: string
          id: string
          input_tokens: number
          model: string
          module: string | null
          occurred_at: string
          output_tokens: number
          purpose: string
          updated_at: string
        }
        Insert: {
          cost_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model: string
          module?: string | null
          occurred_at?: string
          output_tokens?: number
          purpose: string
          updated_at?: string
        }
        Update: {
          cost_cents?: number
          created_at?: string
          id?: string
          input_tokens?: number
          model?: string
          module?: string | null
          occurred_at?: string
          output_tokens?: number
          purpose?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          channel: string
          created_at: string
          due_at: string
          id: string
          sent_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          due_at?: string
          id?: string
          sent_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          due_at?: string
          id?: string
          sent_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          created_at: string
          decided_at: string | null
          id: string
          module: string
          payload: Json
          reason: string | null
          status: string
          tool: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          id?: string
          module: string
          payload?: Json
          reason?: string | null
          status?: string
          tool: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          id?: string
          module?: string
          payload?: Json
          reason?: string | null
          status?: string
          tool?: string
          updated_at?: string
        }
        Relationships: []
      }
      request_log: {
        Row: {
          created_at: string
          duration_ms: number
          error: string | null
          id: string
          ip_hash: string | null
          method: string
          occurred_at: string
          route: string
          status: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_ms: number
          error?: string | null
          id?: string
          ip_hash?: string | null
          method: string
          occurred_at?: string
          route: string
          status: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number
          error?: string | null
          id?: string
          ip_hash?: string | null
          method?: string
          occurred_at?: string
          route?: string
          status?: number
          updated_at?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      skill_links: {
        Row: {
          classified_by: string
          confidence: number
          created_at: string
          entity_ref: string
          id: string
          is_manual: boolean
          skill_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          classified_by: string
          confidence?: number
          created_at?: string
          entity_ref: string
          id?: string
          is_manual?: boolean
          skill_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          classified_by?: string
          confidence?: number
          created_at?: string
          entity_ref?: string
          id?: string
          is_manual?: boolean
          skill_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "skill_links_entity_ref_fkey"
            columns: ["entity_ref"]
            isOneToOne: false
            referencedRelation: "entities"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_weights: {
        Row: {
          created_at: string
          event_type: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          event_type: string
          updated_at?: string
          weight: number
        }
        Update: {
          created_at?: string
          event_type?: string
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
    }
    Views: {
      skill_xp: {
        Row: {
          event_count: number | null
          last_event_at: string | null
          level: number | null
          skill_id: string | null
          xp: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      level: { Args: { xp: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  core: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

