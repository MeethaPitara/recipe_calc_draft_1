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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_usage_log: {
        Row: {
          created_at: string | null
          function_name: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          function_name: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          function_name?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      calculated_metrics: {
        Row: {
          created_at: string | null
          fat_pct: number
          fpdt: number | null
          id: string
          msnf_pct: number
          other_solids_pct: number
          pac: number | null
          pod_index: number | null
          recipe_id: string
          sp: number | null
          sugars_pct: number
          total_fat_g: number
          total_msnf_g: number
          total_other_solids_g: number
          total_quantity_g: number
          total_solids_g: number
          total_solids_pct: number
          total_sugars_g: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fat_pct: number
          fpdt?: number | null
          id?: string
          msnf_pct: number
          other_solids_pct: number
          pac?: number | null
          pod_index?: number | null
          recipe_id: string
          sp?: number | null
          sugars_pct: number
          total_fat_g: number
          total_msnf_g: number
          total_other_solids_g: number
          total_quantity_g: number
          total_solids_g: number
          total_solids_pct: number
          total_sugars_g: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fat_pct?: number
          fpdt?: number | null
          id?: string
          msnf_pct?: number
          other_solids_pct?: number
          pac?: number | null
          pod_index?: number | null
          recipe_id?: string
          sp?: number | null
          sugars_pct?: number
          total_fat_g?: number
          total_msnf_g?: number
          total_other_solids_g?: number
          total_quantity_g?: number
          total_solids_g?: number
          total_solids_pct?: number
          total_sugars_g?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculated_metrics_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: true
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          event: string
          id: string
          meta: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event: string
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event?: string
          id?: string
          meta?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      ingredients: {
        Row: {
          category: string
          characterization_pct: number | null
          cost_per_kg: number | null
          created_at: string | null
          fat_pct: number | null
          hardening_factor: number
          id: string
          msnf_pct: number | null
          name: string
          notes: string | null
          other_solids_pct: number | null
          pac_coeff: number | null
          sp_coeff: number | null
          sugar_split: Json | null
          sugars_pct: number | null
          tags: string[] | null
          updated_at: string | null
          water_pct: number | null
        }
        Insert: {
          category: string
          characterization_pct?: number | null
          cost_per_kg?: number | null
          created_at?: string | null
          fat_pct?: number | null
          hardening_factor?: number
          id?: string
          msnf_pct?: number | null
          name: string
          notes?: string | null
          other_solids_pct?: number | null
          pac_coeff?: number | null
          sp_coeff?: number | null
          sugar_split?: Json | null
          sugars_pct?: number | null
          tags?: string[] | null
          updated_at?: string | null
          water_pct?: number | null
        }
        Update: {
          category?: string
          characterization_pct?: number | null
          cost_per_kg?: number | null
          created_at?: string | null
          fat_pct?: number | null
          hardening_factor?: number
          id?: string
          msnf_pct?: number | null
          name?: string
          notes?: string | null
          other_solids_pct?: number | null
          pac_coeff?: number | null
          sp_coeff?: number | null
          sugar_split?: Json | null
          sugars_pct?: number | null
          tags?: string[] | null
          updated_at?: string | null
          water_pct?: number | null
        }
        Relationships: []
      }
      recipe_outcomes: {
        Row: {
          actual_texture: string | null
          created_at: string | null
          id: string
          notes: string | null
          outcome: string
          recipe_id: string
          user_id: string
        }
        Insert: {
          actual_texture?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          outcome: string
          recipe_id: string
          user_id: string
        }
        Update: {
          actual_texture?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          outcome?: string
          recipe_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_outcomes_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_rows: {
        Row: {
          created_at: string | null
          fat_g: number
          id: string
          ingredient: string
          msnf_g: number
          other_solids_g: number
          quantity_g: number
          recipe_id: string
          sugars_g: number
          total_solids_g: number
        }
        Insert: {
          created_at?: string | null
          fat_g?: number
          id?: string
          ingredient: string
          msnf_g?: number
          other_solids_g?: number
          quantity_g: number
          recipe_id: string
          sugars_g?: number
          total_solids_g?: number
        }
        Update: {
          created_at?: string | null
          fat_g?: number
          id?: string
          ingredient?: string
          msnf_g?: number
          other_solids_g?: number
          quantity_g?: number
          recipe_id?: string
          sugars_g?: number
          total_solids_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "recipe_rows_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
        ]
      }
      recipes: {
        Row: {
          created_at: string | null
          id: string
          product_type: string | null
          recipe_name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_type?: string | null
          recipe_name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_type?: string | null
          recipe_name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      ingredients_public: {
        Row: {
          category: string | null
          created_at: string | null
          fat_pct: number | null
          id: string | null
          msnf_pct: number | null
          name: string | null
          notes: string | null
          other_solids_pct: number | null
          pac_coeff: number | null
          sp_coeff: number | null
          sugar_split: Json | null
          sugars_pct: number | null
          tags: string[] | null
          updated_at: string | null
          water_pct: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          fat_pct?: number | null
          id?: string | null
          msnf_pct?: number | null
          name?: string | null
          notes?: string | null
          other_solids_pct?: number | null
          pac_coeff?: number | null
          sp_coeff?: number | null
          sugar_split?: Json | null
          sugars_pct?: number | null
          tags?: string[] | null
          updated_at?: string | null
          water_pct?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          fat_pct?: number | null
          id?: string | null
          msnf_pct?: number | null
          name?: string | null
          notes?: string | null
          other_solids_pct?: number | null
          pac_coeff?: number | null
          sp_coeff?: number | null
          sugar_split?: Json | null
          sugars_pct?: number | null
          tags?: string[] | null
          updated_at?: string | null
          water_pct?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_ingredient_with_cost: {
        Args: { ingredient_id: string }
        Returns: {
          category: string
          cost_per_kg: number
          created_at: string
          fat_pct: number
          hardening_factor: number
          id: string
          msnf_pct: number
          name: string
          notes: string
          other_solids_pct: number
          pac_coeff: number
          sp_coeff: number
          sugar_split: Json
          sugars_pct: number
          tags: string[]
          updated_at: string
          water_pct: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refresh_ml_training_dataset: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
