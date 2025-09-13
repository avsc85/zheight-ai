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
      agent_prompts: {
        Row: {
          created_at: string
          id: string
          name: string
          prompt: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          prompt: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          prompt?: string
          updated_at?: string
        }
        Relationships: []
      }
      architectural_issue_reports: {
        Row: {
          analysis_session_id: string
          checklist_item_id: string | null
          compliance_source: Database["public"]["Enums"]["compliance_source_enum"]
          confidence_level: Database["public"]["Enums"]["confidence_level_enum"]
          confidence_rationale: string
          created_at: string
          id: string
          issue_description: string
          issue_type: string
          location_in_sheet: string
          long_code_requirement: string
          plan_sheet_name: string
          short_code_requirement: string
          source_link: string
          specific_code_identifier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          analysis_session_id?: string
          checklist_item_id?: string | null
          compliance_source: Database["public"]["Enums"]["compliance_source_enum"]
          confidence_level: Database["public"]["Enums"]["confidence_level_enum"]
          confidence_rationale: string
          created_at?: string
          id?: string
          issue_description: string
          issue_type: string
          location_in_sheet: string
          long_code_requirement: string
          plan_sheet_name: string
          short_code_requirement: string
          source_link: string
          specific_code_identifier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          analysis_session_id?: string
          checklist_item_id?: string | null
          compliance_source?: Database["public"]["Enums"]["compliance_source_enum"]
          confidence_level?: Database["public"]["Enums"]["confidence_level_enum"]
          confidence_rationale?: string
          created_at?: string
          id?: string
          issue_description?: string
          issue_type?: string
          location_in_sheet?: string
          long_code_requirement?: string
          plan_sheet_name?: string
          short_code_requirement?: string
          source_link?: string
          specific_code_identifier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "architectural_issue_reports_checklist_item_id_fkey"
            columns: ["checklist_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          city: string | null
          code_identifier: string | null
          code_source: string | null
          created_at: string
          id: string
          issue_to_check: string
          location: string | null
          long_code_requirement: string | null
          natural_hazard_zone: string | null
          occupancy_group: string | null
          project_type: string | null
          reviewer_name: string | null
          sheet_name: string | null
          short_code_requirement: string | null
          source_link: string | null
          type_of_correction: string | null
          type_of_issue: string | null
          updated_at: string
          user_id: string
          zip_code: string | null
          zone_primary: string | null
        }
        Insert: {
          city?: string | null
          code_identifier?: string | null
          code_source?: string | null
          created_at?: string
          id?: string
          issue_to_check: string
          location?: string | null
          long_code_requirement?: string | null
          natural_hazard_zone?: string | null
          occupancy_group?: string | null
          project_type?: string | null
          reviewer_name?: string | null
          sheet_name?: string | null
          short_code_requirement?: string | null
          source_link?: string | null
          type_of_correction?: string | null
          type_of_issue?: string | null
          updated_at?: string
          user_id: string
          zip_code?: string | null
          zone_primary?: string | null
        }
        Update: {
          city?: string | null
          code_identifier?: string | null
          code_source?: string | null
          created_at?: string
          id?: string
          issue_to_check?: string
          location?: string | null
          long_code_requirement?: string | null
          natural_hazard_zone?: string | null
          occupancy_group?: string | null
          project_type?: string | null
          reviewer_name?: string | null
          sheet_name?: string | null
          short_code_requirement?: string | null
          source_link?: string | null
          type_of_correction?: string | null
          type_of_issue?: string | null
          updated_at?: string
          user_id?: string
          zip_code?: string | null
          zone_primary?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          comment_id: string
          created_at: string | null
          notes_tasks: string
          task_id: string | null
          timestamp: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          comment_id?: string
          created_at?: string | null
          notes_tasks: string
          task_id?: string | null
          timestamp?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          notes_tasks?: string
          task_id?: string | null
          timestamp?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["task_id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_status: boolean | null
          avatar_url: string | null
          company: string | null
          created_at: string
          location: string | null
          name: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_status?: boolean | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          location?: string | null
          name?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_status?: boolean | null
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          location?: string | null
          name?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_tasks: {
        Row: {
          allocated_due_date: string | null
          assigned_ar_id: string | null
          assigned_skip_flag: string | null
          completion_date: string | null
          created_at: string
          due_date: string | null
          hours: string | null
          last_step_timestamp: string | null
          milestone_number: number
          notes_tasks: string | null
          notes_tasks_ar: string | null
          notes_tasks_pm: string | null
          priority_exception: string | null
          project_id: string
          task_id: string
          task_name: string
          task_status: string | null
          time_percentage: number | null
          updated_at: string
        }
        Insert: {
          allocated_due_date?: string | null
          assigned_ar_id?: string | null
          assigned_skip_flag?: string | null
          completion_date?: string | null
          created_at?: string
          due_date?: string | null
          hours?: string | null
          last_step_timestamp?: string | null
          milestone_number: number
          notes_tasks?: string | null
          notes_tasks_ar?: string | null
          notes_tasks_pm?: string | null
          priority_exception?: string | null
          project_id: string
          task_id?: string
          task_name: string
          task_status?: string | null
          time_percentage?: number | null
          updated_at?: string
        }
        Update: {
          allocated_due_date?: string | null
          assigned_ar_id?: string | null
          assigned_skip_flag?: string | null
          completion_date?: string | null
          created_at?: string
          due_date?: string | null
          hours?: string | null
          last_step_timestamp?: string | null
          milestone_number?: number
          notes_tasks?: string | null
          notes_tasks_ar?: string | null
          notes_tasks_pm?: string | null
          priority_exception?: string | null
          project_id?: string
          task_id?: string
          task_name?: string
          task_status?: string | null
          time_percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ar_field_id: string | null
          ar_planning_id: string | null
          created_at: string
          difficulty_level: string | null
          end_date: string | null
          expected_end_date: string | null
          hours_allocated: number | null
          id: string
          last_edit_by: string | null
          last_edit_timestamp: string | null
          notes: string | null
          project_name: string
          project_notes: string | null
          start_date: string | null
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ar_field_id?: string | null
          ar_planning_id?: string | null
          created_at?: string
          difficulty_level?: string | null
          end_date?: string | null
          expected_end_date?: string | null
          hours_allocated?: number | null
          id?: string
          last_edit_by?: string | null
          last_edit_timestamp?: string | null
          notes?: string | null
          project_name: string
          project_notes?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ar_field_id?: string | null
          ar_planning_id?: string | null
          created_at?: string
          difficulty_level?: string | null
          end_date?: string | null
          expected_end_date?: string | null
          hours_allocated?: number | null
          id?: string
          last_edit_by?: string | null
          last_edit_timestamp?: string | null
          notes?: string | null
          project_name?: string
          project_notes?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_user: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin" | "pm" | "ar1_planning" | "ar2_field"
      compliance_source_enum: "California Code" | "Local"
      confidence_level_enum: "High" | "Medium" | "Low"
      issue_type_enum: "Missing" | "Non-compliant" | "Inconsistent"
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
      app_role: ["user", "admin", "pm", "ar1_planning", "ar2_field"],
      compliance_source_enum: ["California Code", "Local"],
      confidence_level_enum: ["High", "Medium", "Low"],
      issue_type_enum: ["Missing", "Non-compliant", "Inconsistent"],
    },
  },
} as const
