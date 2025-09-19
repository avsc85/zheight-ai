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
          compliance_source: string
          confidence_level: string
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
          compliance_source: string
          confidence_level: string
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
          compliance_source?: string
          confidence_level?: string
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
        Relationships: []
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
      feasibility_analyses: {
        Row: {
          city_dept_link: string | null
          created_at: string
          id: string
          jurisdiction: string | null
          last_updated: string | null
          last_updated_by: string | null
          lot_size: string | null
          notes: string | null
          project_address: string
          source_link: string | null
          updated_at: string
          user_id: string
          zone: string | null
        }
        Insert: {
          city_dept_link?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          last_updated?: string | null
          last_updated_by?: string | null
          lot_size?: string | null
          notes?: string | null
          project_address: string
          source_link?: string | null
          updated_at?: string
          user_id: string
          zone?: string | null
        }
        Update: {
          city_dept_link?: string | null
          created_at?: string
          id?: string
          jurisdiction?: string | null
          last_updated?: string | null
          last_updated_by?: string | null
          lot_size?: string | null
          notes?: string | null
          project_address?: string
          source_link?: string | null
          updated_at?: string
          user_id?: string
          zone?: string | null
        }
        Relationships: []
      }
      jurisdiction_ordinances: {
        Row: {
          code_reference: string | null
          created_at: string
          daylight_plan_rear: string | null
          daylight_plan_side: string | null
          definition_floor_area: string | null
          definition_lot_coverage: string | null
          exemption_front_setback_encroachment: string | null
          exemption_max_height: string | null
          exemption_side_setback_encroachment: string | null
          exemption_substandard_lot: string | null
          floor_area_ratio: string | null
          id: string
          jurisdiction: string
          last_updated: string | null
          last_updated_by: string | null
          lot_coverage: string | null
          max_height_ft: string | null
          min_garage_length: string | null
          min_garage_width: string | null
          min_setback_corner_ft: string | null
          min_setback_front_ft: string | null
          min_setback_rear_ft: string | null
          min_setback_side_ft: string | null
          notes: string | null
          ordinance_source_link: string | null
          parking: string | null
          tag_1: string | null
          tag_2: string | null
          updated_at: string
          zone: string
        }
        Insert: {
          code_reference?: string | null
          created_at?: string
          daylight_plan_rear?: string | null
          daylight_plan_side?: string | null
          definition_floor_area?: string | null
          definition_lot_coverage?: string | null
          exemption_front_setback_encroachment?: string | null
          exemption_max_height?: string | null
          exemption_side_setback_encroachment?: string | null
          exemption_substandard_lot?: string | null
          floor_area_ratio?: string | null
          id?: string
          jurisdiction: string
          last_updated?: string | null
          last_updated_by?: string | null
          lot_coverage?: string | null
          max_height_ft?: string | null
          min_garage_length?: string | null
          min_garage_width?: string | null
          min_setback_corner_ft?: string | null
          min_setback_front_ft?: string | null
          min_setback_rear_ft?: string | null
          min_setback_side_ft?: string | null
          notes?: string | null
          ordinance_source_link?: string | null
          parking?: string | null
          tag_1?: string | null
          tag_2?: string | null
          updated_at?: string
          zone: string
        }
        Update: {
          code_reference?: string | null
          created_at?: string
          daylight_plan_rear?: string | null
          daylight_plan_side?: string | null
          definition_floor_area?: string | null
          definition_lot_coverage?: string | null
          exemption_front_setback_encroachment?: string | null
          exemption_max_height?: string | null
          exemption_side_setback_encroachment?: string | null
          exemption_substandard_lot?: string | null
          floor_area_ratio?: string | null
          id?: string
          jurisdiction?: string
          last_updated?: string | null
          last_updated_by?: string | null
          lot_coverage?: string | null
          max_height_ft?: string | null
          min_garage_length?: string | null
          min_garage_width?: string | null
          min_setback_corner_ft?: string | null
          min_setback_front_ft?: string | null
          min_setback_rear_ft?: string | null
          min_setback_side_ft?: string | null
          notes?: string | null
          ordinance_source_link?: string | null
          parking?: string | null
          tag_1?: string | null
          tag_2?: string | null
          updated_at?: string
          zone?: string
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
      admin_delete_user_complete: {
        Args: { target_email?: string; target_user_id: string }
        Returns: Json
      }
      detect_orphaned_auth_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      find_user_by_email_pattern: {
        Args: { email_pattern: string }
        Returns: {
          active_status: boolean
          email: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
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
